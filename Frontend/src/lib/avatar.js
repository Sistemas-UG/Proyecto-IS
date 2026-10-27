import { api } from "./api";

// La foto se guarda por usuario: cada cuenta tiene su propia clave
const keyFor = (user) => `smartflow_avatar_${user?.id ?? user?.email ?? user?.username ?? "anon"}`;
const syncedFor = new Set();

export const getCachedAvatar = (user) => {
  try {
    return localStorage.getItem(keyFor(user)) || "";
  } catch {
    return "";
  }
};

export const setCachedAvatar = (user, dataUrl) => {
  try {
    if (dataUrl) localStorage.setItem(keyFor(user), dataUrl);
    else localStorage.removeItem(keyFor(user));
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new Event("smartflow-avatar"));
};

// Trae la foto guardada en el servidor (una vez por usuario y por carga de la app).
// Así, al iniciar sesión desde otro ordenador, aparece la foto de esa cuenta.
export const syncAvatar = async (user) => {
  if (!user) return;
  const key = keyFor(user);
  if (syncedFor.has(key) || typeof api.getMyProfile !== "function") return;
  syncedFor.add(key);
  try {
    const res = await api.getMyProfile();
    const remote = res?.user?.avatarUrl || null;
    if (remote && remote !== getCachedAvatar(user)) setCachedAvatar(user, remote);
  } catch {
    syncedFor.delete(key); // si falla, se reintenta en la próxima carga
  }
};

// Recorta al centro y reduce a 256x256 JPEG (pesa ~10-30 KB)
export const compressImage = (file, size = 256) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });