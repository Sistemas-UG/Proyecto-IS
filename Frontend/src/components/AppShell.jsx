import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  GitFork,
  PlusCircle,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Menu,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCheck,
  BellOff,
} from "lucide-react";
import { Logo, Avatar } from "./ui";
import { useAuth } from "../lib/AuthContext";
import { enrichFlows, applyStatusOverrides, touchFlow } from "../lib/flowlogic";

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

// ---------------------------------------------------------------------
// Notificaciones (se calculan con los flujos guardados en caché)
// ---------------------------------------------------------------------
const READ_KEY = "smartflow_notif_read";

const readReadIds = () => {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY)) || [];
  } catch {
    return [];
  }
};

const buildNotifications = () => {
  let cached = [];
  try {
    cached = JSON.parse(localStorage.getItem("smartflow_cached_flows")) || [];
  } catch {
    cached = [];
  }

  const flows = enrichFlows(applyStatusOverrides(cached)).filter((f) => f.estado === "Activo");
  const list = [];

  flows.forEach((f) => {
    if (f.estadoLabel === "Inactivo") {
      list.push({
        key: `inactivo-${f.id}`,
        flowId: f.id,
        tipo: "inactivo",
        titulo: "Flujo inactivo",
        texto: `"${f.nombre}" lleva ${f.diasSinActividad} días sin actividad.`,
        orden: 0,
      });
    } else if (f.estadoLabel === "Requiere atención") {
      list.push({
        key: `atencion-${f.id}`,
        flowId: f.id,
        tipo: "atencion",
        titulo: "Requiere atención",
        texto: `"${f.nombre}" lleva ${f.diasSinActividad} días sin movimiento.`,
        orden: 1,
      });
    } else if (f.diasSinActividad <= 1) {
      list.push({
        key: `nuevo-${f.id}`,
        flowId: f.id,
        tipo: "nuevo",
        titulo: "Flujo nuevo",
        texto: `"${f.nombre}" se creó recientemente (${f.pasos} pasos).`,
        orden: 2,
      });
    }
  });

  return list.sort((a, b) => a.orden - b.orden).slice(0, 8);
};

