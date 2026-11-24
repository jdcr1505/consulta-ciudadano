import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, sombra } from '../theme';

export function Campo({ etiqueta, error, ayuda, style, ...props }) {
  return (
    <View style={s.campo}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <TextInput
        style={[s.input, error && s.inputError, style]}
        placeholderTextColor="#8a9a9d"
        accessibilityLabel={etiqueta}
        {...props}
      />
      {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : ayuda ? <Text style={s.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

export function Boton({ titulo, onPress, cargando, variante = 'primario', disabled }) {
  const sec = variante === 'secundario';
  return (
    <Pressable
      onPress={onPress}
      disabled={cargando || disabled}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed }) => [s.boton, sec ? s.botonSec : s.botonPri, (cargando || disabled) && { opacity: 0.55 }, pressed && { opacity: 0.8 }]}
    >
      {cargando ? <ActivityIndicator color={sec ? colores.petroleo : '#fff'} /> : <Text style={[s.botonTxt, sec && { color: colores.petroleo }]}>{titulo}</Text>}
    </Pressable>
  );
}

export function Aviso({ tipo = 'info', children }) {
  const color = tipo === 'error' ? colores.peligro : tipo === 'ok' ? colores.verde : colores.petroleo;
  return (
    <View style={[s.aviso, { borderLeftColor: color }]} accessibilityRole={tipo === 'error' ? 'alert' : undefined}>
      <Text style={{ color: colores.tinta }}>{children}</Text>
    </View>
  );
}

export function Selector({ etiqueta, valor, opciones, onCambiar, error, deshabilitado, placeholder = 'Seleccione…' }) {
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find((o) => o.id === valor);
  return (
    <View style={s.campo}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <Pressable
        onPress={() => setAbierto(true)} disabled={deshabilitado}
        accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${actual?.nombre ?? 'sin seleccionar'}`}
        style={[s.input, s.selector, error && s.inputError, deshabilitado && { backgroundColor: '#e6eae9' }]}
      >
        <Text style={{ color: actual ? colores.tinta : '#8a9a9d' }}>{actual?.nombre ?? placeholder}</Text>
        <Text style={{ color: colores.tenue }}>▾</Text>
      </Pressable>
      {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={s.velo} onPress={() => setAbierto(false)}>
          <View style={s.hoja}>
            <Text style={s.hojaTitulo}>{etiqueta}</Text>
            <ScrollView>
              {opciones.map((o) => (
                <Pressable key={o.id} style={[s.opcion, o.id === valor && s.opcionSel]} onPress={() => { onCambiar(o.id); setAbierto(false); }} accessibilityRole="button">
                  <Text style={[{ color: colores.tinta }, o.id === valor && { fontWeight: '700' }]}>{o.nombre}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Fila de opción grande y táctil: icono + título + descripción. */
export function Opcion({ icono, titulo, descripcion, onPress, tono = 'normal' }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${titulo}. ${descripcion}`}
      style={({ pressed }) => [e.opcion, pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 }]}>
      <View style={[e.opcionIcono, tono === 'suave' && { backgroundColor: '#dfe9e7' }]}>
        <Ionicons name={icono} size={26} color={tono === 'suave' ? colores.petroleo2 : colores.señal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={e.opcionTitulo}>{titulo}</Text>
        <Text style={e.opcionDesc}>{descripcion}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colores.tenue} />
    </Pressable>
  );
}

export function BandaSimulacion() {
  return (
    <View style={s.banda} accessibilityRole="summary">
      <Text style={s.bandaTxt}>Sistema académico · datos ficticios · validación de Defensa simulada</Text>
    </View>
  );
}

const e = StyleSheet.create({
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, ...sombra.suave },
  opcionIcono: { width: 52, height: 52, borderRadius: 14, backgroundColor: colores.petroleo2, alignItems: 'center', justifyContent: 'center' },
  opcionTitulo: { fontWeight: '800', fontSize: 16, color: colores.tinta },
  opcionDesc: { color: colores.tenue, fontSize: 13, marginTop: 2 },
});

const s = StyleSheet.create({
  campo: { marginBottom: 14 },
  etiqueta: { fontWeight: '600', fontSize: 13, color: colores.tinta, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#93a5a8', borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, minHeight: 46, fontSize: 16, color: colores.tinta },
  inputError: { borderColor: colores.peligro, borderWidth: 2 },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { color: colores.peligro, fontSize: 13, marginTop: 3 },
  ayuda: { color: colores.tenue, fontSize: 13, marginTop: 3 },
  boton: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 6 },
  botonPri: { backgroundColor: colores.petroleo2, ...sombra.suave },
  botonSec: { backgroundColor: '#fff', borderWidth: 1, borderColor: colores.petroleo },
  botonTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  aviso: { borderLeftWidth: 4, backgroundColor: '#fff', padding: 10, marginBottom: 14, borderRadius: 2 },
  velo: { flex: 1, backgroundColor: 'rgba(14,30,32,.55)', justifyContent: 'flex-end' },
  hoja: { backgroundColor: '#fff', maxHeight: '70%', borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingTop: 14, borderTopWidth: 4, borderTopColor: colores.señal },
  hojaTitulo: { fontWeight: '700', fontSize: 16, paddingHorizontal: 16, paddingBottom: 8 },
  opcion: { paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colores.linea },
  opcionSel: { backgroundColor: '#eaf2f1' },
  banda: { backgroundColor: colores.señal, paddingVertical: 4, paddingHorizontal: 10 },
  bandaTxt: { fontSize: 11, fontWeight: '700', color: '#2b2100', textAlign: 'center' },
});