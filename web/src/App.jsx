import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Cargando } from './components/ui.jsx';
import CambiarPassword from './pages/CambiarPassword.jsx';
import Ciudadanos from './pages/Ciudadanos.jsx';
import Inicio from './pages/Inicio.jsx';
import Login from './pages/Login.jsx';
import Reportes from './pages/Reportes.jsx';
import Roles from './pages/Roles.jsx';
import Usuarios from './pages/Usuarios.jsx';

export default function App() {
  const { usuario, cargando, puede } = useAuth();
  if (cargando) return <Cargando texto="Cargando sesión…" />;
  if (!usuario) return <Login />;
  if (usuario.debeCambiarPassword) return <CambiarPassword />;

  // Protección de rutas en la interfaz; la autorización real siempre se aplica en el servidor.
  const Protegida = ({ permiso, children }) => (puede(permiso) ? children : <Navigate to="/inicio" replace />);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/ciudadanos" element={<Protegida permiso="ciudadanos:leer"><Ciudadanos /></Protegida>} />
        <Route path="/reportes" element={<Protegida permiso="reportes:leer"><Reportes /></Protegida>} />
        <Route path="/usuarios" element={<Protegida permiso="usuarios:leer"><Usuarios /></Protegida>} />
        <Route path="/roles" element={<Protegida permiso="roles:leer"><Roles /></Protegida>} />
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Route>
    </Routes>
  );
}
