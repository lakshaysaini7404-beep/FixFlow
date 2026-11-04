import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./login.css";
import { api } from "../../services/api";
import { dashboardPath, useAuth } from "../../context/AuthContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const data = await api.login({ email, password });
      login(data.token, data.user);
      setMessage("Login successful! Redirecting...");
      navigate(dashboardPath(data.user.role));
    } catch (error) {
      setMessage(error.message || "Unable to connect to server");
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="brand">
          <div className="brand-icon">⌂</div>
          <div>
            <h1>
              Fix<span>Flow</span>
            </h1>
            <p>Report · Track · Get It Fixed</p>
          </div>
        </div>

        <div className="hero-content">
          <h2>
            Smarter Maintenance.
            <br />
            <span>Better Spaces.</span>
          </h2>
          <p>
            From homes to offices, FixFlow helps you report maintenance issues,
            track progress and get things fixed — quickly and easily.
          </p>
          <div className="features">
            <div className="feature">
              <div className="feature-icon">▣</div>
              <span>
                Easy
                <br />
                Reporting
              </span>
            </div>
            <div className="feature">
              <div className="feature-icon">✓</div>
              <span>
                Real-time
                <br />
                Tracking
              </span>
            </div>
            <div className="feature">
              <div className="feature-icon">♟</div>
              <span>
                Skilled
                <br />
                Technicians
              </span>
            </div>
            <div className="feature">
              <div className="feature-icon">ϟ</div>
              <span>
                Faster
                <br />
                Resolution
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="welcome">
            <span className="wave">👋</span>
            <h2>
              Welcome Back <span>Buddy!</span>
            </h2>
            <p>Login to continue your journey with FixFlow.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email Address</label>
              <div className="input-box">
                <span className="input-icon">✉</span>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-box">
                <span className="input-icon">🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="show-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "◉" : "◌"}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="remember">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? "Logging in..." : "→  Login"}
            </button>

            {message && <p className="login-message">{message}</p>}

            <div className="divider">
              <span></span>
              <p>OR</p>
              <span></span>
            </div>

            <button
              type="button"
              className="google-button"
              onClick={() => {
                const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

window.location.href = `${API_BASE_URL}/api/auth/google`;
              }}
            >
              <strong>G</strong>
              Continue with Google
            </button>

            <p className="register-text">
              Don't have an account?
              <Link to="/register">Register here</Link>
            </p>
            <p className="register-text" style={{ fontSize: 13 }}>
              Demo: user@fixflow.com / plumber@fixflow.com / admin@fixflow.com — password 123456
            </p>
          </form>
        </div>
        <div className="secure-text">🛡️ &nbsp; Secure · Trusted · Built for a better tomorrow</div>
      </div>
    </div>
  );
}

export default Login;
