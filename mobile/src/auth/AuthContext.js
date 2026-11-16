import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { borrarRefresh, get, guardarRefresh, leerRefresh, post, refrescar, setAccessToken, setOnSessionLost } from '../api/client';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const CLAVE_ID = 'cc.identificacion'; // "Recordar": solo la identificación

export const leerIdentificacionRecordada = async () => (await SecureStore.getItemAsync(CLAVE_ID)) ?? '';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cerrarLocal = useCallback(async () => {
    setAccessToken(null);
    await borrarRefresh();
    setUsuario(null);
  }, []);

  useEffect(() => {
    setOnSessionLost(cerrarLocal);
    (async () => {
      try {
        if (await leerRefresh()) setUsuario((await refrescar()).usuario);
      } catch { /* sin sesión previa válida */ }
      setCargando(false);
    })();
  }, [cerrarLocal]);

  const iniciarSesion = useCallback(async (d) => {
    setAccessToken(d.accessToken);
    await guardarRefresh(d.refreshToken);
    setUsuario(d.usuario);
  }, []);

  const login = useCallback(async (identificacion, password, recordar) => {
    const d = await post('/auth/login', { identificacion, password });
    if (recordar) await SecureStore.setItemAsync(CLAVE_ID, identificacion);
    else await SecureStore.deleteItemAsync(CLAVE_ID);
    await iniciarSesion(d);
  }, [iniciarSesion]);

  const cambiarPassword = useCallback(async (passwordActual, passwordNueva) => {
    await iniciarSesion(await post('/auth/cambiar-password', { passwordActual, passwordNueva }));
  }, [iniciarSesion]);

  const logout = useCallback(async () => {
    try { await post('/auth/logout', { refreshToken: await leerRefresh() }); } catch { /* se cierra localmente igual */ }
    await cerrarLocal();
  }, [cerrarLocal]);

  const valor = useMemo(() => ({ usuario, cargando, login, logout, cambiarPassword }), [usuario, cargando, login, logout, cambiarPassword]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export { get };
