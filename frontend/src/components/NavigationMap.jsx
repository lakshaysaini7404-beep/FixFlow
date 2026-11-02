
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./NavigationMap.css";
import { api } from "../services/api";

const DEFAULT_CENTER = [30.1, 77.3];

function getCoordinates(location) {
  if (!location) return null;

  const coordinates = location.geo?.coordinates || location.coordinates;

  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const [lng, lat] = coordinates.map(Number);

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      (lat !== 0 || lng !== 0)
    ) {
      return [lat, lng];
    }
  }

  const lat = Number(location.lat ?? location.latitude);
  const lng = Number(location.lng ?? location.lon ?? location.longitude);

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat !== 0 || lng !== 0)
  ) {
    return [lat, lng];
  }

  return null;
}

function makeIcon(className, content, size = 32) {
  return L.divIcon({
    className: "navigation-marker-icon",
    html: `<div class="${className}">${content}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const destinationIcon = makeIcon("destination-marker", "!", 34);
const workerIcon = makeIcon("worker-marker", "➤", 36);

function getPlaceIcon(category) {
  const value = String(category || "").toLowerCase();
  let emoji = "📍";

  if (/hospital|clinic|doctors|pharmacy|dentist/.test(value)) {
    emoji = "🏥";
  } else if (/fuel|petrol/.test(value)) {
    emoji = "⛽";
  } else if (/restaurant|cafe|fast_food|food/.test(value)) {
    emoji = "🍽️";
  } else if (/shop|supermarket|convenience|mall/.test(value)) {
    emoji = "🛍️";
  } else if (/school|college|university|library/.test(value)) {
    emoji = "🎓";
  } else if (/bank|atm/.test(value)) {
    emoji = "🏦";
  } else if (/police|fire_station/.test(value)) {
    emoji = "🚨";
  } else if (/parking/.test(value)) {
    emoji = "🅿️";
  } else if (/hotel|guest_house|hostel/.test(value)) {
    emoji = "🏨";
  } else if (/park|playground|garden/.test(value)) {
    emoji = "🌳";
  }

  return makeIcon("place-map-marker", emoji, 29);
}

function MapViewport({ workerPosition, destination, route }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (workerPosition && destination && !hasFitted.current) {
      map.fitBounds([workerPosition, destination], {
        padding: [35, 35],
        maxZoom: 16,
      });
      hasFitted.current = true;
    } else if (destination && !hasFitted.current) {
      map.setView(destination, 15);
      hasFitted.current = true;
    }
  }, [map, workerPosition, destination]);

  useEffect(() => {
    if (route.length && workerPosition && destination) {
      map.fitBounds([workerPosition, destination], {
        padding: [35, 35],
        maxZoom: 16,
      });
    }
  }, [map, route, workerPosition, destination]);

  return null;
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "—";

  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "—";

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining
    ? `${hours} hr ${remaining} min`
    : `${hours} hr`;
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");
}

export default function NavigationMap({
  ticket,
  jobStarted = false,
  autoStart = false,
}) {
  const destination = getCoordinates(ticket?.location);

  const isJobStarted =
    jobStarted || normalizeStatus(ticket?.status) === "in progress";

  const [workerPosition, setWorkerPosition] = useState(null);
  const [route, setRoute] = useState([]);
  const [directions, setDirections] = useState([]);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState("");
  const [locationReady, setLocationReady] = useState(false);

  // All hooks must remain inside the component.
  const watchId = useRef(null);
  const lastRoutePosition = useRef(null);
  const lastLocationSentAt = useRef(0);
  const autoStartHandled = useRef(false);

  const loadRoute = useCallback(async (origin, target) => {
    if (!origin || !target) return;

    setLoadingRoute(true);
    setError("");

    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${origin[1]},${origin[0]};${target[1]},${target[0]}` +
        "?overview=full&geometries=geojson&steps=true";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Unable to calculate the road route.");
      }

      const result = await response.json();
      const selectedRoute = result.routes?.[0];

      if (!selectedRoute) {
        throw new Error("No driving route found for these locations.");
      }

      const points = selectedRoute.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng]
      );

      setRoute(points);
      setDistance(selectedRoute.distance);
      setDuration(selectedRoute.duration);

      const steps = (
        selectedRoute.legs?.flatMap((leg) => leg.steps || []) || []
      )
        .filter((step) => step.name || step.maneuver?.type)
        .map((step, index) => ({
          id: `${index}-${step.name || "road"}`,
          road: step.name || "Unnamed road",
          instruction: [
            step.maneuver?.modifier,
            step.name,
          ].filter(Boolean).join(" onto "),
          distance: step.distance,
        }));

      setDirections(steps);
      lastRoutePosition.current = origin;
    } catch (err) {
      setError(err.message || "Could not load route.");
      setRoute([]);
      setDirections([]);
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  // Get initial GPS position and route preview.
  useEffect(() => {
    if (!destination) {
      setError("This ticket has no valid destination coordinates.");
      return;
    }

    if (!navigator.geolocation) {
      setError("Your browser does not support GPS location.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const current = [coords.latitude, coords.longitude];

        setWorkerPosition(current);
        setLocationReady(true);
        loadRoute(current, destination);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Allow location access to show the route."
            : "Could not get your location. Check GPS and try again."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  }, [destination?.[0], destination?.[1], loadRoute]);

  // Load nearby places around the ticket destination.
  useEffect(() => {
    if (!destination) return;

    const controller = new AbortController();

    async function loadNearbyPlaces() {
      setLoadingPlaces(true);

      try {
        const [lat, lng] = destination;

        const query = `
          [out:json][timeout:20];
          (
            node(around:1200,${lat},${lng})["amenity"];
            way(around:1200,${lat},${lng})["amenity"];
            node(around:1200,${lat},${lng})["shop"];
            way(around:1200,${lat},${lng})["shop"];
            node(around:1200,${lat},${lng})["tourism"];
            node(around:1200,${lat},${lng})["leisure"];
          );
          out center tags;
        `;

        const response = await fetch(
          "https://overpass-api.de/api/interpreter",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body: new URLSearchParams({ data: query }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Nearby map markers unavailable.");
        }

        const result = await response.json();

        const places = (result.elements || [])
          .map((item) => {
            const latValue = item.lat ?? item.center?.lat;
            const lngValue = item.lon ?? item.center?.lon;

            if (
              !Number.isFinite(latValue) ||
              !Number.isFinite(lngValue)
            ) {
              return null;
            }

            const tags = item.tags || {};
            const category =
              tags.amenity ||
              tags.shop ||
              tags.tourism ||
              tags.leisure ||
              "place";

            return {
              id: `${item.type}-${item.id}`,
              name: tags.name || category.replaceAll("_", " "),
              category,
              position: [latValue, lngValue],
            };
          })
          .filter(Boolean)
          .slice(0, 60);

        setNearbyPlaces(places);
      } catch (err) {
        if (err.name !== "AbortError") setNearbyPlaces([]);
      } finally {
        if (!controller.signal.aborted) setLoadingPlaces(false);
      }
    }

    loadNearbyPlaces();

    return () => controller.abort();
  }, [destination?.[0], destination?.[1]]);

  // Start live GPS navigation and send location to backend.
  const startNavigation = useCallback(() => {
    if (!isJobStarted) {
      setError("Click Start Job before starting navigation.");
      return;
    }

    if (!destination) {
      setError("Ticket destination coordinates are missing.");
      return;
    }

    if (!navigator.geolocation) {
      setError("Your browser does not support GPS navigation.");
      return;
    }

    if (watchId.current !== null) return;

    setError("");

    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const current = [coords.latitude, coords.longitude];

        setWorkerPosition(current);
        setLocationReady(true);

        // Send worker location approximately every 3 seconds.
        const now = Date.now();

        if (
          ticket?._id &&
          now - lastLocationSentAt.current >= 3000
        ) {
          lastLocationSentAt.current = now;

          api.updateWorkerLocation(
            ticket._id,
            coords.latitude,
            coords.longitude
          ).catch((err) => {
            console.error(
              "Failed to send worker location:",
              err.message
            );
          });
        }

        // Recalculate route after moving at least 30 metres.
        const previous = lastRoutePosition.current;

        const movedEnough =
          !previous ||
          L.latLng(previous).distanceTo(L.latLng(current)) >= 30;

        if (movedEnough) {
          loadRoute(current, destination);
        }
      },
      (err) => {
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }

        setNavigating(false);

        setError(
          err.code === 1
            ? "Location permission is required for live navigation."
            : "GPS signal unavailable. Check your device location settings."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000,
      }
    );

    setNavigating(true);
  }, [isJobStarted, destination, loadRoute, ticket?._id]);

  // Automatically start navigation after Start Job succeeds.
  useEffect(() => {
    if (!autoStart) {
      autoStartHandled.current = false;
      return;
    }

    if (
      isJobStarted &&
      locationReady &&
      !autoStartHandled.current
    ) {
      autoStartHandled.current = true;
      startNavigation();
    }
  }, [autoStart, isJobStarted, locationReady, startNavigation]);

  const stopNavigation = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    setNavigating(false);
  };

  // Stop GPS tracking when component unmounts.
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  if (!destination) {
    return (
      <section className="navigation-card">
        <h3>Route to Job</h3>
        <p className="navigation-error">
          No valid ticket coordinates were found. Check the saved ticket location.
        </p>
      </section>
    );
  }

  return (
    <section className="navigation-card">
      <div className="navigation-heading">
        <div>
          <h3>Route to Job</h3>
          <p>
            {ticket.location?.address || ticket.title || "Ticket destination"}
          </p>
        </div>

        <span className={`gps-status ${navigating ? "gps-active" : ""}`}>
          <span />
          {navigating ? "Live GPS" : "GPS ready"}
        </span>
      </div>

      <div className="navigation-summary">
        <div>
          <span>Distance</span>
          <strong>{formatDistance(distance)}</strong>
        </div>

        <div>
          <span>Estimated drive</span>
          <strong>{formatDuration(duration)}</strong>
        </div>
      </div>

      {error && (
        <p className="navigation-error" role="status">
          {error}
        </p>
      )}

      <div className="navigation-map">
        <MapContainer
          center={workerPosition || destination || DEFAULT_CENTER}
          zoom={15}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapViewport
            workerPosition={workerPosition}
            destination={destination}
            route={route}
          />

          <Marker position={destination} icon={destinationIcon}>
            <Popup>
              <strong>Job destination</strong>
              <br />
              {ticket.location?.address || ticket.title}
            </Popup>
          </Marker>

          {workerPosition && (
            <Marker position={workerPosition} icon={workerIcon}>
              <Popup>
                <strong>Your location</strong>
                <br />
                {navigating ? "Live GPS position" : "Current position"}
              </Popup>
            </Marker>
          )}

          {route.length > 0 && (
            <>
              <Polyline
                positions={route}
                pathOptions={{
                  color: "#fff",
                  weight: 8,
                  opacity: 0.95,
                }}
              />

              <Polyline
                positions={route}
                pathOptions={{
                  color: "#2878f0",
                  weight: 5,
                  opacity: 1,
                }}
              />
            </>
          )}

          {nearbyPlaces.map((place) => (
            <Marker
              key={place.id}
              position={place.position}
              icon={getPlaceIcon(place.category)}
            >
              <Popup>
                <strong>{place.name}</strong>
                <br />
                <span>{place.category.replaceAll("_", " ")}</span>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="map-legend">
          <span><i className="legend-worker" /> You</span>
          <span><i className="legend-destination" /> Job</span>
          <span><i className="legend-route" /> Route</span>
        </div>
      </div>

      <div className="navigation-bottom">
        <div className="navigation-bottom-info">
          <strong>
            {navigating
              ? "Navigation in progress"
              : isJobStarted
                ? "Ready to navigate"
                : "Start the job to unlock navigation"}
          </strong>

          <span>
            {loadingRoute
              ? "Calculating route…"
              : loadingPlaces
                ? "Loading map places…"
                : `${nearbyPlaces.length} nearby map markers`}
          </span>
        </div>

        <div className="navigation-controls">
          {!navigating ? (
            <button
              type="button"
              className="navigation-start-button"
              onClick={startNavigation}
              disabled={!isJobStarted || !locationReady}
              title={
                !isJobStarted
                  ? "Start the job before navigating"
                  : !locationReady
                    ? "Waiting for GPS location"
                    : "Start live navigation"
              }
            >
              ➤ Start Navigation
            </button>
          ) : (
            <button
              type="button"
              className="navigation-stop-button"
              onClick={stopNavigation}
            >
              ■ Stop
            </button>
          )}

          <button
            type="button"
            className="navigation-secondary-button"
            onClick={() => {
              if (workerPosition) {
                loadRoute(workerPosition, destination);
              }
            }}
            disabled={!workerPosition || loadingRoute}
          >
            Refresh route
          </button>
        </div>
      </div>

      {directions.length > 0 && (
        <details className="directions-panel">
          <summary>
            View directions · {directions.length} steps
          </summary>

          <ol>
            {directions.map((step) => (
              <li key={step.id}>
                <div>
                  <strong>{step.instruction || step.road}</strong>
                  <small>{formatDistance(step.distance)}</small>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
