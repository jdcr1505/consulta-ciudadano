import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { get } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Guilloche, { Sello } from './Guilloche.jsx';
import { Icono } from './icons.jsx';
import { Iniciales } from './ui.jsx';

const NAV = [
  { a: '/inicio', t: 'Inicio', icono: 'inicio', permiso: null },
  { a: '/ciudadanos', t: 'Ciudadanos', icono: 'cedula', permiso: 'ciudadanos:leer' },
  { a: '/reportes', t: 'Reportes', icono: 'informe', permiso: 'reportes:leer' },
  { a: '/usuarios', t: 'Usuarios', icono: 'usuarios', permiso: 'usuarios:leer' },
  { a: '/roles', t: 'Roles y permisos', icono: 'escudo', permiso: 'roles:leer' },
];

export function BandaSimulacion() {
  const [info, setInfo] = useState(null);
  useEffect(() => { get('/info').then(setInfo).catch(() => {}); }, []);
  if (!info) return null;
  const s = info.simulaciones;
  const partes = [s.datos && 'datos ficticios', s.defensa && 'validación de Defensa simulada', s.correo && 'correo simulado (modo desarrollo)'].filter(Boolean);
  return <div className="banda-sim" role="note"><Icono nombre="info" tam={14} />Sistema académico · {partes.join(' · ')}</div>;
}

const TITULOS = { '/inicio': 'Inicio', '/ciudadanos': 'Ciudadanos', '/reportes': 'Reportes', '/usuarios': 'Usuarios', '/roles': 'Roles y permisos' };

export default function Layout() {
  const { usuario, logout, puede } = useAuth();
  const { pathname } = useLocation();
  const items = NAV.filter((n) => !n.permiso || puede(n.permiso));
  const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="app">
      <BandaSimulacion />
      <aside className="lateral">
        <div className="lateral-cabecera">
          <Guilloche ancho={480} alto={200} lineas={22} opacidad={0.2} />
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
          {items.length <= 1 && !puede('ciudadanos:leer') && !puede('usuarios:leer') && !puede('roles:leer') && !puede('reportes:leer') ? (
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
