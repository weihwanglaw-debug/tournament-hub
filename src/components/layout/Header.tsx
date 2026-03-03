import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import config from "@/data/config.json";
import { LogOut, ChevronDown, Sun, Moon, Trophy } from "lucide-react";

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6"
      style={{ background: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 font-heading font-bold text-xl">
        {config.branding.logoUrl ? (
          <img src={config.branding.logoUrl} alt={config.branding.appName} className="h-8" />
        ) : (
          <Trophy className="h-6 w-6" />
        )}
        <span>{config.branding.appName}</span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Toggle theme"
        >
          {theme === "a" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        {!isAuthenticated ? (
          <Link
            to="/login"
            className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Login
          </Link>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
            >
              {user?.name}
              <ChevronDown className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg py-1 z-50"
                style={{ background: "var(--color-page-bg)", color: "var(--color-body-text)" }}
              >
                {config.nav.menuItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm hover:bg-black/5 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
                <hr className="my-1" style={{ borderColor: "var(--color-table-border)" }} />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 transition-colors flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
