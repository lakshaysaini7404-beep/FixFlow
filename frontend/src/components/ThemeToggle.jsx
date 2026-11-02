
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import "./ThemeToggle.css";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className={`theme-toggle ${isLight ? "is-light" : "is-dark"}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${isLight ? "dark" : "light"} theme`}
      title={`Switch to ${isLight ? "dark" : "light"} theme`}
      aria-pressed={isLight}
    >
        <Moon className="theme-icon moon-icon" size={18} />
      <Sun className="theme-icon sun-icon" size={18} />

      

      <span className="theme-toggle-thumb" />
    </button>
  );
}
