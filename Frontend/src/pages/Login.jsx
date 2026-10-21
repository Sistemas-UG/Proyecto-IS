import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, AtSign, ArrowRight, Loader2, AlertCircle, CheckCircle2, Sun, Moon, Eye, EyeOff } from "lucide-react";
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

  return (
    <div className="w-full min-h-screen flex bg-bg dark:bg-navyDeep transition-colors font-body">
      {/* Izquierda: Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 transition-colors bg-cover bg-center"
        style={{ backgroundImage: `url(${isDark ? loginBgDark : loginBgLight})` }}
      >
        <Logo />
        <div className="max-w-md">
          <span className="text-xs font-semibold tracking-wider text-blue uppercase font-body">
            Automatización de procesos • PyMEs
          </span>
          <h1 className="text-3xl font-bold font-display mt-3 mb-4 leading-tight text-ink dark:text-white">
            Diseña y automatiza procesos en minutos, no en semanas.
          </h1>
          <p className="text-sm text-muted dark:text-faint leading-relaxed font-body">
            Describe tu proceso en lenguaje natural. SmartFlow AI genera el flujo y detecta
            cuellos de botella.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title={isDark ? "Modo claro" : "Modo oscuro"}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-border dark:border-navyCard bg-white/70 dark:bg-navy/70 backdrop-blur text-ink dark:text-white shadow-soft hover:border-blue transition-colors cursor-pointer self-start"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      {/* Derecha: Formulario */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-white dark:bg-navyDeep transition-colors">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-center text-ink dark:text-white font-display mb-1">
            {forgotMode ? "Recuperar contraseña" : isRegistering ? "Crear una cuenta nueva" : "Bienvenido de nuevo"}
          </h2>
          <p className="text-xs font-medium text-center text-muted dark:text-faint font-body mb-6">
            {forgotMode ? "Te enviaremos un enlace para crear una contraseña nueva." : isRegistering
              ? "Ingresa tus datos para registrarte en el sistema."
              : "Accede con tu nombre de usuario o correo electrónico."}
          </p>

          {forgotMode ? (
            <form onSubmit={handleRequestReset} className="space-y-3.5">
              <div className="relative"><Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-faint"/><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navy text-ink dark:text-white outline-none focus:border-blue"/></div>
              {resetNotice && <div role="status" className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs"><CheckCircle2 size={16}/><span>Si existe una cuenta asociada, recibirás instrucciones por correo.</span></div>}
              {error && <div role="alert" className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs"><AlertCircle size={16}/><span>{error}</span></div>}
              <button type="submit" disabled={submitting} className="w-full py-3 px-4 rounded-xl bg-blue hover:opacity-90 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">{submitting ? <Loader2 size={16} className="animate-spin"/> : <Mail size={16}/>} Enviar instrucciones</button>
              <button type="button" onClick={() => { setForgotMode(false); setError(""); setResetNotice(false); }} className="w-full text-xs text-muted dark:text-faint hover:text-blue underline">Volver al inicio de sesión</button>
            </form>
          ) : <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegistering && (
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-faint" />
                <input
                  type="text"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navy text-ink dark:text-white outline-none focus:border-blue transition-colors"
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
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navy text-ink dark:text-white outline-none focus:border-blue transition-colors"
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
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navy text-ink dark:text-white outline-none focus:border-blue transition-colors"
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
                className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navy text-ink dark:text-white outline-none focus:border-blue transition-colors"
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
  );
}