
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  UserRound,
  Mail,
  LockKeyhole,
  Phone,
  MapPin,
  BriefcaseBusiness,
  Wrench,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  X,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

import "./register.css";
import { api } from "../../services/api";
import { dashboardPath, useAuth } from "../../context/AuthContext";
import LocationPicker from "../../components/LocationPicker";

const initialFormData = {
  name: "",
  email: "",
  password: "",
  phone: "",
  skills: "",
  category: "",
  address: "",
  latitude: "",
  longitude: "",
};

const WORKER_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Painting",
  "Cleaning",
  "AC & HVAC",
  "Appliance Repair",
  "General Maintenance",
  "Other",
];

// Supports VITE_API_URL with or without the /api suffix.
const configuredApiUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const API_BASE_URL = configuredApiUrl.endsWith("/api")
  ? configuredApiUrl
  : `${configuredApiUrl}/api`;


async function otpRequest(endpoint, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message || "Request failed. Please try again."
      );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Request timed out. Please check your connection and try again."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}


export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState("user");
  const [formData, setFormData] = useState(initialFormData);

  const [showPassword, setShowPassword] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Email OTP state
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const normalizedEmail = formData.email.trim().toLowerCase();

  const emailVerified =
    Boolean(verifiedEmail) && verifiedEmail === normalizedEmail;

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;

    const timer = setTimeout(() => {
      setResendCountdown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");

    // Changing the email invalidates the previous verification.
    if (name === "email") {
      setOtp("");
      setOtpSent(false);
      setVerifiedEmail("");
      setResendCountdown(0);
    }
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setError("");
    setSuccess("");
  };

  const handleLocationSelect = (location) => {
    if (
      !location ||
      !location.address ||
      location.lat == null ||
      location.lng == null
    ) {
      setError("Please select a valid location on the map.");
      return;
    }

    setFormData((previous) => ({
      ...previous,
      address: location.address,
      latitude: String(location.lat),
      longitude: String(location.lng),
    }));

    setShowLocationPicker(false);
    setError("");
    setSuccess("Location selected successfully.");
  };

  // Send or resend the email verification OTP.
  const handleSendOtp = async () => {
    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError("Please enter your email address first.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (resendCountdown > 0 && otpSent) {
      setError(
        `Please wait ${resendCountdown} seconds before requesting another OTP.`
      );
      return;
    }

    try {
      setOtpLoading(true);

      const data = await otpRequest("send-otp", {
        email: normalizedEmail,
      });

      setOtpSent(true);
      setOtp("");
      setVerifiedEmail(data.verified ? normalizedEmail : "");
      setResendCountdown(data.verified ? 0 : data.resendAfter || 60);

      setSuccess(
        data.verified
          ? "Your email is already verified. You can create your account."
          : "OTP sent successfully! Check your email inbox and spam folder."
      );
    } catch (err) {
      setError(
        err.data?.message ||
          err.message ||
          "Unable to send OTP. Please try again."
      );

      if (err.data?.retryAfterSeconds) {
        setResendCountdown(err.data.retryAfterSeconds);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify the six-digit OTP.
  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Please enter the complete six-digit OTP.");
      return;
    }

    try {
      setOtpLoading(true);

      const data = await otpRequest("verify-otp", {
        email: normalizedEmail,
        otp: otp.trim(),
      });

      if (!data.verified) {
        throw new Error("Email verification could not be completed.");
      }

      setVerifiedEmail(normalizedEmail);
      setOtp("");
      setSuccess("Email verified successfully! You can now register.");
    } catch (err) {
      setError(
        err.data?.message ||
          err.message ||
          "OTP verification failed. Please try again."
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    // Block registration until the current email is verified.
    if (!emailVerified) {
      setError("Please verify your email before creating your account.");
      return;
    }

    if (!formData.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!formData.phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    if (!formData.address.trim()) {
      setError("Please select your location on the map.");
      return;
    }

    if (
      formData.latitude === "" ||
      formData.longitude === "" ||
      !Number.isFinite(Number(formData.latitude)) ||
      !Number.isFinite(Number(formData.longitude))
    ) {
      setError("Please select a valid map location before registering.");
      return;
    }

    if (role === "worker" && !formData.category) {
      setError("Please select your work category.");
      return;
    }

    if (role === "worker" && !formData.skills.trim()) {
      setError("Please enter your skills.");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      email: normalizedEmail,
      password: formData.password,
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      role,
    };

    if (role === "worker") {
      payload.category = formData.category;
      payload.skills = formData.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);
    }

    try {
      setLoading(true);

      const response =
        role === "worker"
          ? await api.registerWorker(payload)
          : await api.register(payload);

      const data = response?.data ?? response;

      if (!data?.token || !data?.user) {
        throw new Error(
          data?.message || "Unexpected registration response from the server."
        );
      }

      login(data.token, data.user);

      navigate(dashboardPath(data.user.role), {
        replace: true,
      });
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to register. Please try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-brand">
          <div className="register-brand-icon">
            <Wrench size={24} />
          </div>

          <div>
            <h1>FixFlow</h1>
            <p>Maintenance made simple.</p>
          </div>
        </div>

        <div className="register-card">
          <div className="register-heading">
            <span className="register-eyebrow">CREATE YOUR ACCOUNT</span>

            <h2>Join FixFlow</h2>

            <p>
              {role === "user"
                ? "Report issues and keep everything running smoothly."
                : "Connect with maintenance requests that match your skills."}
            </p>
          </div>

          <div className="register-role-switch">
            <button
              type="button"
              className={`register-role-option ${
                role === "user" ? "active" : ""
              }`}
              onClick={() => handleRoleChange("user")}
              disabled={loading}
            >
              <UserRound size={18} />
              <span>I'm a User</span>
            </button>

            <button
              type="button"
              className={`register-role-option ${
                role === "worker" ? "active" : ""
              }`}
              onClick={() => handleRoleChange("worker")}
              disabled={loading}
            >
              <BriefcaseBusiness size={18} />
              <span>I'm a Worker</span>
            </button>
          </div>

          {error && (
            <div className="register-alert register-alert-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              className="register-alert register-alert-success"
              role="status"
            >
              <CheckCircle2 size={17} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="register-form">
            <div className="register-field">
              <label htmlFor="name">Full name</label>

              <div className="register-input-wrap">
                <UserRound size={18} />

                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            {/* EMAIL + OTP VERIFICATION */}
            <div className="register-field">
              <label htmlFor="email">Email address</label>

              <div className="register-input-wrap">
                <Mail size={18} />

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                  disabled={loading}
                />

                {emailVerified && (
                  <CheckCircle2
                    size={20}
                    className="register-verified-icon"
                    aria-label="Email verified"
                  />
                )}
              </div>

              {emailVerified ? (
                <div className="register-otp-verified">
                  <ShieldCheck size={17} />
                  <span>Email address verified</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="register-otp-send"
                    onClick={handleSendOtp}
                    disabled={
                      otpLoading ||
                      loading ||
                      (otpSent && resendCountdown > 0)
                    }
                  >
                    {otpLoading ? (
                      <>
                        <RefreshCw size={16} className="register-spin" />
                        Please wait...
                      </>
                    ) : otpSent ? (
                      resendCountdown > 0 ? (
                        `Resend OTP in ${resendCountdown}s`
                      ) : (
                        "Resend OTP"
                      )
                    ) : (
                      <>
                        <Mail size={16} />
                        Send verification OTP
                      </>
                    )}
                  </button>

                  {otpSent && (
                    <div className="register-otp-panel">
                      <label htmlFor="registration-otp">
                        Enter 6-digit OTP
                      </label>

                      <p className="register-help-text">
                        Enter the code sent to {normalizedEmail}.
                      </p>

                      <input
                        id="registration-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        maxLength={6}
                        value={otp}
                        onChange={(event) => {
                          setOtp(
                            event.target.value.replace(/\D/g, "").slice(0, 6)
                          );
                          setError("");
                        }}
                        disabled={otpLoading || loading}
                        aria-label="Six-digit email verification code"
                      />

                      <button
                        type="button"
                        className="register-otp-verify"
                        onClick={handleVerifyOtp}
                        disabled={
                          otpLoading || loading || otp.trim().length !== 6
                        }
                      >
                        {otpLoading ? "Verifying..." : "Verify email"}
                      </button>

                      <p className="register-help-text">
                        Didn't receive the email? Check your spam folder.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="register-field">
              <label htmlFor="phone">Phone number</label>

              <div className="register-input-wrap">
                <Phone size={18} />

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <div className="register-field">
              <label htmlFor="password">Password</label>

              <div className="register-input-wrap">
                <LockKeyhole size={18} />

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {role === "worker" && (
              <>
                <div className="register-field">
                  <label htmlFor="category">Work category</label>

                  <div className="register-input-wrap">
                    <BriefcaseBusiness size={18} />

                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select your speciality</option>

                      {WORKER_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="register-field">
                  <label htmlFor="skills">Skills</label>

                  <div className="register-input-wrap">
                    <Wrench size={18} />

                    <input
                      id="skills"
                      name="skills"
                      type="text"
                      placeholder="e.g. pipe repair, installation"
                      value={formData.skills}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <small className="register-help-text">
                    Separate multiple skills with commas.
                  </small>
                </div>
              </>
            )}

            <div className="register-field">
              <label htmlFor="address">Your location</label>

              <div className="register-location-summary">
                <div className="register-location-icon">
                  <MapPin size={20} />
                </div>

                <div className="register-location-details">
                  <strong>
                    {formData.address
                      ? "Selected address"
                      : "Choose your location"}
                  </strong>

                  <p>
                    {formData.address ||
                      "Select your address on the interactive map."}
                  </p>

                  {formData.latitude !== "" &&
                    formData.longitude !== "" && (
                      <small>
                        {Number(formData.latitude).toFixed(5)},{" "}
                        {Number(formData.longitude).toFixed(5)}
                      </small>
                    )}
                </div>

                <button
                  type="button"
                  className="register-location-change"
                  onClick={() => setShowLocationPicker(true)}
                  disabled={loading}
                >
                  {formData.address ? "Change" : "Select"}
                </button>
              </div>

              <input
                id="address"
                name="address"
                type="text"
                value={formData.address}
                readOnly
                required
                tabIndex={-1}
                aria-label="Selected address"
                className="register-address-validation"
              />
            </div>

            <button
              type="submit"
              className="register-submit"
              disabled={loading || !emailVerified}
              title={
                !emailVerified
                  ? "Verify your email before registering"
                  : "Create your account"
              }
            >
              {loading ? (
                <span>Creating account...</span>
              ) : (
                <>
                  <span>
                    Create {role === "worker" ? "Worker" : "User"} Account
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {!emailVerified && (
              <p className="register-help-text register-submit-hint">
                Verify your email to enable account creation.
              </p>
            )}
          </form>

          <div className="register-footer">
            Already have an account? <Link to="/">Sign in</Link>
          </div>
        </div>

        <p className="register-bottom-note">
          Built for better maintenance management.
        </p>
      </div>

      {showLocationPicker && (
        <div
          className="register-location-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowLocationPicker(false);
            }
          }}
        >
          <div
            className="register-location-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-modal-title"
          >
            <div className="register-location-modal-header">
              <div>
                <h3 id="location-modal-title">Choose your location</h3>
                <p>
                  Search for an address, use your current location, or click
                  directly on the map.
                </p>
              </div>

              <button
                type="button"
                className="register-location-close"
                onClick={() => setShowLocationPicker(false)}
                aria-label="Close location picker"
              >
                <X size={21} />
              </button>
            </div>

            <LocationPicker
              initialLocation={
                formData.latitude !== "" && formData.longitude !== ""
                  ? {
                      lat: Number(formData.latitude),
                      lng: Number(formData.longitude),
                      address: formData.address,
                    }
                  : null
              }
              onLocationSelect={handleLocationSelect}
            />

            <div className="register-location-modal-footer">
              <button
                type="button"
                className="register-location-cancel"
                onClick={() => setShowLocationPicker(false)}
              >
                Cancel
              </button>

              <p>
                Select a point on the map to save its address and coordinates.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
