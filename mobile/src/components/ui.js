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
        placeholderTextColor="#71717a"
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
      style={({ pressed }) => [s.boton, sec ? s.botonSec : s.botonPri, (cargando || disabled) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
    >
      {cargando ? <ActivityIndicator color="#fff" /> : <Text style={[s.botonTxt, sec && { color: colores.tinta }]}>{titulo}</Text>}
    </Pressable>
  );
}

export function Aviso({ tipo = 'info', children }) {
  const color = tipo === 'error' ? colores.peligro : tipo === 'ok' ? colores.verde : colores.petroleo3;
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
        style={[s.input, s.selector, error && s.inputError, deshabilitado && { backgroundColor: '#16161a' }]}
      >
        <Text style={{ color: actual ? colores.tinta : '#71717a' }}>{actual?.nombre ?? placeholder}</Text>
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
                  <Text style={[{ color: colores.tinta }, o.id === valor && { fontWeight: '700', color: '#c4b5fd' }]}>{o.nombre}</Text>
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
export function Opcion({ icono, titulo, descripcion, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${titulo}. ${descripcion}`}
      style={({ pressed }) => [e.opcion, pressed && { transform: [{ scale: 0.985 }], opacity: 0.9 }]}>
      <View style={e.opcionIcono}>
        <Ionicons name={icono} size={24} color="#c4b5fd" />
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
  return null;
}

const e = StyleSheet.create({
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colores.panel, borderWidth: 1, borderColor: colores.linea, borderRadius: 14, padding: 14, marginBottom: 12, ...sombra.suave },
  opcionIcono: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(139, 92, 246, 0.14)', borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)', alignItems: 'center', justifyContent: 'center' },
  opcionTitulo: { fontWeight: '700', fontSize: 16, color: colores.tinta },
  opcionDesc: { color: colores.tenue, fontSize: 13, marginTop: 2 },
});

const s = StyleSheet.create({
  campo: { marginBottom: 14 },
  etiqueta: { fontWeight: '600', fontSize: 13, color: '#e4e4e7', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#2e2e34', borderRadius: 8, backgroundColor: colores.fondo, paddingHorizontal: 13, paddingVertical: 10, minHeight: 46, fontSize: 16, color: colores.tinta },
  inputError: { borderColor: colores.peligro, borderWidth: 1.5 },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { color: '#f87171', fontSize: 13, marginTop: 4 },
  ayuda: { color: colores.tenue, fontSize: 13, marginTop: 4 },
  boton: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  botonPri: { backgroundColor: colores.petroleo2, ...sombra.suave },
  botonSec: { backgroundColor: '#18181d', borderWidth: 1, borderColor: '#323238' },
  botonTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  aviso: { borderLeftWidth: 4, borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.panel, padding: 12, marginBottom: 14, borderRadius: 8 },
  velo: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.78)', justifyContent: 'flex-end' },
  hoja: { backgroundColor: colores.panel, maxHeight: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16, borderTopWidth: 3, borderTopColor: colores.señal },
  hojaTitulo: { fontWeight: '700', fontSize: 16, color: colores.tinta, paddingHorizontal: 16, paddingBottom: 10 },
  opcion: { paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colores.linea },
  opcionSel: { backgroundColor: 'rgba(139, 92, 246, 0.16)' },
});