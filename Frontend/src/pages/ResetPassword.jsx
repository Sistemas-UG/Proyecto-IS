import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Logo } from "../components/ui";
import { api } from "../lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams(); const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(""); const [success, setSuccess] = useState(false); const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (!token) return setError("El enlace no contiene un token válido. Solicita uno nuevo.");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    try { setLoading(true); await api.resetPassword(token, password); setSuccess(true); }
    catch (err) { setError(err.message || "El enlace expiró o ya fue utilizado. Solicita uno nuevo."); }
    finally { setLoading(false); }
  };
  return <div className="min-h-screen flex items-center justify-center bg-bg dark:bg-navyDeep p-6"><div className="w-full max-w-md rounded-2xl border border-border dark:border-navyCard bg-white dark:bg-navy p-8 shadow-xl"><div className="mb-8 flex justify-center"><Logo/></div><h1 className="text-xl font-bold text-center text-ink dark:text-white">Restablecer contraseña</h1><p className="mt-2 mb-6 text-center text-sm text-muted dark:text-faint">Elige una contraseña nueva para tu cuenta.</p>{success ? <div role="status" className="space-y-4 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={32}/><p className="text-sm text-ink dark:text-white">Tu contraseña se actualizó correctamente.</p><button onClick={() => navigate("/", {replace:true})} className="w-full rounded-xl bg-blue p-3 text-sm font-semibold text-white">Volver al inicio de sesión</button></div> : <form onSubmit={submit} className="space-y-4"><div className="relative"><Lock size={16} className="absolute left-3 top-3 text-muted"/><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nueva contraseña" className="w-full rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navy py-2.5 pl-10 pr-3 text-sm text-ink dark:text-white outline-none focus:border-blue"/></div><div className="relative"><Lock size={16} className="absolute left-3 top-3 text-muted"/><input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirmar contraseña" className="w-full rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navy py-2.5 pl-10 pr-3 text-sm text-ink dark:text-white outline-none focus:border-blue"/></div>{error && <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-500"><AlertCircle size={16}/>{error}</p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue p-3 text-sm font-semibold text-white disabled:opacity-50">{loading && <Loader2 size={16} className="animate-spin"/>}Guardar contraseña</button><p className="text-center text-xs text-muted"><Link to="/" className="text-blue underline">Volver al inicio de sesión</Link></p></form>}</div></div>;
}