const NOTIF_STYLE = {
  inactivo: { icon: AlertTriangle, box: "bg-redSoft dark:bg-red/15 text-red" },
  atencion: { icon: Clock, box: "bg-amberSoft dark:bg-amber/15 text-amber dark:text-amber-400" },
  nuevo: { icon: Sparkles, box: "bg-blueSoft dark:bg-blue/20 text-blue dark:text-blue-400" },
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState(() => buildNotifications());
  const [readIds, setReadIds] = useState(() => readReadIds());
  const ref = useRef(null);

  const refresh = () => setNotifs(buildNotifications());

  // Refresca al montar, cada 30 s y cuando otra pestaña cambia los datos
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    const onStorage = (e) => {
      if (!e.key || e.key.startsWith("smartflow_")) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(t);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Cierra con clic afuera o Esc
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const saveRead = (ids) => {
    setReadIds(ids);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch {
      /* noop */
    }
  };

  const unread = useMemo(() => notifs.filter((n) => !readIds.includes(n.key)), [notifs, readIds]);

  const toggleOpen = () => {
    if (!open) refresh();
    setOpen((v) => !v);
  };

  const markAllRead = () => saveRead(Array.from(new Set([...readIds, ...notifs.map((n) => n.key)])));

  const handleClickNotif = (n) => {
    if (!readIds.includes(n.key)) saveRead([...readIds, n.key]);
    touchFlow(n.flowId);
    setOpen(false);
    navigate(`/flujos/${n.flowId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        title="Notificaciones"
        aria-label="Notificaciones"
        className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
          open
            ? "bg-bg dark:bg-navyCard text-ink dark:text-white"
            : "text-muted dark:text-faint hover:text-ink dark:hover:text-white hover:bg-bg dark:hover:bg-navyCard"
        }`}
      >
        <Bell size={18} />
        {unread.length > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[9px] font-bold font-body flex items-center justify-center ring-2 ring-white dark:ring-navy">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[90vw] z-50 rounded-2xl border border-border dark:border-navyCard bg-white dark:bg-navy shadow-2xl overflow-hidden">
          {/* Encabezado */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-navyCard">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold font-display text-ink dark:text-white">Notificaciones</h3>
              {unread.length > 0 && (
                <span className="text-[10px] font-bold font-body px-1.5 py-0.5 rounded-full bg-blueSoft dark:bg-blue/20 text-blue dark:text-blue-400">
                  {unread.length} nuevas
                </span>
              )}
            </div>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue dark:text-blue-400 font-body hover:underline cursor-pointer"
              >
                <CheckCheck size={13} /> Marcar todo como leído
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center px-6 py-10">
                <div className="w-10 h-10 rounded-full bg-bg dark:bg-navyCard flex items-center justify-center mb-3">
                  <BellOff size={18} className="text-muted dark:text-faint" />
                </div>
                <p className="text-sm font-semibold text-ink dark:text-white font-body">Todo al día</p>
                <p className="text-xs text-muted dark:text-faint font-body mt-0.5">No tienes notificaciones.</p>
              </div>
            ) : (
              notifs.map((n) => {
                const { icon: Icon, box } = NOTIF_STYLE[n.tipo];
                const isRead = readIds.includes(n.key);
                return (
                  <button
                    key={n.key}
                    type="button"
                    onClick={() => handleClickNotif(n)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-bg dark:hover:bg-navyCard/60 transition-colors border-b border-border/60 dark:border-navyCard/60 last:border-b-0 cursor-pointer"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${box}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-body ${
                          isRead ? "font-medium text-muted dark:text-faint" : "font-semibold text-ink dark:text-white"
                        }`}
                      >
                        {n.titulo}
                      </p>
                      <p className="text-[11px] text-muted dark:text-faint font-body mt-0.5 leading-snug">{n.texto}</p>
                    </div>
                    {!isRead && <span className="w-2 h-2 rounded-full bg-blue shrink-0 mt-1.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------
export const TopBar = ({ title, subtitle, right }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const avatarUrl = user?.avatarUrl || localStorage.getItem("user_avatar");

  return (
    <div className="relative z-30 flex items-center justify-between px-8 py-5 border-b border-border dark:border-navyCard bg-white dark:bg-navy transition-colors">
      <div>
        <h1 className="text-lg font-semibold font-display text-ink dark:text-white">{title}</h1>
        {subtitle && <p className="text-xs mt-0.5 text-muted dark:text-faint font-body">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {right}

        <NotificationBell />

        {/* Avatar: lleva a Configuración */}
        <button
          type="button"
          onClick={() => navigate("/configuracion")}
          title="Ir a Configuración"
          aria-label="Ir a Configuración"
          className="rounded-full cursor-pointer transition-all hover:ring-2 hover:ring-blue/40 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          <Avatar initials={initialsFromName(user?.name || user?.username)} src={avatarUrl} size={34} />
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------
export default function AppShell({ children }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

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

  const menuButton = (
    <button
      type="button"
      onClick={toggleSidebar}
      title={collapsed ? "Expandir menú" : "Ocultar menú"}
      className="p-1.5 rounded-lg text-muted dark:text-faint hover:text-ink dark:hover:text-white hover:bg-bg dark:hover:bg-navyCard transition-colors cursor-pointer shrink-0"
    >
      <Menu size={18} />
    </button>
  );

  return (
    <div className="w-full min-h-screen flex bg-bg dark:bg-navyDeep font-body transition-colors">
      {/* Sidebar Colapsable */}
      <aside
        className={`shrink-0 flex flex-col justify-between py-6 px-3 transition-all duration-300 ease-in-out relative z-20 bg-white dark:bg-navy border-r border-border dark:border-navyCard overflow-hidden ${
          collapsed ? "w-[68px]" : "w-[240px]"
        }`}
      >
        <div>
          {/* Abierto: botón de 3 líneas a la izquierda + logo completo
              Colapsado: solo el botón de menú, sin logo */}
          {collapsed ? (
            <div className="flex justify-center mb-8 w-full">{menuButton}</div>
          ) : (
            <div className="flex items-center gap-2 mb-8 w-full px-1">
              {menuButton}
              <Logo size="md" />
            </div>
          )}

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