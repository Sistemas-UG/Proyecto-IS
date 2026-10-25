import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, AtSign, ArrowRight, Loader2, AlertCircle, CheckCircle2, Sun, Moon, Eye, EyeOff, TrendingUp, Users, Layers } from "lucide-react";
import { Logo } from "../components/ui";
import { useAuth } from "../lib/AuthContext";
import loginBgDark from "../assets/login-bg-dark.png";
import loginBgLight from "../assets/login-bg-light.png";

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [resetNotice, setResetNotice] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Modo oscuro/claro: mismo mecanismo (localStorage "theme") que usa el
  // resto de la app en Configuración, para que el cambio sea consistente.
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    setIsDark(next === "dark");
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleForgotPassword = (e) => {
    e.preventDefault(); setError(""); setResetNotice(false); setForgotMode(true);
  };

  const handleRequestReset = async (e) => {
    e.preventDefault(); setError(""); setResetNotice(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Ingresa un correo electrónico válido."); return; }
    try { setSubmitting(true); await (await import("../lib/api")).api.requestPasswordReset(email.trim()); setResetNotice(true); }
    catch (err) { setError(err.message || "No se pudo procesar la solicitud. Inténtalo de nuevo."); }
    finally { setSubmitting(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isRegistering) {
      if (!email || !password) {
        setError("Ingresa tu usuario/correo y contraseña.");
        return;
      }
    } else {
      if (!nombreCompleto || !username || !email || !password) {
        setError("Por favor completa los 4 campos requeridos.");
        return;
      }
    }

    try {
      setSubmitting(true);
      if (isRegistering) {
        await register({
          nombre_completo: nombreCompleto,
          username,
          email,
          password,
        });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err?.message || "Ocurrió un error al procesar tu solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setError(""); setResetNotice(false); setForgotMode(false); setIsRegistering(!isRegistering);
  };

  const FEATURES = [
    { icon: TrendingUp, title: "Más productividad", text: "Reduce tareas repetitivas." },
    { icon: Users, title: "Mejores resultados", text: "Conecta personas y procesos." },
    { icon: Layers, title: "Todo en un solo lugar", text: "Simple, intuitivo y seguro." },
  ];

  return (
    <div
      className="w-full min-h-screen relative flex flex-col lg:flex-row font-body bg-cover bg-center transition-colors"
      style={{ backgroundImage: `url(${isDark ? loginBgDark : loginBgLight})` }}
    >
      {/* Overlay para legibilidad del texto sobre la imagen */}
      <div className="absolute inset-0 bg-gradient-to-r from-navyDeep/80 via-navyDeep/45 to-navyDeep/15 lg:to-navyDeep/5 pointer-events-none" />

      {/* Botón de tema, solo en pantallas pequeñas (en grande vive abajo del panel izquierdo) */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        title={isDark ? "Modo claro" : "Modo oscuro"}
        className="lg:hidden absolute top-5 right-5 z-20 w-10 h-10 flex items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur text-white shadow-soft hover:border-blue transition-colors cursor-pointer"
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* Izquierda: Branding sobre la imagen */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[46%] shrink-0 flex-col justify-between p-12 xl:p-16 z-10">
        <Logo light />

        <div className="max-w-md" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}>
          <h1 className="text-4xl font-bold font-display mt-3 mb-4 leading-tight text-white">
            Automatiza tus procesos, impulsa tu equipo
          </h1>
          <p className="text-sm text-white/80 leading-relaxed font-body mb-8">
            Crea, gestiona y optimiza tus procesos de trabajo de forma simple, rápida y eficiente.
          </p>
          <div className="space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/15 text-white" style={{ textShadow: "none" }}>
                  <f.icon size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white font-display">{f.title}</p>
                  <p className="text-xs text-white/70 font-body">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title={isDark ? "Modo claro" : "Modo oscuro"}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur text-white shadow-soft hover:border-blue transition-colors cursor-pointer self-start"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      {/* Derecha: centra la tarjeta en el espacio restante, para que quede simétrica */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-5 lg:p-10">
        <div className="w-full max-w-md lg:translate-x-10 xl:translate-x-16 bg-white dark:bg-navyCard rounded-3xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 dark:border dark:border-white/10 p-10 transition-colors">
          <div className="lg:hidden flex justify-center mb-6">
            <Logo />
          </div>
          <div className="w-full">
            <h2 className="text-2xl font-bold text-center text-ink dark:text-white font-display mb-1">
              Bienvenido a SMARTFLOW
            </h2>
            <p className="text-sm font-medium text-center text-muted dark:text-faint font-body mb-7">
              {forgotMode ? "Te enviaremos un enlace para crear una contraseña nueva." : isRegistering
                ? "Ingresa tus datos para registrarte en el sistema."
                : "Inicia sesión para continuar"}
            </p>

          {forgotMode ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="relative"><Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-faint"/><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navyDeep text-ink dark:text-white outline-none focus:border-blue"/></div>
              {resetNotice && <div role="status" className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs"><CheckCircle2 size={16}/><span>Si existe una cuenta asociada, recibirás instrucciones por correo.</span></div>}
              {error && <div role="alert" className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs"><AlertCircle size={16}/><span>{error}</span></div>}
              <button type="submit" disabled={submitting} className="w-full py-3 px-4 rounded-xl bg-blue hover:opacity-90 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">{submitting ? <Loader2 size={16} className="animate-spin"/> : <Mail size={16}/>} Enviar instrucciones</button>
              <button type="button" onClick={() => { setForgotMode(false); setError(""); setResetNotice(false); }} className="w-full text-xs text-muted dark:text-faint hover:text-blue underline">Volver al inicio de sesión</button>
            </form>
          ) : <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-faint" />
                <input
                  type="text"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navyDeep text-ink dark:text-white outline-none focus:border-blue transition-colors"
                />
              </div>
            )}

            {isRegistering && (
              <div className="relative">
                <AtSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-faint" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                  placeholder="Nombre de usuario"
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navyDeep text-ink dark:text-white outline-none focus:border-blue transition-colors"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-faint" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegistering ? "Correo electrónico" : "Usuario o correo electrónico"}
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navyDeep text-ink dark:text-white outline-none focus:border-blue transition-colors"
              />
            </div>

            {/* Campo Contraseña con Botón de Mostrar/Ocultar */}
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-faint" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full pl-10 pr-10 py-3 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navyDeep text-ink dark:text-white outline-none focus:border-blue transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-faint hover:text-ink dark:hover:text-white transition-colors cursor-pointer"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {!isRegistering && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-muted dark:text-faint cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-border dark:border-navyCard text-blue"
                  />
                  <span>Recordarme</span>
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-blue hover:underline font-medium cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {resetNotice && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>Enlace enviado a tu correo.</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-blue hover:opacity-90 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-soft disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <span>{isRegistering ? "Registrarme" : "Entrar al panel"}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>}

          {!forgotMode && <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-xs text-muted dark:text-faint hover:text-blue transition-colors underline cursor-pointer"
            >
              {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Crea una aquí"}
            </button>
          </div>}
        </div>
      </div>
      </div>
    </div>
  );
}