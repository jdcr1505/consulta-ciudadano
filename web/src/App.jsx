import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Cargando } from './components/ui.jsx';
import CambiarPassword from './pages/CambiarPassword.jsx';
import Ciudadanos from './pages/Ciudadanos.jsx';
import HistorialConsultas from './pages/HistorialConsultas.jsx';
import Inicio from './pages/Inicio.jsx';
import Login from './pages/Login.jsx';
import Novedades from './pages/Novedades.jsx';
import Reportes from './pages/Reportes.jsx';
import Roles from './pages/Roles.jsx';
import Solicitudes from './pages/Solicitudes.jsx';
import Usuarios from './pages/Usuarios.jsx';

export default function App() {
  const { usuario, cargando, puede } = useAuth();
  if (cargando) return <Cargando texto="Cargando sesión…" />;
  if (!usuario) return <Login />;
  if (usuario.debeCambiarPassword) return <CambiarPassword />;

  // Protección de rutas en la interfaz; la autorización real siempre se aplica en el servidor.
  const Protegida = ({ permisos, children }) => {
    const lista = Array.isArray(permisos) ? permisos : [permisos];
    return lista.some((p) => puede(p)) ? children : <Navigate to="/inicio" replace />;
  };

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/ciudadanos" element={<Protegida permisos="ciudadanos:leer"><Ciudadanos /></Protegida>} />
        <Route path="/solicitudes" element={<Protegida permisos="solicitudes:leer"><Solicitudes /></Protegida>} />
        <Route path="/novedades" element={<Protegida permisos="novedades:gestionar"><Novedades /></Protegida>} />
        <Route path="/historial" element={<Protegida permisos={['consultas:leer_todas', 'consultas:leer']}><HistorialConsultas /></Protegida>} />
        <Route path="/reportes" element={<Protegida permisos="reportes:leer"><Reportes /></Protegida>} />
        <Route path="/usuarios" element={<Protegida permisos="usuarios:leer"><Usuarios /></Protegida>} />
        <Route path="/roles" element={<Protegida permisos="roles:leer"><Roles /></Protegida>} />
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Route>
    </Routes>
  );
}