
import { useState } from "react";
import {
  UserRound, Palette, ShieldCheck, Bell, LockKeyhole,
  Sun, Moon, Monitor, Eye, EyeOff, Check, Save
} from "lucide-react";
import { api } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import "./Settings.css";

export default function Settings() {
  const { theme, setTheme } = useTheme();

  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [visible, setVisible] = useState({});
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("fixflow-notifications")
      ) || {
        ticketUpdates: true,
        assignments: true,
        emailAlerts: true,
      };
    } catch {
      return {
        ticketUpdates: true,
        assignments: true,
        emailAlerts: true,
      };
    }
  });

  const toggleNotification = (key) => {
    setNotifications((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
    setNotice("");
  };

  const savePreferences = () => {
    localStorage.setItem(
      "fixflow-notifications",
      JSON.stringify(notifications)
    );
    setNotice("Preferences saved successfully.");
  };

  const updatePasswordField = (event) => {
    setPassword((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
    setNotice("");
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setNotice("");

    if (
      !password.currentPassword ||
      !password.newPassword ||
      !password.confirmPassword
    ) {
      setNotice("Please fill in all password fields.");
      return;
    }

    if (password.newPassword.length < 12) {
      setNotice("Use a new password with at least 12 characters.");
      return;
    }

    if (password.newPassword !== password.confirmPassword) {
      setNotice("New passwords do not match.");
      return;
    }

    if (password.currentPassword === password.newPassword) {
      setNotice("Choose a password different from your current one.");
      return;
    }

    try {
      setSaving(true);

      await api.changePassword(
        password.currentPassword,
        password.newPassword
      );

      setPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setNotice("Password changed successfully.");
    } catch (error) {
      setNotice(
        error.message || "Unable to change password. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const passwordField = (label, name, placeholder) => (
    <div className="settings-field" key={name}>
      <label htmlFor={name}>{label}</label>
      <div className="settings-password-input">
        <input
          id={name}
          name={name}
          type={visible[name] ? "text" : "password"}
          value={password[name]}
          onChange={updatePasswordField}
          placeholder={placeholder}
          autoComplete={
            name === "currentPassword"
              ? "current-password"
              : "new-password"
          }
          required
        />
        <button
          type="button"
          className="settings-eye"
          aria-label={visible[name] ? "Hide password" : "Show password"}
          onClick={() =>
            setVisible((previous) => ({
              ...previous,
              [name]: !previous[name],
            }))
          }
        >
          {visible[name] ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <main className="settings-page">
      <header className="settings-heading">
        <div>
          <span className="settings-eyebrow">PERSONALIZE YOUR WORKSPACE</span>
          <h1>Settings</h1>
          <p>Manage your FixFlow appearance, preferences and account security.</p>
        </div>
        <div className="settings-heading-icon">
          <ShieldCheck size={28} />
        </div>
      </header>

      {notice && (
        <div className="settings-notice" role="status">
          {notice}
        </div>
      )}

      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-icon"><Palette size={21} /></div>
          <div>
            <h2>Appearance</h2>
            <p>Choose how FixFlow looks across your workspace.</p>
          </div>
        </div>

        <div className="settings-theme-options">
          {[
            { id: "dark", label: "Dark Mode", Icon: Moon },
            { id: "light", label: "Light Mode", Icon: Sun },
            { id: "system", label: "System Default", Icon: Monitor },
          ].map(({ id, label, Icon }) => (
            <button
              type="button"
              key={id}
              className={`settings-theme-option ${
                theme === id ? "selected" : ""
              }`}
              aria-pressed={theme === id}
              onClick={() => {
                setTheme(id);
                setNotice("");
              }}
            >
              <Icon size={23} />
              <span>{label}</span>
              {theme === id && <Check size={17} />}
            </button>
          ))}
        </div>

        <p className="settings-hint">
          Your selected theme applies across all FixFlow pages.
        </p>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-icon"><Bell size={21} /></div>
          <div>
            <h2>Notifications</h2>
            <p>Choose which updates you want to receive.</p>
          </div>
        </div>

        {[
          ["ticketUpdates", "Ticket updates", "Status changes and comments"],
          ["assignments", "Job assignments", "New assignments and job progress"],
          ["emailAlerts", "Email notifications", "Updates delivered to your email"],
        ].map(([key, title, description]) => (
          <div className="settings-toggle-row" key={key}>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifications[key]}
              aria-label={title}
              className={`settings-switch ${
                notifications[key] ? "active" : ""
              }`}
              onClick={() => toggleNotification(key)}
            >
              <span />
            </button>
          </div>
        ))}

        <div className="settings-actions">
          <button
            type="button"
            className="settings-primary-button"
            onClick={savePreferences}
          >
            <Save size={17} /> Save Preferences
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-icon"><LockKeyhole size={21} /></div>
          <div>
            <h2>Change Password</h2>
            <p>Keep your account protected with a strong password.</p>
          </div>
        </div>

        <form className="settings-password-form" onSubmit={changePassword}>
          {passwordField(
            "Current Password",
            "currentPassword",
            "Enter current password"
          )}
          {passwordField(
            "New Password",
            "newPassword",
            "Enter a strong new password"
          )}
          {passwordField(
            "Confirm New Password",
            "confirmPassword",
            "Re-enter new password"
          )}

          <p className="settings-hint">
            Use at least 12 characters. A unique passphrase is recommended.
          </p>

          <div className="settings-actions">
            <button
              type="submit"
              className="settings-primary-button"
              disabled={saving}
            >
              <ShieldCheck size={17} />
              {saving ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </section>

      <footer className="settings-footer">
        <UserRound size={16} />
        FixFlow · Maintenance made simple
      </footer>
    </main>
  );
}
