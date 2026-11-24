import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { get, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Aviso, Boton, Campo } from '../components/ui';
import { formatoMiles } from '../scanner/analisis';
import { colores, sombra } from '../theme';

const FILTROS = [
  { valor: '', texto: 'Todas' },
  { valor: 'REQUERIDO', texto: 'Requeridos' },
  { valor: 'NO_REQUERIDO', texto: 'No requeridos' },
  { valor: 'NO_REGISTRADO', texto: 'Sin registro' },
];

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** HU07 — Historial de consultas realizadas por el funcionario en la app móvil. */
export default function HistorialConsultas({ onReportarNovedad, onVolver }) {
  const { usuario } = useAuth();
  const puedeCrearNovedad = usuario?.permisos?.includes('novedades:crear');

  const [resultado, setResultado] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const idLimpia = identificacion.replace(/\D/g, '').slice(0, 10);
      const d = await get(`/consultas${qs({ resultado, identificacion: idLimpia, page, pageSize: 10 })}`);
      setDatos(d);
    } catch (e) {
      setError(e.message);
      setDatos({ items: [], total: 0, page: 1, pageSize: 10 });
    } finally {
      setCargando(false);
    }
  }, [resultado, identificacion, page]);

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1;

  return (
    <ScrollView contentContainerStyle={s.cont}>
      <Text style={s.titulo}>Historial de consultas</Text>
      <Text style={s.nota}>Consultas realizadas desde su cuenta.</Text>

      <View style={s.chips}>
        {FILTROS.map((f) => {
          const activo = resultado === f.valor;
          return (
            <Pressable
              key={f.valor || 'todas'}
              onPress={() => { setPage(1); setResultado(f.valor); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              style={[s.chip, activo && s.chipActivo]}
            >
              <Text style={[s.chipTxt, activo && s.chipTxtActivo]}>{f.texto}</Text>
            </Pressable>
          );
        })}
      </View>

      <Campo
        etiqueta="Filtrar por identificación"
        value={identificacion}
        onChangeText={(t) => { setPage(1); setIdentificacion(t.replace(/\D/g, '').slice(0, 10)); }}
        keyboardType="number-pad"
        maxLength={10}
        placeholder="Ej. 79123456"
      />

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      {cargando ? (
        <View style={s.centro}><ActivityIndicator size="large" color={colores.petroleo2} /></View>
      ) : datos?.items?.length === 0 ? (
        <View style={s.vacio}>
          <Ionicons name="time-outline" size={34} color={colores.tenue} />
          <Text style={s.vacioTitulo}>Sin consultas registradas</Text>
          <Text style={s.vacioTxt}>No hay consultas que coincidan con el filtro actual.</Text>
        </View>
      ) : (
        <>
          <Text style={s.contador}>{datos.total} consulta{datos.total === 1 ? '' : 's'}</Text>
          {datos.items.map((c) => {
            const req = c.resultado === 'REQUERIDO';
            return (
              <View key={c.id} style={s.tarjeta}>
                <View style={s.filaSup}>
                  <Text style={s.num}>{formatoMiles(c.identificacion)}</Text>
                  <View style={[s.badge, req ? s.badgeRojo : s.badgeVerde]}>
                    <Text style={[s.badgeTxt, req ? s.badgeTxtRojo : s.badgeTxtVerde]}>
                      {req ? 'Requerido' : 'No requerido'}
                    </Text>
                  </View>
                </View>

                <Text style={s.ciudadano}>
                  {c.ciudadano ? `${c.ciudadano.nombres} ${c.ciudadano.apellidos}` : 'No figura en el sistema'}
                </Text>

                <View style={s.meta}>
                  <Text style={s.metaTxt}>{fechaHora(c.fechaHora)}</Text>
                  <Text style={s.metaTxt}>· {c.origen === 'ESCANER' ? 'Escáner' : 'Manual'}</Text>
                </View>

                {puedeCrearNovedad && c.registrado && (
                  <Pressable
                    onPress={() => onReportarNovedad(c.identificacion)}
                    accessibilityRole="button"
                    style={s.accionNovedad}
                  >
                    <Ionicons name="flag-outline" size={16} color={colores.petroleo2} />
                    <Text style={s.accionNovedadTxt}>Registrar novedad</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {totalPaginas > 1 && (
            <View style={s.paginacion}>
              <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)} style={[s.btnPag, page <= 1 && s.btnPagOff]}>
                <Text style={s.btnPagTxt}>Anterior</Text>
              </Pressable>
              <Text style={s.metaTxt}>Página {page} de {totalPaginas}</Text>
              <Pressable disabled={page >= totalPaginas} onPress={() => setPage((p) => p + 1)} style={[s.btnPag, page >= totalPaginas && s.btnPagOff]}>
                <Text style={s.btnPagTxt}>Siguiente</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      <Boton titulo="Volver al inicio" variante="secundario" onPress={onVolver} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cont: { padding: 20, paddingTop: 24, paddingBottom: 32 },
  titulo: { fontSize: 26, fontWeight: '800', color: colores.petroleo, letterSpacing: -0.5 },
  nota: { color: colores.tenue, marginTop: 4, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: colores.linea },
  chipActivo: { backgroundColor: colores.petroleo2, borderColor: colores.petroleo2 },
  chipTxt: { fontSize: 13, fontWeight: '700', color: colores.tenue },
  chipTxtActivo: { color: '#fff' },
  centro: { paddingVertical: 32, alignItems: 'center' },
  contador: { fontSize: 13, fontWeight: '700', color: colores.tenue, marginBottom: 10 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginBottom: 12, ...sombra.suave },
  filaSup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  num: { fontSize: 18, fontWeight: '800', color: colores.tinta, fontVariant: ['tabular-nums'] },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeRojo: { backgroundColor: colores.rojoSuave },
  badgeVerde: { backgroundColor: colores.verdeSuave },
  badgeTxt: { fontSize: 12, fontWeight: '800' },
  badgeTxtRojo: { color: colores.rojo },
  badgeTxtVerde: { color: colores.verde },
  ciudadano: { fontSize: 15, fontWeight: '700', color: colores.tinta, marginTop: 6 },
  meta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  metaTxt: { fontSize: 12, color: colores.tenue },
  accionNovedad: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colores.linea },
  accionNovedadTxt: { color: colores.petroleo2, fontWeight: '700', fontSize: 13 },
  vacio: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 24, marginVertical: 12 },
  vacioTitulo: { fontWeight: '800', fontSize: 16, color: colores.tinta, marginTop: 8 },
  vacioTxt: { color: colores.tenue, textAlign: 'center', marginTop: 4 },
  paginacion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  btnPag: { backgroundColor: '#fff', borderWidth: 1, borderColor: colores.petroleo2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnPagOff: { opacity: 0.45 },
  btnPagTxt: { color: colores.petroleo2, fontWeight: '700', fontSize: 13 },
});