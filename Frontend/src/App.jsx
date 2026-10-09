import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import MisFlujos from "./pages/MisFlujos";
import VerFlujo from "./pages/VerFlujo";
import CrearFlujo from "./pages/CrearFlujo";
import Reportes from "./pages/Reportes";
import Configuracion from "./pages/Configuracion";

// allowedRoles opcional: si se pasa, además de estar logueado, el usuario debe
// tener uno de esos roles. Ej: <ProtectedRoute allowedRoles={["admin"]}>
// Así un usuario normal que escriba /flujos/nuevo directo en la URL es
// redirigido, no solo se le esconde el botón en el menú.
function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-bg dark:bg-navyDeep transition-colors">
        <p className="text-sm text-muted dark:text-faint font-body">Cargando…</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/" replace />;

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/restablecer-contrasena" element={<ResetPassword />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/flujos" element={<ProtectedRoute><MisFlujos /></ProtectedRoute>} />
      <Route path="/flujos/:id" element={<ProtectedRoute><VerFlujo /></ProtectedRoute>} />
      <Route
        path="/flujos/nuevo"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <CrearFlujo />
          </ProtectedRoute>
        }
      />
      <Route path="/reportes" element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  // Sincronización global con el tema del sistema operativo y localStorage
  useEffect(() => {
    const root = document.documentElement;
    const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateTheme = () => {
      const savedTheme = localStorage.getItem("theme") || "system";
      const isDark =
        savedTheme === "dark" ||
        (savedTheme === "system" && systemQuery.matches);
      root.classList.toggle("dark", isDark);
    };

    updateTheme();
    systemQuery.addEventListener("change", updateTheme);
    return () => systemQuery.removeEventListener("change", updateTheme);
  }, []);

  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  );
}