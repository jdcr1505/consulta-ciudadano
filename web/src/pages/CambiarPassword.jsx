import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Aviso, Boton, Campo } from '../components/ui.jsx';

export default function CambiarPassword() {
  const { usuario, cambiarPassword, logout } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setGeneral('');
    const faltan = {};
    if (!actual) faltan.passwordActual = 'Ingrese su contraseña actual';
    if (!nueva) faltan.passwordNueva = 'Ingrese la contraseña nueva';
    else if (nueva !== confirmar) faltan.confirmar = 'La confirmación no coincide';
    setErrores(faltan);
    if (Object.keys(faltan).length) return;
    setEnviando(true);
    try {
      await cambiarPassword(actual, nueva);
    } catch (err) {
      setErrores(err.campos ?? {});
      setGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pagina-centrada">
      <form className="panel-formulario" onSubmit={enviar} noValidate aria-label="Cambio de contraseña">
        <h1>Cambie su contraseña</h1>
        <p>Hola {usuario.nombres}. Ingresó con una contraseña temporal: por seguridad debe definir una propia antes de continuar.</p>
        {general && <Aviso tipo="error">{general}</Aviso>}
        <Campo etiqueta="Contraseña actual (temporal)" error={errores.passwordActual}>
          {(id) => <input id={id} type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />}
        </Campo>
        <Campo etiqueta="Contraseña nueva" error={errores.passwordNueva} ayuda="6 a 64 caracteres, con al menos una mayúscula, una minúscula y un número.">
          {(id) => <input id={id} type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />}
        </Campo>
        <Campo etiqueta="Confirmar contraseña nueva" error={errores.confirmar}>
          {(id) => <input id={id} type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />}
        </Campo>
        <div className="acciones">
          <Boton variante="secundario" onClick={logout}>Cerrar sesión</Boton>
          <Boton type="submit" cargando={enviando}>Guardar contraseña</Boton>
        </div>
      </form>
    </div>
  );
}
