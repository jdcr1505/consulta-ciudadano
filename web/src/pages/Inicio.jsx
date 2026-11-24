import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Icono } from '../components/icons.jsx';
import { Aviso, BarraProporcion, Esqueleto } from '../components/ui.jsx';

const ACCESOS = [
  { a: '/ciudadanos', t: 'Registrar o consultar ciudadanos', d: 'Altas, ediciones y estado judicial simulado', icono: 'cedula', permisos: ['ciudadanos:leer'] },
  { a: '/solicitudes', t: 'Revisar solicitudes de acceso', d: 'Aprobar o rechazar solicitudes pendientes', icono: 'solicitudes', permisos: ['solicitudes:leer'] },
  { a: '/novedades', t: 'Gestionar novedades', d: 'Dar trámite a reportes de la fuerza pública', icono: 'novedades', permisos: ['novedades:gestionar'] },
  { a: '/historial', t: 'Historial de consultas', d: 'Trazabilidad de verificaciones realizadas', icono: 'historial', permisos: ['consultas:leer_todas', 'consultas:leer'] },
  { a: '/reportes', t: 'Preparar y descargar reportes', d: 'Vista previa y exportación a PDF (HU16–HU17)', icono: 'informe', permisos: ['reportes:leer'] },
  { a: '/usuarios', t: 'Administrar usuarios', d: 'Cuentas, estados, roles y contraseñas', icono: 'usuarios', permisos: ['usuarios:leer'] },
  { a: '/roles', t: 'Roles y permisos', d: 'Qué puede hacer cada rol', icono: 'escudo', permisos: ['roles:leer'] },
];

export default function Inicio() {
  const { usuario, puede } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { get('/resumen').then(setDatos).catch((e) => { setError(e.message); setDatos({}); }); }, []);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const accesos = ACCESOS.filter((x) => x.permisos.some((p) => puede(p)));

  return (
    <section>
      <header className="encabezado">
        <div><h1>{saludo}, {usuario.nombres.split(' ')[0]}</h1><p>Este es el estado actual del sistema.</p></div>
      </header>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!datos ? <Esqueleto filas={3} columnas={3} /> : (
        <div className="indicadores">
          {datos.ciudadanos && (
            <article className="indicador indicador-ancho">
              <h2>Ciudadanos activos</h2>
              <p className="cifra">{datos.ciudadanos.total}</p>
              <BarraProporcion a={datos.ciudadanos.requeridos} b={datos.ciudadanos.noRequeridos} etiquetaA="Requeridos" etiquetaB="No requeridos" />
            </article>
          )}
          {datos.consultasHoy && (
            <article className="indicador">
              <h2>Consultas de hoy</h2>
              <p className="cifra">{datos.consultasHoy.total}</p>
              <p className="detalle">{datos.consultasHoy.requeridos} con resultado «requerido» · {datos.consultasHoy.noEncontrados} de personas que no figuran en el sistema</p>
            </article>
          )}
          {datos.solicitudesPendientes !== undefined && (
            <article className="indicador">
              <h2>Solicitudes pendientes</h2>
              <p className="cifra">{datos.solicitudesPendientes}</p>
              <p className="detalle">
                {datos.solicitudesPendientes === 0
                  ? 'No hay solicitudes pendientes de revisión.'
                  : <Link className="enlace" to="/solicitudes">Revisar solicitudes pendientes →</Link>}
              </p>
            </article>
          )}
          {datos.novedadesAbiertas !== undefined && (
            <article className="indicador">
              <h2>Novedades abiertas</h2>
              <p className="cifra">{datos.novedadesAbiertas}</p>
              <p className="detalle">
                {datos.novedadesAbiertas === 0
                  ? 'Todas las novedades han sido resueltas.'
                  : <Link className="enlace" to="/novedades">Gestionar novedades abiertas →</Link>}
              </p>
            </article>
          )}
          {datos.usuarios && (
            <article className="indicador">
              <h2>Usuarios</h2>
              <p className="cifra">{datos.usuarios.activos + datos.usuarios.inactivos}</p>
              <BarraProporcion a={datos.usuarios.activos} b={datos.usuarios.inactivos} etiquetaA="Activos" etiquetaB="Inactivos" tonoA="ok" tonoB="neutro" />
            </article>
          )}
        </div>
      )}
      {accesos.length > 0 && (
        <>
          <h2 className="subtitulo">Accesos rápidos</h2>
          <ul className="accesos">
            {accesos.map((x) => (
              <li key={x.a}>
                <Link to={x.a}>
                  <span className="acceso-icono"><Icono nombre={x.icono} /></span>
                  <span><strong>{x.t}</strong><small>{x.d}</small></span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}