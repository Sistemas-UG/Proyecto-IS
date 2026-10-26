// Ícono vectorial SVG: "S" Flujo Inteligente con red de nodos
const LogoMark = ({ size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0"
  >
    <defs>
      <linearGradient id="sfMainGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#A855F7" />
        <stop offset="50%" stopColor="#5B5FEF" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>

      <linearGradient id="sfSecondaryGrad" x1="20" y1="80" x2="80" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#C084FC" />
        <stop offset="100%" stopColor="#818CF8" />
      </linearGradient>
    </defs>

    <g>
      {/* S Ribbon - Trazo secundario de fondo */}
      <path
        d="M 24 74 C 12 56, 32 38, 54 32 C 70 28, 80 20, 74 12 C 68 6, 54 10, 44 16"
        stroke="url(#sfSecondaryGrad)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* S Ribbon - Cuerpo Principal del Flujo */}
      <path
        d="M 20 78 C 8 58, 28 34, 52 28 C 72 23, 82 16, 75 9"
        stroke="url(#sfMainGrad)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />

      {/* S Ribbon - Bucle inferior */}
      <path
        d="M 20 78 C 30 88, 54 86, 70 78 C 80 72, 84 62, 76 56 C 68 50, 46 56, 36 62"
        stroke="url(#sfMainGrad)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Conexiones a los Nodos del Proceso (Arriba a la Derecha) */}
      <path
        d="M 52 28 L 68 16 M 68 16 L 86 16 M 68 16 L 78 32 M 86 16 L 78 32"
        stroke="url(#sfSecondaryGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Puntos / Nodos de la Red */}
      <circle cx="68" cy="16" r="4.5" fill="#818CF8" />
      <circle cx="86" cy="16" r="4.5" fill="#A855F7" />
      <circle cx="78" cy="32" r="4.5" fill="#5B5FEF" />
      <circle cx="52" cy="28" r="4" fill="#C084FC" />
    </g>
  </svg>
);

const TONE = {
  green: "bg-greenSoft text-green dark:bg-green/20 dark:text-emerald-400",
  amber: "bg-amberSoft text-amber dark:bg-amber/20 dark:text-amber-400",
  red: "bg-redSoft text-red dark:bg-red/20 dark:text-rose-400",
  blue: "bg-blueSoft text-blue dark:bg-blue/20 dark:text-blue-400",
  gray: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
};

export const Pill = ({ tone = "blue", children, icon: Icon }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium font-body transition-colors ${TONE[tone]}`}
  >
    {Icon && <Icon size={12} strokeWidth={2.5} />}
    {children}
  </span>
);

export const Avatar = ({ initials, src, tone = "bg-blue", size = 34, className = "" }) => {
  if (src) {
    return (
      <img
        src={src}
        alt="Avatar"
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full text-white text-xs font-semibold font-display shrink-0 ${tone} ${className}`}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
};

export const Logo = ({ light, className = "" }) => (
  <div className={`flex items-center gap-2.5 shrink-0 ${className}`}>
    <LogoMark size={32} />
    <span className={`text-[17px] font-bold tracking-tight font-display ${light ? "text-white" : "text-ink dark:text-white"}`}>
      SmartFlow{" "}
      <span
        className="bg-clip-text text-transparent"
        style={{ backgroundImage: "linear-gradient(90deg, #5B5FEF, #8B5CF6)" }}
      >
        AI
      </span>
    </span>
  </div>
);

export const Card = ({ className = "", children }) => (
  <div className={`rounded-xl border border-border dark:border-navyCard bg-white dark:bg-navy shadow-soft transition-colors ${className}`}>
    {children}
  </div>
);