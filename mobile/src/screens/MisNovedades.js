import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { get, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Aviso, Boton, Campo } from '../components/ui';
import { formatoMiles } from '../scanner/analisis';
import { colores, sombra } from '../theme';

const ESTADOS = [
  { valor: '', texto: 'Todas' },
  { valor: 'REGISTRADA', texto: 'Registrada' },
  { valor: 'EN_REVISION', texto: 'En revisión' },
  { valor: 'ATENDIDA', texto: 'Atendida' },
  { valor: 'DESCARTADA', texto: 'Descartada' },
];

export const ESTILO_ESTADO_NOVEDAD = {
  REGISTRADA: { texto: 'Registrada', bg: 'rgba(139, 92, 246, 0.16)', fg: '#c4b5fd' },
  EN_REVISION: { texto: 'En revisión', bg: colores.ambarSuave, fg: '#fbbf24' },
  ATENDIDA: { texto: 'Atendida', bg: colores.verdeSuave, fg: '#4ade80' },
  DESCARTADA: { texto: 'Descartada', bg: colores.rojoSuave, fg: '#f87171' },
};

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** HU09 — Consultar el estado de las novedades registradas por el funcionario. */
export default function MisNovedades({ aviso = '', onNueva, onVerDetalle, onVolver }) {
  const { usuario } = useAuth();
  const puedeCrear = usuario?.permisos?.includes('novedades:crear');

  const [estado, setEstado] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setDatos(await get(`/novedades/mias${qs({ estado, q, page, pageSize: 10 })}`));
    } catch (e) {
      setError(e.message);
      setDatos({ items: [], total: 0, page: 1, pageSize: 10 });
    } finally {
      setCargando(false);
    }
  }, [estado, q, page]);

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1;

  return (
    <ScrollView contentContainerStyle={s.cont}>
      <Text style={s.titulo}>Mis novedades</Text>
      <Text style={s.nota}>Consulte el seguimiento y estado de las novedades que ha reportado.</Text>

      {aviso ? <Aviso tipo="ok">{aviso}</Aviso> : null}

      {puedeCrear && (
        <View style={{ marginBottom: 14 }}>
          <Boton titulo="Registrar nueva novedad" onPress={onNueva} />
        </View>
      )}

      <View style={s.chips}>
        {ESTADOS.map((e) => {
          const activo = estado === e.valor;
          return (
            <Pressable
              key={e.valor || 'todas'}
              onPress={() => { setPage(1); setEstado(e.valor); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              style={[s.chip, activo && s.chipActivo]}
            >
              <Text style={[s.chipTxt, activo && s.chipTxtActivo]}>{e.texto}</Text>
            </Pressable>
          );
        })}
      </View>

      <Campo
        etiqueta="Buscar por ciudadano o descripción"
        value={q}
        onChangeText={(t) => { setPage(1); setQ(t); }}
        placeholder="Identificación, nombre o palabra clave"
      />

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      {cargando ? (
        <View style={s.centro}><ActivityIndicator size="large" color={colores.petroleo3} /></View>
      ) : datos?.items?.length === 0 ? (
        <View style={s.vacio}>
          <Ionicons name="flag-outline" size={34} color={colores.tenue} />
          <Text style={s.vacioTitulo}>Sin novedades para mostrar</Text>
          <Text style={s.vacioTxt}>No ha registrado novedades que coincidan con el filtro seleccionado.</Text>
        </View>
      ) : (
        <>
          <Text style={s.contador}>{datos.total} novedad{datos.total === 1 ? '' : 'es'}</Text>
          {datos.items.map((n) => {
            const est = ESTILO_ESTADO_NOVEDAD[n.estado] ?? { texto: n.estado, bg: '#1f1f24', fg: colores.tenue };
            return (
              <Pressable
                key={n.id}
                onPress={() => onVerDetalle(n.id)}
                accessibilityRole="button"
                style={({ pressed }) => [s.tarjeta, pressed && { opacity: 0.9 }]}
              >
                <View style={s.filaSup}>
                  <Text style={s.ciudadano}>{n.ciudadano.nombres} {n.ciudadano.apellidos}</Text>
                  <View style={[s.badge, { backgroundColor: est.bg }]}>
                    <Text style={[s.badgeTxt, { color: est.fg }]}>{est.texto}</Text>
                  </View>
                </View>
                <Text style={s.idTxt}>ID {formatoMiles(n.ciudadano.identificacion)}</Text>
                <Text style={s.desc} numberOfLines={2}>{n.descripcion}</Text>
                <View style={s.pie}>
                  <Text style={s.fecha}>{fechaHora(n.creadaEn)}</Text>
                  <Text style={s.verDetalle}>Ver seguimiento ›</Text>
                </View>
              </Pressable>
            );
          })}

          {totalPaginas > 1 && (
            <View style={s.paginacion}>
              <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)} style={[s.btnPag, page <= 1 && s.btnPagOff]}>
                <Text style={s.btnPagTxt}>Anterior</Text>
              </Pressable>
              <Text style={s.fecha}>Página {page} de {totalPaginas}</Text>
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
  titulo: { fontSize: 26, fontWeight: '800', color: colores.tinta, letterSpacing: -0.5 },
  nota: { color: colores.tenue, marginTop: 4, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: colores.panel, borderWidth: 1, borderColor: colores.linea },
  chipActivo: { backgroundColor: colores.petroleo2, borderColor: colores.petroleo2 },
  chipTxt: { fontSize: 13, fontWeight: '700', color: colores.tenue },
  chipTxtActivo: { color: '#ffffff' },
  centro: { paddingVertical: 32, alignItems: 'center' },
  contador: { fontSize: 13, fontWeight: '700', color: colores.tenue, marginBottom: 10 },
  tarjeta: { backgroundColor: colores.panel, borderWidth: 1, borderColor: colores.linea, borderRadius: 14, padding: 15, marginBottom: 12, ...sombra.suave },
  filaSup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  ciudadano: { flex: 1, fontSize: 16, fontWeight: '800', color: colores.tinta },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 12, fontWeight: '800' },
  idTxt: { fontSize: 13, fontWeight: '700', color: colores.tenue, marginTop: 2, fontVariant: ['tabular-nums'] },
  desc: { fontSize: 14, color: colores.tinta, marginTop: 8, lineHeight: 20 },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colores.linea },
  fecha: { fontSize: 12, color: colores.tenue },
  verDetalle: { fontSize: 13, fontWeight: '700', color: '#a78bfa' },
  vacio: { alignItems: 'center', backgroundColor: colores.panel, borderWidth: 1, borderColor: colores.linea, borderRadius: 14, padding: 24, marginVertical: 12 },
  vacioTitulo: { fontWeight: '800', fontSize: 16, color: colores.tinta, marginTop: 8 },
  vacioTxt: { color: colores.tenue, textAlign: 'center', marginTop: 4 },
  paginacion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  btnPag: { backgroundColor: colores.panel, borderWidth: 1, borderColor: colores.linea, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnPagOff: { opacity: 0.45 },
  btnPagTxt: { color: '#c4b5fd', fontWeight: '700', fontSize: 13 },
});