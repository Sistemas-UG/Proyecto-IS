import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid, // Nuevo icono para Dashboard
  GitFork,    // Nuevo icono para Mis Flujos
  PlusCircle,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Menu,
} from "lucide-react";
import { Logo, Avatar } from "./ui";
import { useAuth } from "../lib/AuthContext";

const NAV = [
  { to: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { to: "/flujos", icon: GitFork, label: "Mis Flujos" },
  { to: "/flujos/nuevo", icon: PlusCircle, label: "Crear Nuevo", adminOnly: true },
  { to: "/reportes", icon: BarChart3, label: "Reportes" },
  { to: "/configuracion", icon: Settings, label: "Configuración" },
];

function initialsFromName(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

export const TopBar = ({ title, subtitle, right }) => {
  const { user } = useAuth();
  const avatarUrl = user?.avatarUrl || localStorage.getItem("user_avatar");

  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-border dark:border-navyCard bg-white dark:bg-navy transition-colors">
      <div>
        <h1 className="text-lg font-semibold font-display text-ink dark:text-white">{title}</h1>
        {subtitle && <p className="text-xs mt-0.5 text-muted dark:text-faint font-body">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {right}
        <Bell size={18} className="text-muted dark:text-faint cursor-pointer hover:text-ink dark:hover:text-white transition-colors" />
        <Avatar initials={initialsFromName(user?.name || user?.username)} src={avatarUrl} size={34} />
      </div>
    </div>
  );
};

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  // Estado para la barra lateral (mantiene preferencia al navegar o recargar)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("smartflow_sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("smartflow_sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const visibleNav = NAV.filter((item) => !item.adminOnly || user?.role === "admin");

  return (
    <div className="w-full min-h-screen flex bg-bg dark:bg-navyDeep font-body transition-colors">
      {/* Sidebar Colapsable */}
      <aside
        className={`shrink-0 flex flex-col justify-between py-6 px-3 transition-all duration-300 ease-in-out relative z-20 bg-white dark:bg-navy border-r border-border dark:border-navyCard ${
          collapsed ? "w-[68px]" : "w-[220px]"
        }`}
      >
        <div>
          {/* Encabezado: Botón de 3 Líneas a la izquierda + Logo */}
          <div className={`flex items-center mb-8 gap-3 ${collapsed ? "justify-center flex-col" : "justify-start px-1"}`}>
            <button
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? "Expandir menú" : "Ocultar menú"}
              className="p-1.5 rounded-lg text-muted dark:text-faint hover:text-ink dark:hover:text-white hover:bg-bg dark:hover:bg-navyCard transition-colors cursor-pointer shrink-0"
            >
              <Menu size={18} />
            </button>

            {!collapsed && <Logo />}
          </div>

          {/* Menú de Opciones */}
          <nav className="flex flex-col gap-1">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-body transition-colors ${
                    isActive
                      ? "bg-blueSoft dark:bg-blue/20 text-blue dark:text-blue-400 font-semibold"
                      : "text-muted dark:text-faint hover:text-ink dark:hover:text-white hover:bg-bg dark:hover:bg-navyCard"
                  } ${collapsed ? "justify-center px-0" : ""}`
                }
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer / Logout */}
        <div>
          <div className="h-px mb-4 bg-border dark:bg-navyCard" />
          <button
            onClick={handleLogout}
            title={collapsed ? "Cerrar sesión" : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted dark:text-faint font-body cursor-pointer hover:text-ink dark:hover:text-white ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0 bg-bg dark:bg-navyDeep transition-colors overflow-hidden">
        {children}
      </div>
    </div>
  );
}