import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import {
  LayoutDashboard, CalendarDays, Users, GitBranch,
  LogOut, Trophy, Shield, Settings,
} from "lucide-react";

export default function AdminLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === "superadmin";

  useEffect(() => {
    if (!isAuthenticated) navigate("/login", { replace: true });
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  const links = [
    { to: "/admin",                label: "Dashboard",          icon: LayoutDashboard, end: true },
    { to: "/admin/events",         label: "Events & Programs",  icon: CalendarDays,    end: false },
    { to: "/admin/registrations",  label: "Registrations",      icon: Users,           end: false },
    { to: "/admin/fixtures",       label: "Fixtures",           icon: GitBranch,       end: false },
    ...(isSuperAdmin ? [
      { to: "/admin/users",  label: "User Management",    icon: Shield,    end: false },
      { to: "/admin/config", label: "Master Config",      icon: Settings,  end: false },
    ] : []),
  ];

  return (
    <div className="flex min-h-screen pt-16">
      <aside
        className="w-60 fixed top-16 bottom-0 flex flex-col py-8 px-4 overflow-y-auto"
        style={{ background: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}
      >
        <div className="flex items-center gap-2 px-3 mb-8">
          <Trophy className="h-5 w-5" />
          <span className="font-bold text-sm">Admin Panel</span>
        </div>

        <nav className="flex-1 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors ${
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
          <p className="text-xs opacity-60 mb-1">{user?.name}</p>
          <p className="text-xs opacity-40 mb-3 capitalize">{user?.role}</p>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="flex items-center gap-2 text-sm hover:bg-white/10 px-3 py-2.5 w-full transition-colors"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-60 p-10" style={{ backgroundColor: "var(--color-page-bg)" }}>
        <Outlet />
      </main>
    </div>
  );
}