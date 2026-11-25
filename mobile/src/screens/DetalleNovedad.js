import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { get } from '../api/client';
import { Aviso, Boton } from '../components/ui';
import { formatoMiles } from '../scanner/analisis';
import { colores, sombra } from '../theme';
import { ESTILO_ESTADO_NOVEDAD } from './MisNovedades';

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** HU09 — Detalle e historial de cambios de estado de una novedad del funcionario. */
export default function DetalleNovedad({ novedadId, onVolver }) {
  const [novedad, setNovedad] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);
      setError('');
      try {
        const d = await get(`/novedades/mias/${novedadId}`);
        if (activo) setNovedad(d.novedad);
      } catch (e) {
        if (activo) setError(e.message);
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [novedadId]);

  if (cargando) {
    return (
      <View style={s.centro}>
        <ActivityIndicator size="large" color={colores.petroleo3} />
      </View>
    );
  }

  if (error || !novedad) {
    return (
      <ScrollView contentContainerStyle={s.cont}>
        <Aviso tipo="error">{error || 'No se pudo cargar la novedad'}</Aviso>
        <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
      </ScrollView>
    );
  }

  const est = ESTILO_ESTADO_NOVEDAD[novedad.estado] ?? { texto: novedad.estado, bg: '#1f1f24', fg: colores.tenue };

  return (
    <ScrollView contentContainerStyle={s.cont}>
      <Text style={s.titulo}>Novedad #{novedad.id}</Text>

      <View style={s.tarjeta}>
        <View style={[s.estadoBanner, { backgroundColor: est.bg }]}>
          <Ionicons name="flag" size={18} color={est.fg} />
          <Text style={[s.estadoTxt, { color: est.fg }]}>Estado actual: {est.texto}</Text>
        </View>

        <Text style={s.etiqueta}>Ciudadano</Text>
        <Text style={s.valor}>{novedad.ciudadano.nombres} {novedad.ciudadano.apellidos}</Text>

        <Text style={s.etiqueta}>Identificación</Text>
        <Text style={[s.valor, s.num]}>{formatoMiles(novedad.ciudadano.identificacion)}</Text>

        <Text style={s.etiqueta}>Fecha de registro</Text>
        <Text style={s.valorSec}>{fechaHora(novedad.creadaEn)}</Text>

        <Text style={s.etiqueta}>Descripción reportada</Text>
        <Text style={s.descripcion}>{novedad.descripcion}</Text>
      </View>

      <Text style={s.subtitulo}>Historial de estados</Text>
      {novedad.historial?.map((h, i) => {
        const estItem = ESTILO_ESTADO_NOVEDAD[h.estadoNuevo] ?? { texto: h.estadoNuevo, fg: '#c4b5fd' };
        return (
          <View key={i} style={s.paso}>
            <View style={s.pasoCab}>
              <Text style={[s.pasoEstado, { color: estItem.fg }]}>{estItem.texto}</Text>
              <Text style={s.pasoFecha}>{fechaHora(h.fecha)}</Text>
            </View>
            {h.comentario ? <Text style={s.pasoComentario}>{h.comentario}</Text> : null}
          </View>
        );
      })}

      <Boton titulo="Volver a mis novedades" variante="secundario" onPress={onVolver} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo },
  cont: { padding: 20, paddingTop: 24, paddingBottom: 32 },
  titulo: { fontSize: 26, fontWeight: '800', color: colores.tinta, letterSpacing: -0.5, marginBottom: 14 },
  tarjeta: { backgroundColor: colores.panel, borderWidth: 1, borderColor: colores.linea, borderRadius: 16, padding: 18, marginBottom: 18, ...sombra.suave },
  estadoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, marginBottom: 8 },
  estadoTxt: { fontWeight: '800', fontSize: 15 },
  etiqueta: { color: colores.tenue, fontSize: 12, fontWeight: '700', marginTop: 10 },
  valor: { color: colores.tinta, fontSize: 17, fontWeight: '800', marginTop: 2 },
  valorSec: { color: colores.tinta, fontSize: 14, fontWeight: '600', marginTop: 2 },
  num: { fontVariant: ['tabular-nums'] },
  descripcion: { color: colores.tinta, fontSize: 15, lineHeight: 21, marginTop: 4, backgroundColor: colores.fondo, borderWidth: 1, borderColor: colores.linea, padding: 12, borderRadius: 10 },
  subtitulo: { fontSize: 18, fontWeight: '800', color: colores.tinta, marginBottom: 10 },
  paso: { backgroundColor: colores.panel, borderWidth: 1, borderColor: colores.linea, borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: colores.petroleo3, ...sombra.suave },
  pasoCab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pasoEstado: { fontWeight: '800', fontSize: 15 },
  pasoFecha: { fontSize: 12, color: colores.tenue },
  pasoComentario: { color: colores.tinta, fontSize: 14, marginTop: 6, lineHeight: 20 },
});