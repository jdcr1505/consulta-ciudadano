import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { leerIdentificacionRecordada, useAuth } from '../auth/AuthContext';
import { Aviso, Boton, Campo } from '../components/ui';
import Guilloche from '../components/Guilloche';
import { colores } from '../theme';
import { validarLogin } from '../validation';

export default function Login({ onRegistro, aviso }) {
  const { login } = useAuth();
  const [identificacion, setIdentificacion] = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    leerIdentificacionRecordada().then((id) => { if (id) { setIdentificacion(id); setRecordar(true); } }).catch(() => {});
  }, []);

  async function enviar() {
    setGeneral('');
    const e = validarLogin(identificacion, password);
    setErrores(e);
    if (Object.keys(e).length) return;
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colores.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <View style={s.cabecera}>
          <Guilloche ancho={420} alto={220} lineas={20} opacidad={0.14} fase={0.6} />
          <Text style={s.entidad}>REGISTRADURÍA KONRAD LORENZ</Text>
          <Text style={s.titulo}>Consulta Ciudadano</Text>
          <Text style={s.sub}>Acceso para personal de la fuerza pública</Text>
        </View>
        <View style={s.cont}>
          {aviso ? <Aviso tipo="ok">{aviso}</Aviso> : null}
          {general ? <Aviso tipo="error">{general}</Aviso> : null}
          <Campo
            etiqueta="Número de identificación"
            placeholder="Ej. 1020304050"
            value={identificacion}
            onChangeText={setIdentificacion}
            error={errores.identificacion}
            keyboardType="number-pad"
            maxLength={10}
            autoComplete="username"
            style={s.idGrande}
          />
          <Campo
            etiqueta="Contraseña"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            error={errores.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <View style={s.fila}>
            <Switch
              value={recordar}
              onValueChange={setRecordar}
              trackColor={{ false: '#27272a', true: colores.petroleo2 }}
              thumbColor="#fafafa"
              accessibilityLabel="Recordar mi identificación"
            />
            <Text style={s.recordar}>Recordar mi identificación <Text style={{ color: colores.tenue }}>(nunca la contraseña)</Text></Text>
          </View>
          <Boton titulo="Ingresar" onPress={enviar} cargando={enviando} />
          <Boton titulo="Solicitar acceso" variante="secundario" onPress={onRegistro} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cabecera: {
    backgroundColor: colores.panel,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 34,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colores.linea,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  cont: { padding: 24, paddingTop: 26 },
  entidad: { color: '#a78bfa', fontWeight: '700', fontSize: 12, letterSpacing: 1.2 },
  titulo: { fontSize: 30, fontWeight: '800', color: '#fff', marginTop: 6, letterSpacing: -0.8 },
  sub: { color: colores.tenue, marginTop: 6, fontSize: 14 },
  idGrande: { fontSize: 16, fontWeight: '600', letterSpacing: 1, minHeight: 46 },
  fila: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  recordar: { flex: 1, color: colores.tinta, fontSize: 14 },
});