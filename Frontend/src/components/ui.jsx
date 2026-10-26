import { useEffect, useState } from "react";

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

// ---------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------
// El PNG del logo trae mucho espacio transparente alrededor del dibujo, por
// eso se veía chico y con un hueco grande antes del texto. Este hook lo
// recorta UNA vez al cargarlo (busca el área con píxeles visibles y se queda
// solo con esa), así el tamaño que se pide es el del dibujo y no el del
// archivo. Si algo falla, usa la imagen original tal cual.
const trimCache = new Map();

function useTrimmedSrc(src) {
  const [out, setOut] = useState(() => trimCache.get(src) || null);

  useEffect(() => {
    if (trimCache.has(src)) {
      setOut(trimCache.get(src));
      return undefined;
    }
    let cancelled = false;
    const finish = (url) => {
      trimCache.set(src, url);
      if (!cancelled) setOut(url);
    };

    const img = new Image();
    img.onload = () => {
      try {
        const w0 = img.naturalWidth;
        const h0 = img.naturalHeight;
        const c = document.createElement("canvas");
        c.width = w0;
        c.height = h0;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w0, h0);

        let minX = w0, minY = h0, maxX = -1, maxY = -1;
        for (let y = 0; y < h0; y++) {
          for (let x = 0; x < w0; x++) {
            if (data[(y * w0 + x) * 4 + 3] > 16) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) return finish(src); // imagen vacía: no tocar

        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const t = document.createElement("canvas");
        t.width = w;
        t.height = h;
        t.getContext("2d").drawImage(c, minX, minY, w, h, 0, 0, w, h);
        return finish(t.toDataURL("image/png"));
      } catch {
        return finish(src);
      }
    };
    img.onerror = () => finish(src);
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return out;
}

const LOGO_SIZES = {
  sm: { icon: 28, text: "text-base" },
  md: { icon: 36, text: "text-xl" },
  lg: { icon: 48, text: "text-3xl" },
  xl: { icon: 56, text: "text-3xl" },
};

// size: "sm" | "md" | "lg" (por defecto, el del login) | "xl"
// iconOnly: solo el dibujo, sin el texto "SmartFlow AI" (lo usa el sidebar)
export const Logo = ({ light, className = "", size = "lg", iconOnly = false }) => {
  const { icon, text } = LOGO_SIZES[size] || LOGO_SIZES.lg;
  const src = useTrimmedSrc("/logo-icon.png");

  return (
    <div className={`flex items-center gap-1.5 shrink-0 min-w-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt="SmartFlow AI"
          draggable={false}
          style={{ height: icon, width: "auto" }}
          className={`object-contain shrink-0 select-none bg-transparent transition-transform hover:scale-105 ${
            light
              ? "drop-shadow-[0_0_10px_rgba(139,92,246,0.4)]"
              : "dark:drop-shadow-[0_0_10px_rgba(139,92,246,0.4)]"
          }`}
        />
      ) : (
        // Reserva el espacio mientras se recorta (evita que el texto salte)
        <span aria-hidden="true" className="shrink-0" style={{ height: icon, width: icon }} />
      )}

      {!iconOnly && (
        <span
          className={`${text} font-bold tracking-tight font-display truncate ${
            light ? "text-white" : "text-ink dark:text-white"
          }`}
        >
          SmartFlow{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #5B5FEF, #8B5CF6)" }}
          >
            AI
          </span>
        </span>
      )}
    </div>
  );
};

export const Card = ({ className = "", children }) => (
  <div className={`rounded-xl border border-border dark:border-navyCard bg-white dark:bg-navy shadow-soft transition-colors ${className}`}>
    {children}
  </div>
);