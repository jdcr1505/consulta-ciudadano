import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Guilloche, { Sello } from './Guilloche.jsx';
import { Icono } from './icons.jsx';
import { Iniciales } from './ui.jsx';

const NAV = [
  { a: '/inicio', t: 'Inicio', icono: 'inicio', permisos: null },
  { a: '/ciudadanos', t: 'Ciudadanos', icono: 'cedula', permisos: ['ciudadanos:leer'] },
  { a: '/solicitudes', t: 'Solicitudes', icono: 'solicitudes', permisos: ['solicitudes:leer'] },
  { a: '/novedades', t: 'Novedades', icono: 'novedades', permisos: ['novedades:gestionar'] },
  { a: '/historial', t: 'Historial', icono: 'historial', permisos: ['consultas:leer_todas', 'consultas:leer'] },
  { a: '/reportes', t: 'Reportes', icono: 'informe', permisos: ['reportes:leer'] },
  { a: '/usuarios', t: 'Usuarios', icono: 'usuarios', permisos: ['usuarios:leer'] },
  { a: '/roles', t: 'Roles y permisos', icono: 'escudo', permisos: ['roles:leer'] },
];

export function BandaSimulacion() {
  return null;
}

const TITULOS = {
  '/inicio': 'Inicio',
  '/ciudadanos': 'Ciudadanos',
  '/solicitudes': 'Solicitudes de acceso',
  '/novedades': 'Novedades',
  '/historial': 'Historial de consultas',
  '/reportes': 'Reportes',
  '/usuarios': 'Usuarios',
  '/roles': 'Roles y permisos',
};

export default function Layout() {
  const { usuario, logout, puede } = useAuth();
  const { pathname } = useLocation();
  const items = NAV.filter((n) => !n.permisos || n.permisos.some((p) => puede(p)));
  const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="app">
      <aside className="lateral">
        <div className="lateral-cabecera">
          <Guilloche ancho={480} alto={200} lineas={22} opacidad={0.14} />
          <div className="marca"><Sello /><div><strong>Registraduría</strong><span>Konrad Lorenz</span></div></div>
        </div>
        <nav aria-label="Principal">
          {items.map((n) => <NavLink key={n.a} to={n.a}><Icono nombre={n.icono} /><span>{n.t}</span></NavLink>)}
        </nav>
        <div className="sesion">
          <div className="sesion-usuario">
            <Iniciales nombres={usuario.nombres} apellidos={usuario.apellidos} />
            <div><p className="quien">{usuario.nombres} {usuario.apellidos}</p><p className="rol">{usuario.rol}</p></div>
          </div>
          <button className="btn-salir" onClick={logout}><Icono nombre="salir" tam={16} />Cerrar sesión</button>
        </div>
      </aside>
      <div className="columna">
        <header className="barra-superior">
          <h2>{TITULOS[pathname] ?? ''}</h2>
          <time dateTime={new Date().toISOString()}>{hoy}</time>
        </header>
        <main className="contenido" key={pathname}>
          {items.length <= 1 ? (
            <div className="sin-opciones">
              <h1>Sin opciones disponibles</h1>
              <p>Su rol ({usuario.rol}) no tiene opciones en la aplicación web. Los funcionarios de la fuerza pública usan la aplicación móvil.</p>
            </div>
          ) : <Outlet />}
        </main>
      </div>
    </div>
  );
}