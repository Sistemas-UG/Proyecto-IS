import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  Sun,
  Moon,
  Monitor,
  Camera,
  X,
  ZoomIn,
  Building2,
  Plus,
  Trash2,
  CheckCircle2,
  Palette,
  Users,
  ShieldCheck,
  Layers,
  ChevronRight,
} from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import { Card, Avatar, Pill } from "../components/ui";
import { useAuth } from "../lib/AuthContext";
import { api } from "../lib/api";

function initialsFromName(name) {
  if (!name) return "US";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Colores de avatar para el equipo (clases completas para que Tailwind las genere)
const TEAM_TONES = ["bg-blue", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

// Encabezado reutilizable de cada tarjeta
const SectionHeader = ({ icon: Icon, title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-3 mb-5">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-[#5B5FEF] to-[#8B5CF6] shadow-md shadow-violet-500/20">
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <h2 className="text-sm font-semibold font-display text-ink dark:text-white leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted dark:text-faint font-body mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

export default function Configuracion() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const fileInputRef = useRef(null);

  // --- Organización: sector/industria + jerarquía real de roles ---
  // Contexto que se le pasa a la IA al generar flujos.
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState("");
  const [industria, setIndustria] = useState("");
  const [niveles, setNiveles] = useState([""]);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savedOrg, setSavedOrg] = useState(false);

  const fullName = user?.nombre_completo || user?.name || "Usuario";
  const username = user?.username || "usuario";

  const [avatarUrl, setAvatarUrl] = useState(() => {
    return localStorage.getItem("user_avatar") || user?.avatarUrl || "";
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = (selectedTheme) => {
      const isDark = selectedTheme === "dark" || (selectedTheme === "system" && systemQuery.matches);
      root.classList.toggle("dark", isDark);
    };

    applyTheme(theme);
    localStorage.setItem("theme", theme);

    const handleSystemChange = () => {
      if (theme === "system") applyTheme("system");
    };

    systemQuery.addEventListener("change", handleSystemChange);
    return () => systemQuery.removeEventListener("change", handleSystemChange);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    api
      .getUsers()
      .then((res) => !cancelled && setTeam(res.users))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyOrganization()
      .then((res) => {
        if (cancelled) return;
        const org = res.organization;
        setIndustria(org?.tipo_industria || "");
        setNiveles(org?.jerarquia?.length ? org.jerarquia : [""]);
      })
      .catch((err) => !cancelled && setOrgError(err.message || "No se pudo cargar la organización."))
      .finally(() => !cancelled && setOrgLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNivelChange = (idx, value) => {
    setSavedOrg(false);
    setNiveles((n) => n.map((v, i) => (i === idx ? value : v)));
  };

  const handleAddNivel = () => {
    setSavedOrg(false);
    setNiveles((n) => n.concat(""));
  };

  const handleRemoveNivel = (idx) => {
    setSavedOrg(false);
    setNiveles((n) => (n.length > 1 ? n.filter((_, i) => i !== idx) : n));
  };

  const handleGuardarOrganizacion = async () => {
    const jerarquiaLimpia = niveles.map((n) => n.trim()).filter(Boolean);
    if (jerarquiaLimpia.length === 0) {
      setOrgError('Agrega al menos un nivel de tu organización (ej. "Empleado").');
      return;
    }
    setSavingOrg(true);
    setOrgError("");
    try {
      await api.updateMyOrganization({ tipo_industria: industria.trim(), jerarquia: jerarquiaLimpia });
      setNiveles(jerarquiaLimpia);
      setSavedOrg(true);
    } catch (err) {
      setOrgError(err.message || "No se pudo guardar la organización.");
    } finally {
      setSavingOrg(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Image = reader.result;
      setAvatarUrl(base64Image);
      localStorage.setItem("user_avatar", base64Image);
    };
    reader.readAsDataURL(file);
  };

  // Miniaturas de vista previa de cada tema
  const themeOptions = [
    {
      id: "light",
      label: "Claro",
      icon: Sun,
      preview: (
        <div className="w-full h-full rounded-lg bg-slate-100 p-1.5 flex flex-col gap-1">
          <div className="h-1.5 w-8 rounded bg-slate-300" />
          <div className="flex-1 rounded bg-white border border-slate-200" />
        </div>
      ),
    },
    {
      id: "dark",
      label: "Oscuro",
      icon: Moon,
      preview: (
        <div className="w-full h-full rounded-lg bg-slate-900 p-1.5 flex flex-col gap-1">
          <div className="h-1.5 w-8 rounded bg-slate-600" />
          <div className="flex-1 rounded bg-slate-800 border border-slate-700" />
        </div>
      ),
    },
    {
      id: "system",
      label: "Sistema",
      icon: Monitor,
      preview: (
        <div className="w-full h-full rounded-lg overflow-hidden flex">
          <div className="w-1/2 bg-slate-100 p-1.5 flex flex-col gap-1">
            <div className="h-1.5 w-5 rounded bg-slate-300" />
            <div className="flex-1 rounded bg-white border border-slate-200" />
          </div>
          <div className="w-1/2 bg-slate-900 p-1.5 flex flex-col gap-1">
            <div className="h-1.5 w-5 rounded bg-slate-600" />
            <div className="flex-1 rounded bg-slate-800 border border-slate-700" />
          </div>
        </div>
      ),
    },
  ];

  const nivelesValidos = niveles.filter((n) => n.trim()).length;

  return (
    <AppShell>
      <TopBar title="Configuración" subtitle="Cuenta, equipo e integraciones." />

      <div className="flex-1 overflow-auto p-6 md:p-8 w-full max-w-6xl mx-auto font-body">
        {/* ===================== HERO DE PERFIL ===================== */}
        <Card className="overflow-hidden mb-6">
          {/* Banner con degradado de marca */}
          <div className="relative h-28 bg-gradient-to-r from-[#5B5FEF] via-[#7C5CF0] to-[#8B5CF6]">
            <div className="absolute -top-10 -left-6 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 right-10 w-56 h-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            />
          </div>

          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
              {/* Avatar con zoom */}
              <div
                className="relative group cursor-pointer shrink-0 w-fit rounded-full ring-4 ring-white dark:ring-navy shadow-xl"
                onClick={() => avatarUrl && setIsZoomOpen(true)}
                title={avatarUrl ? "Clic para ver en grande" : "Sin foto de perfil"}
              >
                <Avatar initials={initialsFromName(fullName)} src={avatarUrl} size={84} />
                {avatarUrl && (
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn size={20} className="text-white" />
                  </div>
                )}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

              <div className="flex-1 min-w-0 sm:pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-ink dark:text-white font-display leading-tight truncate">
                    {fullName}
                  </h3>
                  <Pill tone={isAdmin ? "blue" : "gray"} icon={isAdmin ? ShieldCheck : undefined}>
                    {isAdmin ? "Administrador" : "Usuario"}
                  </Pill>
                </div>
                <p className="text-xs text-muted dark:text-faint font-body mt-0.5">@{username}</p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 text-xs font-semibold font-body px-4 py-2.5 rounded-xl border border-border dark:border-navyCard text-ink dark:text-white hover:bg-bg dark:hover:bg-navyCard transition-colors cursor-pointer w-fit"
              >
                <Camera size={14} /> Cambiar foto
              </button>
            </div>

            {/* Datos rápidos */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { icon: ShieldCheck, label: "Rol", value: isAdmin ? "Admin" : "Usuario" },
                { icon: Layers, label: "Niveles", value: orgLoading ? "—" : nivelesValidos },
                { icon: Users, label: "Equipo", value: loading ? "—" : team.length },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-border dark:border-navyCard bg-bg/60 dark:bg-navyDeep/50 px-3.5 py-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-blueSoft dark:bg-blue/20 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-blue dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted dark:text-faint font-body">{label}</p>
                    <p className="text-sm font-bold text-ink dark:text-white font-display truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ===================== GRID PRINCIPAL ===================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* -------- Columna izquierda: Organización -------- */}
          <Card className="lg:col-span-7 p-6">
            <SectionHeader
              icon={Building2}
              title="Organización"
              subtitle='Contexto real que usa la IA al generar flujos: solo usará los roles que definas aquí (si no tienes "Gerente" o "Junta Directiva", no aparecerán) y adaptará el vocabulario a tu sector.'
            />

            {orgLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted dark:text-faint font-body">
                <Loader2 size={13} className="animate-spin" /> Cargando organización…
              </div>
            ) : (
              <>
                <label className="text-xs font-semibold text-ink dark:text-white font-body mb-1.5 block">
                  Sector / tipo de empresa
                </label>
                {isAdmin ? (
                  <input
                    value={industria}
                    onChange={(e) => {
                      setIndustria(e.target.value);
                      setSavedOrg(false);
                    }}
                    placeholder='Ej. "Restaurante", "Clínica dental", "Software", "Retail"…'
                    className="w-full text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navyDeep px-3.5 py-2.5 text-ink dark:text-white font-body outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 mb-6 transition-all"
                  />
                ) : (
                  <p className="text-sm text-ink dark:text-white font-body mb-6">{industria || "Sin definir"}</p>
                )}

                <div className="flex items-baseline justify-between mb-3">
                  <label className="text-xs font-semibold text-ink dark:text-white font-body block">
                    Jerarquía de roles
                  </label>
                  <span className="text-[10px] text-muted dark:text-faint font-body">De menor a mayor autoridad</span>
                </div>

                {isAdmin ? (
                  <>
                    <div className="mb-4">
                      {niveles.map((nivel, idx) => (
                        <div key={idx} className="relative flex items-center gap-3 pb-3 last:pb-0">
                          {/* Línea que conecta los niveles */}
                          {idx < niveles.length - 1 && (
                            <span className="absolute left-[13px] top-8 -bottom-1 w-px bg-border dark:bg-navyCard" />
                          )}

                          <span className="relative z-10 w-7 h-7 rounded-full bg-gradient-to-br from-[#5B5FEF] to-[#8B5CF6] text-white text-[11px] font-bold font-display flex items-center justify-center shrink-0 shadow-md shadow-violet-500/20">
                            {idx + 1}
                          </span>

                          <input
                            value={nivel}
                            onChange={(e) => handleNivelChange(idx, e.target.value)}
                            placeholder={idx === 0 ? "Ej. Empleado" : "Ej. Dueño del negocio"}
                            className="flex-1 text-sm rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navyDeep px-3.5 py-2 text-ink dark:text-white font-body outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
                          />

                          <button
                            type="button"
                            onClick={() => handleRemoveNivel(idx)}
                            disabled={niveles.length <= 1}
                            title="Quitar nivel"
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-red border border-red/20 bg-redSoft dark:bg-red/10 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity cursor-pointer shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {orgError && (
                      <p className="text-xs text-red font-body mb-3 rounded-lg bg-redSoft dark:bg-red/10 border border-red/20 px-3 py-2">
                        {orgError}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border dark:border-navyCard">
                      <button
                        type="button"
                        onClick={handleAddNivel}
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue border border-blue/30 rounded-xl px-3.5 py-2.5 font-body bg-blueSoft dark:bg-blue/10 hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <Plus size={14} /> Agregar nivel
                      </button>

                      <button
                        type="button"
                        onClick={handleGuardarOrganizacion}
                        disabled={savingOrg}
                        className={`ml-auto flex items-center justify-center gap-2 text-xs font-semibold text-white rounded-xl px-5 py-2.5 font-body disabled:opacity-70 transition-all cursor-pointer shadow-md active:scale-[0.98] ${
                          savedOrg
                            ? "bg-green dark:bg-emerald-600 shadow-green/20"
                            : "bg-gradient-to-r from-[#5B5FEF] to-[#8B5CF6] hover:opacity-90 shadow-violet-500/25"
                        }`}
                      >
                        {savingOrg ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Guardando…
                          </>
                        ) : savedOrg ? (
                          <>
                            <CheckCircle2 size={13} /> Guardado
                          </>
                        ) : (
                          "Guardar organización"
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {niveles.filter(Boolean).map((nivel, idx, arr) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Pill tone="blue">{nivel}</Pill>
                        {idx < arr.length - 1 && <ChevronRight size={13} className="text-faint" />}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* -------- Columna derecha: Apariencia + Equipo -------- */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Apariencia */}
            <Card className="p-6">
              <SectionHeader
                icon={Palette}
                title="Apariencia"
                subtitle="Elige el tema de la interfaz o sincronízalo con tu sistema operativo."
              />

              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map(({ id, label, icon: Icon, preview }) => {
                  const isActive = theme === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setTheme(id)}
                      type="button"
                      className={`group flex flex-col gap-2 p-2 rounded-xl border text-xs font-medium font-body transition-all cursor-pointer ${
                        isActive
                          ? "border-blue bg-blueSoft dark:bg-blue/15 ring-2 ring-blue/30 text-blue dark:text-white font-semibold"
                          : "border-border dark:border-navyCard text-muted dark:text-faint hover:border-blue/50 hover:text-ink dark:hover:text-white"
                      }`}
                    >
                      <div className="h-14 w-full">{preview}</div>
                      <div className="flex items-center justify-center gap-1.5 pb-0.5">
                        <Icon size={13} />
                        <span>{label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Equipo */}
            <Card className="p-6">
              <SectionHeader
                icon={Users}
                title="Equipo"
                subtitle="Roles y permisos vienen del backend."
                right={
                  !loading && (
                    <span className="text-[11px] font-semibold font-body px-2.5 py-1 rounded-full bg-blueSoft dark:bg-blue/20 text-blue dark:text-blue-400 shrink-0">
                      {team.length} {team.length === 1 ? "miembro" : "miembros"}
                    </span>
                  )
                }
              />

              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted dark:text-faint font-body">
                  <Loader2 size={13} className="animate-spin" /> Cargando equipo…
                </div>
              )}
              {error && <p className="text-xs text-red font-body">Error: {error}</p>}

              <div className="flex flex-col divide-y divide-border dark:divide-navyCard">
                {team.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar
                      initials={initialsFromName(m.name)}
                      tone={TEAM_TONES[i % TEAM_TONES.length]}
                      size={36}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink dark:text-white font-body truncate">{m.name}</p>
                    </div>
                    <Pill tone={m.role === "admin" ? "blue" : "gray"} icon={m.role === "admin" ? ShieldCheck : undefined}>
                      {m.role}
                    </Pill>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de Zoom de la Foto */}
      {isZoomOpen && avatarUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 transition-all"
          onClick={() => setIsZoomOpen(false)}
        >
          <div className="relative max-w-sm w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsZoomOpen(false)}
              className="absolute -top-12 right-0 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <img
              src={avatarUrl}
              alt="Foto de perfil ampliada"
              className="w-72 h-72 sm:w-80 sm:h-80 rounded-2xl object-cover shadow-2xl border-2 border-white/20"
            />

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => {
                  setIsZoomOpen(false);
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue text-white text-xs font-semibold font-body hover:bg-blue/90 transition-colors cursor-pointer"
              >
                <Camera size={14} /> Cambiar foto
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}