import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { get } from '../api/client';
import { leerIdentificacionRecordada, useAuth } from '../auth/AuthContext';
import Guilloche from '../components/Guilloche';
import { Aviso, Boton, Campo } from '../components/ui';
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

  // Estado del servidor: 'cargando' | 'listo' | 'error'
  const [servidor, setServidor] = useState('cargando');
  const [arranqueLento, setArranqueLento] = useState(false);
  const pulso = useRef(new Animated.Value(0.35)).current;

  const verificarServidor = useCallback(async () => {
    setServidor('cargando');
    setArranqueLento(false);
    const avisoLento = setTimeout(() => setArranqueLento(true), 2000);
    try {
      await get('/health', { timeoutMs: __DEV__ ? 5000 : 65000 });
      setServidor('listo');
    } catch {
      setServidor('error');
    } finally {
      clearTimeout(avisoLento);
    }
  }, []);

  useEffect(() => {
    verificarServidor();
  }, [verificarServidor]);

  useEffect(() => {
    if (servidor !== 'cargando') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [servidor, pulso]);

  useEffect(() => {
    leerIdentificacionRecordada().then((id) => { if (id) { setIdentificacion(id); setRecordar(true); } }).catch(() => {});
  }, []);

  async function enviar() {
    if (servidor !== 'listo') return;
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

          <Pressable
            onPress={servidor === 'error' ? verificarServidor : undefined}
            disabled={servidor !== 'error'}
            accessibilityRole={servidor === 'error' ? 'button' : 'none'}
            accessibilityLiveRegion="polite"
            style={[
              s.barraEstado,
              servidor === 'listo' && s.barraOk,
              servidor === 'error' && s.barraError,
            ]}
          >
            <View style={s.barraFila}>
              {servidor === 'cargando' && (
                <>
                  <ActivityIndicator size="small" color="#c4b5fd" />
                  <Text style={s.barraTxt}>
                    {arranqueLento ? 'Iniciando servidor… (puede tardar ~40 s)' : 'Conectando con el servidor…'}
                  </Text>
                </>
              )}
              {servidor === 'listo' && (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                  <Text style={[s.barraTxt, { color: '#4ade80' }]}>Servidor conectado · Todo listo</Text>
                </>
              )}
              {servidor === 'error' && (
                <>
                  <Ionicons name="cloud-offline-outline" size={16} color="#fbbf24" />
                  <Text style={[s.barraTxt, { color: '#fbbf24' }]}>
                    {__DEV__ ? 'Servidor local apagado · Toca para reintentar' : 'Sin respuesta · Toca aquí para reintentar'}
                  </Text>
                </>
              )}
            </View>
            {servidor === 'cargando' && (
              <View style={s.track}>
                <Animated.View style={[s.trackFill, { opacity: pulso }]} />
              </View>
            )}
          </Pressable>

          <Boton
            titulo={servidor === 'cargando' ? 'Esperando servidor…' : 'Ingresar'}
            onPress={enviar}
            cargando={enviando}
            disabled={servidor !== 'listo'}
          />
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
  fila: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  recordar: { flex: 1, color: colores.tinta, fontSize: 14 },
  barraEstado: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  barraOk: {
    backgroundColor: colores.verdeSuave,
    borderColor: 'rgba(74, 222, 128, 0.35)',
  },
  barraError: {
    backgroundColor: colores.ambarSuave,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  barraFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barraTxt: {
    flex: 1,
    color: '#e9d5ff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  track: {
    height: 3,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 99,
    marginTop: 8,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    width: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 99,
  },
});