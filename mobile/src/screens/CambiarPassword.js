import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Aviso, Boton, Campo } from '../components/ui';
import { colores } from '../theme';
import { validarCambio } from '../validation';

export default function CambiarPassword() {
  const { usuario, cambiarPassword, logout } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setGeneral('');
    const e = validarCambio(actual, nueva, confirmar);
    setErrores(e);
    if (Object.keys(e).length) return;
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
    <ScrollView contentContainerStyle={s.cont} keyboardShouldPersistTaps="handled">
      <Text style={s.titulo}>Cambie su contraseña</Text>
      <Text style={s.nota}>Hola {usuario.nombres}. Ingresó con una contraseña temporal: por seguridad debe definir una propia antes de continuar.</Text>
      {general ? <Aviso tipo="error">{general}</Aviso> : null}
      <Campo etiqueta="Contraseña actual (temporal)" value={actual} onChangeText={setActual} error={errores.passwordActual} secureTextEntry autoCapitalize="none" />
      <Campo etiqueta="Contraseña nueva" value={nueva} onChangeText={setNueva} error={errores.passwordNueva} secureTextEntry autoCapitalize="none" ayuda="6 a 64 caracteres, con mayúscula, minúscula y número." />
      <Campo etiqueta="Confirmar contraseña nueva" value={confirmar} onChangeText={setConfirmar} error={errores.confirmar} secureTextEntry autoCapitalize="none" />
      <Boton titulo="Guardar contraseña" onPress={enviar} cargando={enviando} />
      <Boton titulo="Cerrar sesión" variante="secundario" onPress={logout} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cont: { padding: 24, paddingTop: 36 },
  titulo: { fontSize: 24, fontWeight: '800', color: colores.petroleo, marginBottom: 8 },
  nota: { color: colores.tenue, marginBottom: 16 },
});
