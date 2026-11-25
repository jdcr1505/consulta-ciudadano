import { useCallback, useEffect, useState } from 'react';
import { get } from '../api/client.js';
import { useAuth, leerIdentificacionRecordada } from '../auth/AuthContext.jsx';
import { Aviso, Boton } from '../components/ui.jsx';
import Guilloche, { Sello } from '../components/Guilloche.jsx';

export default function Login() {
  const { login } = useAuth();
  const [identificacion, setIdentificacion] = useState(leerIdentificacionRecordada());
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(Boolean(leerIdentificacionRecordada()));
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Estado del servidor en Render: 'cargando' | 'listo' | 'error'
  const [servidor, setServidor] = useState('cargando');

  const verificarServidor = useCallback(async () => {
    setServidor('cargando');
    try {
      await get('/health', { timeoutMs: 65000 });
      setServidor('listo');
    } catch {
      setServidor('error');
    }
  }, []);

  useEffect(() => {
    verificarServidor();
  }, [verificarServidor]);

  async function enviar(e) {
    e.preventDefault();
    if (servidor !== 'listo') return;
    setGeneral('');
    const faltan = {};
    if (!identificacion.trim()) faltan.identificacion = 'La identificación es obligatoria';
    if (!password) faltan.password = 'La contraseña es obligatoria';
    setErrores(faltan);
    if (Object.keys(faltan).length) return;
    setEnviando(true);
    try {
      await login(identificacion.trim(), password, recordar);
    } catch (err) {
      setErrores(err.campos ?? {});
      if (!err.details?.length) setGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <section className="login-marca">
        <Guilloche ancho={900} alto={900} lineas={46} opacidad={0.14} fase={0.6} />
        <div className="login-marca-texto">
          <Sello tam={52} />
          <p className="entidad">Registraduría Konrad Lorenz</p>
          <h1>Sistema de Consulta Ciudadano</h1>
          <p>Administración de ciudadanos, solicitudes de acceso, usuarios y roles de la fuerza pública.</p>
        </div>
      </section>
      <section className="login-form">
        <form onSubmit={enviar} noValidate aria-label="Inicio de sesión">
          <h2>Ingreso al sistema</h2>
          <p className="login-subtitulo">Ingresa tus credenciales administrativas para continuar.</p>
          {general && <Aviso tipo="error">{general}</Aviso>}
          <div className="campo">
            <label htmlFor="identificacion">Número de identificación</label>
            <input
              id="identificacion"
              className="id-grande"
              inputMode="numeric"
              autoComplete="username"
              placeholder="Ej. 1000000001"
              value={identificacion}
              onChange={(e) => setIdentificacion(e.target.value)}
              aria-invalid={errores.identificacion ? true : undefined}
            />
            {errores.identificacion && <p className="error-campo" role="alert">{errores.identificacion}</p>}
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errores.password ? true : undefined}
            />
            {errores.password && <p className="error-campo" role="alert">{errores.password}</p>}
          </div>
          <label className="check">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
            <span>Recordar mi identificación en este equipo <small>(nunca se guarda la contraseña)</small></span>
          </label>

          <div
            className={`estado-servidor estado-${servidor}`}
            role="status"
            onClick={servidor === 'error' ? verificarServidor : undefined}
          >
            <div className="estado-servidor-fila">
              <span className="estado-dot" aria-hidden="true" />
              <span>
                {servidor === 'cargando' && 'Iniciando servidor… (puede tardar ~40 s)'}
                {servidor === 'listo' && 'Servidor conectado · Todo listo'}
                {servidor === 'error' && 'Sin conexión · Haz clic aquí para reintentar'}
              </span>
            </div>
            {servidor === 'cargando' && (
              <div className="barra-progreso" aria-hidden="true">
                <div className="barra-progreso-fill" />
              </div>
            )}
          </div>

          <Boton type="submit" cargando={enviando} disabled={servidor !== 'listo'}>
            {servidor === 'cargando' ? 'Esperando servidor…' : 'Ingresar'}
          </Boton>
        </form>
      </section>
    </div>
  );
}