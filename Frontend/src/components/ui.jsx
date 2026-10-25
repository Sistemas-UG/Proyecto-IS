// Marca del logo: molinete de 3 pétalos en degradado azul-morado,
// recreado como SVG propio (sin depender de ningún ícono de terceros).
const LogoMark = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="smartflowLogoGrad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="55%" stopColor="#5B5FEF" />
        <stop offset="100%" stopColor="#9333EA" />
      </linearGradient>
    </defs>
    <g fill="url(#smartflowLogoGrad)">
      <path d="M16 3C16 3 21.5 8.4 21.5 13.2C21.5 16.07 19.07 18.4 16 18.4C12.93 18.4 10.5 16.07 10.5 13.2C10.5 8.4 16 3 16 3Z" transform="rotate(0 16 16)" />
      <path d="M16 3C16 3 21.5 8.4 21.5 13.2C21.5 16.07 19.07 18.4 16 18.4C12.93 18.4 10.5 16.07 10.5 13.2C10.5 8.4 16 3 16 3Z" transform="rotate(120 16 16)" opacity="0.85" />
      <path d="M16 3C16 3 21.5 8.4 21.5 13.2C21.5 16.07 19.07 18.4 16 18.4C12.93 18.4 10.5 16.07 10.5 13.2C10.5 8.4 16 3 16 3Z" transform="rotate(240 16 16)" opacity="0.7" />
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

export const Logo = ({ light }) => (
  <div className="flex items-center gap-2">
    <LogoMark size={32} />
    <span className={`text-[16px] font-bold tracking-tight font-display ${light ? "text-white" : "text-ink dark:text-white"}`}>
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