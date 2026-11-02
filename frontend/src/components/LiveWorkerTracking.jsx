
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
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

// Local development: localhost:5000
// Production: configure VITE_SOCKET_URL with your backend URL.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const workerIcon = L.divIcon({
  className: "live-worker-marker",
  html: `
    <div style="
      background:#2563eb;
      color:white;
      border:3px solid white;
      border-radius:50%;
      width:34px;
      height:34px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:18px;
      box-shadow:0 2px 10px #0004
    ">➤</div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const destinationIcon = L.divIcon({
  className: "live-destination-marker",
  html: `
    <div style="
      background:#dc2626;
      color:white;
      border:3px solid white;
      border-radius:50%;
      width:30px;
      height:30px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:bold;
      box-shadow:0 2px 10px #0004
    ">!</div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");
}

function getDestination(location) {
  if (!location) return null;

  const coordinates =
    location.geo?.coordinates || location.coordinates;

  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      (lat !== 0 || lng !== 0)
    ) {
      return [lat, lng];
    }
  }

  const lat = Number(location.latitude ?? location.lat);
  const lng = Number(
    location.longitude ?? location.lng ?? location.lon
  );

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (lat !== 0 || lng !== 0)
  ) {
    return [lat, lng];
  }

  return null;
}

function getWorkerPosition(location) {
  if (!location) return null;

  const lat = Number(location.latitude);
  const lng = Number(location.longitude);

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (lat !== 0 || lng !== 0)
  ) {
    return [lat, lng];
  }

  return null;
}

