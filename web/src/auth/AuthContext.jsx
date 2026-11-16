import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { post, refrescar, setAccessToken, setOnSessionLost } from '../api/client.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const CLAVE_ID = 'cc.identificacion'; // "Recordar": SOLO la identificación, nunca la contraseña ni tokens

export function leerIdentificacionRecordada() {
  try { return localStorage.getItem(CLAVE_ID) ?? ''; } catch { return ''; }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cerrarLocal = useCallback(() => { setAccessToken(null); setUsuario(null); }, []);

  useEffect(() => {
    setOnSessionLost(cerrarLocal);
    // Restaura la sesión con la cookie httpOnly (si existe y sigue vigente).
    refrescar().then((d) => setUsuario(d.usuario)).catch(() => {}).finally(() => setCargando(false));
  }, [cerrarLocal]);

  const login = useCallback(async (identificacion, password, recordar) => {
    const d = await post('/auth/login', { identificacion, password });
    setAccessToken(d.accessToken);
    try {
      if (recordar) localStorage.setItem(CLAVE_ID, identificacion);
      else localStorage.removeItem(CLAVE_ID);
    } catch { /* almacenamiento no disponible */ }
    setUsuario(d.usuario);
  }, []);

  const cambiarPassword = useCallback(async (passwordActual, passwordNueva) => {
    const d = await post('/auth/cambiar-password', { passwordActual, passwordNueva });
    setAccessToken(d.accessToken);
    setUsuario(d.usuario);
  }, []);

  const logout = useCallback(async () => {
    try { await post('/auth/logout'); } catch { /* se cierra localmente de todas formas */ }
    cerrarLocal();
  }, [cerrarLocal]);

  const puede = useCallback((permiso) => Boolean(usuario?.permisos.includes(permiso)), [usuario]);
  const valor = useMemo(() => ({ usuario, cargando, login, logout, cambiarPassword, puede }), [usuario, cargando, login, logout, cambiarPassword, puede]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
