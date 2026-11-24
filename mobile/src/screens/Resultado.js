import { Ionicons } from '@expo/vector-icons';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';
import Guilloche from '../components/Guilloche';
import { Boton } from '../components/ui';
import { formatoMiles } from '../scanner/analisis';
import { colores, sombra } from '../theme';

const SIN_CONEXION = new Set(['SIN_CONEXION', 'SERVICIO_NO_DISPONIBLE']);

function descripcion(v) {
  if (v.tipo === 'ok') {
    const req = v.datos.resultado === 'REQUERIDO';
    const sub = v.datos.registrado === false ? 'No figura en el sistema' : 'Estado judicial del ciudadano';
    return { color: req ? colores.rojo : colores.verde, icono: req ? 'alert-circle' : 'checkmark-circle', titulo: req ? 'Requerido' : 'No requerido', sub };
  }
  const titulos = {
    IDENTIFICACION_INVALIDA: 'Número no válido',
    CONSULTA_NO_AUTORIZADA: 'Consulta no autorizada',
    SERVICIO_NO_DISPONIBLE: 'Servicio no disponible',
    SIN_CONEXION: 'Sin conexión',
  };
  return { color: colores.ambar, icono: SIN_CONEXION.has(v.codigo) ? 'cloud-offline-outline' : v.codigo === 'CONSULTA_NO_AUTORIZADA' ? 'close-circle' : 'warning-outline', titulo: titulos[v.codigo] ?? 'No se pudo consultar', sub: 'La consulta no se completó' };
}

export default function Resultado({ vista, onNueva, onInicio }) {
  const d = descripcion(vista);
  const escala = useRef(new Animated.Value(0.92)).current;
  const opacidad = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(escala, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.timing(opacidad, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [escala, opacidad]);

  const hora = vista.tipo === 'ok' ? new Date(vista.datos.consulta.fechaHora).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <ScrollView contentContainerStyle={s.cont}>
      <Animated.View style={[s.tarjeta, { opacity: opacidad, transform: [{ scale: escala }] }]} accessibilityRole="summary" accessibilityLabel={`${d.titulo}. ${d.sub}`}>
        <View style={[s.cabecera, { backgroundColor: d.color }]}>
          <Guilloche ancho={420} alto={200} lineas={18} opacidad={0.24} />
          <Ionicons name={d.icono} size={46} color="#fff" />
          <Text style={s.estado}>{d.titulo}</Text>
          <Text style={s.sub}>{d.sub}</Text>
        </View>
        <View style={s.cuerpo}>
          {vista.tipo === 'ok' && (
            <>
              {vista.datos.ciudadano && (
                <>
                  <Text style={s.etiqueta}>Nombre</Text>
                  <Text style={s.valor}>{vista.datos.ciudadano.nombres} {vista.datos.ciudadano.apellidos}</Text>
                </>
              )}
              <Text style={s.etiqueta}>Identificación</Text>
              <Text style={[s.valor, s.num]}>{formatoMiles(vista.datos.ciudadano?.identificacion ?? vista.identificacion)}</Text>
              {vista.datos.registrado === false && (
                <Text style={s.nota}>Esta identificación no figura en el sistema, por lo que no tiene un requerimiento registrado.</Text>
              )}
              <View style={s.registro}><Ionicons name="time-outline" size={16} color={colores.tenue} /><Text style={s.registroTxt}>Consulta registrada · {hora}</Text></View>
            </>
          )}
          {vista.tipo === 'error' && (
            <>
              <Text style={s.valor}>{vista.mensaje}</Text>
              {SIN_CONEXION.has(vista.codigo) && (
                <View style={s.alerta}><Ionicons name="alert-circle" size={20} color={colores.ambar} /><Text style={s.alertaTxt}>Esto NO significa que el ciudadano no sea requerido. Vuelva a intentarlo cuando haya conexión.</Text></View>
              )}
            </>
          )}
          <Text style={s.pie}>Sistema académico con datos ficticios: no es un resultado judicial real.</Text>
        </View>
      </Animated.View>
      <Boton titulo="Nueva consulta" onPress={onNueva} />
      <Boton titulo="Ir al inicio" variante="secundario" onPress={onInicio} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cont: { padding: 20, paddingTop: 24 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 16, ...sombra.media },
  cabecera: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 16, overflow: 'hidden' },
  estado: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 6, textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,.85)', fontWeight: '600', marginTop: 2 },
  cuerpo: { padding: 20 },
  etiqueta: { color: colores.tenue, fontSize: 12, fontWeight: '700', marginTop: 10 },
  valor: { color: colores.tinta, fontSize: 19, fontWeight: '700', marginTop: 2 },
  num: { fontSize: 26, fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  registro: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colores.linea },
  registroTxt: { color: colores.tenue, fontSize: 13 },
  nota: { color: colores.tenue, marginTop: 12 },
  alerta: { flexDirection: 'row', gap: 10, backgroundColor: colores.ambarSuave, borderRadius: 10, padding: 12, marginTop: 14 },
  alertaTxt: { flex: 1, color: colores.ambar, fontWeight: '700' },
  pie: { color: colores.tenue, fontSize: 12, marginTop: 18 },
});