function MapViewport({ workerPosition, destination }) {
  const map = useMap();
  const hasFittedRoute = useRef(false);

  useEffect(() => {
    if (workerPosition && destination && !hasFittedRoute.current) {
      map.fitBounds([workerPosition, destination], {
        padding: [40, 40],
        maxZoom: 16,
      });

      hasFittedRoute.current = true;
    } else if (!workerPosition && destination) {
      map.setView(destination, 15);
    }
  }, [
    map,
    workerPosition?.[0],
    workerPosition?.[1],
    destination?.[0],
    destination?.[1],
  ]);

  // Keep the worker visible without repeatedly zooming the map.
  useEffect(() => {
    if (workerPosition && hasFittedRoute.current) {
      map.panTo(workerPosition, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [
    map,
    workerPosition?.[0],
    workerPosition?.[1],
  ]);

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
  const remainder = minutes % 60;

  return remainder
    ? `${hours} hr ${remainder} min`
    : `${hours} hr`;
}

export default function LiveWorkerTracking({ ticket }) {
  const destination = getDestination(ticket?.location);

  const [workerPosition, setWorkerPosition] = useState(() =>
    getWorkerPosition(ticket?.workerLocation)
  );

  const [route, setRoute] = useState([]);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);

  const [connection, setConnection] = useState("Connecting...");

  const [lastUpdated, setLastUpdated] = useState(
    ticket?.workerLocation?.updatedAt || null
  );

  const isInProgress =
    normalizeStatus(ticket?.status) === "in progress";

  // Update saved worker location when ticket data changes.
  useEffect(() => {
    const savedPosition = getWorkerPosition(
      ticket?.workerLocation
    );

    if (savedPosition) {
      setWorkerPosition(savedPosition);
      setLastUpdated(
        ticket?.workerLocation?.updatedAt || null
      );
    }
  }, [
    ticket?.workerLocation?.latitude,
    ticket?.workerLocation?.longitude,
    ticket?.workerLocation?.updatedAt,
  ]);

  // Socket.IO live tracking.
  useEffect(() => {
    if (!ticket?._id || !isInProgress) {
      setConnection("Waiting for job to start");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setConnection("Session expired. Please sign in again.");
      return;
    }

    setConnection("Connecting to tracking server...");

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    const ticketId = String(ticket._id);

    // Register location listener before connecting.
    socket.on("worker:location", (location) => {
      if (String(location?.ticketId) !== ticketId) {
        return;
      }

      const lat = Number(location.latitude);
      const lng = Number(location.longitude);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180 ||
        (lat === 0 && lng === 0)
      ) {
        console.warn("Invalid worker location received:", location);
        return;
      }

      setWorkerPosition([lat, lng]);

      setLastUpdated(
        location.updatedAt || new Date().toISOString()
      );

      setConnection("Receiving live worker location");
    });

    // Join the tracking room after every successful connection.
    socket.on("connect", () => {
      setConnection("Connected. Joining ticket tracking...");

      socket.timeout(8000).emit(
        "tracking:join",
        { ticketId },
        (error, result) => {
          if (error) {
            console.error(
              "Tracking room acknowledgement timed out."
            );

            setConnection(
              "Connected, but room confirmation timed out."
            );
            return;
          }

          if (result?.ok) {
            setConnection(
              "Connected. Waiting for worker GPS..."
            );

            // Use initial saved location if server includes it
            // in the acknowledgement.
            if (result.location) {
              const initialLocation = {
                ...result.location,
                ticketId,
              };

              const lat = Number(initialLocation.latitude);
              const lng = Number(initialLocation.longitude);

              if (
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                lat >= -90 &&
                lat <= 90 &&
                lng >= -180 &&
                lng <= 180 &&
                (lat !== 0 || lng !== 0)
              ) {
                setWorkerPosition([lat, lng]);
                setLastUpdated(
                  initialLocation.updatedAt ||
                    new Date().toISOString()
                );
              }
            }
          } else {
            setConnection(
              result?.message ||
                "Unable to join ticket tracking."
            );
          }
        }
      );
    });

    socket.on("connect_error", (error) => {
      setConnection(`Connection failed: ${error.message}`);

      console.error(
        "FixFlow tracking socket error:",
        error
      );
    });

    socket.on("disconnect", (reason) => {
      setConnection(`Tracking disconnected: ${reason}`);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [ticket?._id, isInProgress]);

  // Fetch driving route whenever worker position changes.
  useEffect(() => {
    if (!workerPosition || !destination) {
      setRoute([]);
      setDistance(null);
      setDuration(null);
      return;
    }

    const controller = new AbortController();

    async function fetchRoute() {
      try {
        const url =
          "https://router.project-osrm.org/route/v1/driving/" +
          `${workerPosition[1]},${workerPosition[0]};` +
          `${destination[1]},${destination[0]}` +
          "?overview=full&geometries=geojson";

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Route service unavailable");
        }

        const data = await response.json();
        const result = data.routes?.[0];

        if (!result) {
          throw new Error("No driving route found");
        }

        setRoute(
          result.geometry.coordinates.map(([lng, lat]) => [
            lat,
            lng,
          ])
        );

        setDistance(result.distance);
        setDuration(result.duration);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(
            "FixFlow route error:",
            error.message
          );

          setRoute([]);
          setDistance(null);
          setDuration(null);
        }
      }
    }

    fetchRoute();

    return () => controller.abort();
  }, [
    workerPosition?.[0],
    workerPosition?.[1],
    destination?.[0],
    destination?.[1],
  ]);

  if (!isInProgress) {
    return null;
  }

  if (!destination) {
    return (
      <section className="navigation-card">
        <h3>Track Your Technician</h3>
        <p>
          The repair destination has no valid coordinates.
          Please check the ticket location saved in the database.
        </p>
      </section>
    );
  }

  return (
    <section className="navigation-card">
      <div className="navigation-heading">
        <div>
          <h3>Track Your Technician</h3>
          <p>
            {ticket.assignedWorker?.name ||
              "Assigned technician"}
          </p>
        </div>

        <span
          className={`gps-status ${
            connection === "Receiving live worker location"
              ? "gps-active"
              : ""
          }`}
        >
          <span />
          {connection}
        </span>
      </div>

      <div className="navigation-summary">
        <div>
          <span>Route distance</span>
          <strong>{formatDistance(distance)}</strong>
        </div>

        <div>
          <span>Estimated drive</span>
          <strong>{formatDuration(duration)}</strong>
        </div>
      </div>

      <div className="navigation-map" style={{ height: 390 }}>
        <MapContainer
          key={String(ticket._id)}
          center={workerPosition || destination}
          zoom={14}
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
          />

          <Marker position={destination} icon={destinationIcon}>
            <Popup>
              <strong>Repair location</strong>
              <br />
              {ticket.location?.address || ticket.title}
            </Popup>
          </Marker>

          {workerPosition && (
            <Marker position={workerPosition} icon={workerIcon}>
              <Popup>
                <strong>Technician location</strong>
                <br />
                Latest received GPS position
              </Popup>
            </Marker>
          )}

          {route.length > 0 && (
            <Polyline
              positions={route}
              pathOptions={{
                color: "#2878f0",
                weight: 5,
                opacity: 0.9,
              }}
            />
          )}
        </MapContainer>
      </div>

      <p
        style={{
          marginTop: 12,
          fontSize: 13,
          color: "#64748b",
        }}
      >
        {lastUpdated
          ? `Last GPS update: ${new Date(
              lastUpdated
            ).toLocaleTimeString()}`
          : workerPosition
            ? "Worker location loaded. Waiting for the next GPS update..."
            : "Repair location is shown. Waiting for the technician's first GPS update..."}
      </p>

      <p style={{ fontSize: 12, color: "#64748b" }}>
        Map © OpenStreetMap contributors · Route estimates via OSRM.
        Distance and arrival time are estimates.
      </p>
    </section>
  );
}
