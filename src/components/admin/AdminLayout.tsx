import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  GitBranch,
  LogOut,
  Trophy,
} from "lucide-react";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/events", label: "Events & Programs", icon: CalendarDays },
  { to: "/admin/registrations", label: "Registrations", icon: Users },
  { to: "/admin/fixtures", label: "Fixtures", icon: GitBranch },
];

export default function AdminLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate("/login", { replace: true });
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen pt-16">
      {/* Sidebar */}
      <aside
        className="w-60 fixed top-16 bottom-0 flex flex-col py-6 px-3 overflow-y-auto"
        style={{ background: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}
      >
        <div className="flex items-center gap-2 px-3 mb-6">
          <Trophy className="h-5 w-5" />
          <span className="font-heading font-bold text-sm">Admin Panel</span>
        </div>

        <nav className="flex-1 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-white/15" : "hover:bg-white/10"
                }`
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-3">
          <p className="text-xs opacity-60 mb-2">{user?.name}</p>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="flex items-center gap-2 text-sm hover:bg-white/10 px-3 py-2 rounded-lg w-full transition-colors"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 p-8" style={{ backgroundColor: "var(--color-page-bg)" }}>
        <Outlet />
      </main>
    </div>
  );
}
