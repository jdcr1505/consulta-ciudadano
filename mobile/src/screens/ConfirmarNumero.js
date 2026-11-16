import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton } from '../components/ui';
import { formatoMiles } from '../scanner/analisis';
import { colores, sombra } from '../theme';

/** El número leído nunca se consulta a ciegas: el funcionario lo compara con la cédula física y lo confirma. */
export default function ConfirmarNumero({ numeros, onConsultar, onLeerDeNuevo, consultando }) {
  const [sel, setSel] = useState(numeros[0]);
  const varios = numeros.length > 1;
  return (
    <ScrollView contentContainerStyle={s.cont}>
      <Text style={s.titulo}>Verifique el número</Text>
      <Text style={s.nota}>{varios ? 'Se encontraron varios números. Elija el que coincide con la cédula.' : 'Compare este número con el impreso en la cédula.'}</Text>
      {numeros.map((n) => (
        <Pressable key={n} onPress={() => setSel(n)} accessibilityRole="radio" accessibilityState={{ selected: sel === n }} accessibilityLabel={`Número ${formatoMiles(n)}`}
          style={[s.tarjeta, sel === n && s.tarjetaSel]}>
          <Ionicons name={sel === n ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={sel === n ? colores.petroleo2 : colores.tenue} />
          <Text style={s.numero}>{formatoMiles(n)}</Text>
        </Pressable>
      ))}
      {!varios && <Aviso>Si el número no coincide, vuelva a leer la cédula o escríbalo a mano.</Aviso>}
      <Boton titulo="Consultar este número" onPress={() => onConsultar(sel, 'ESCANER')} cargando={consultando} />
      <Boton titulo="Volver a leer" variante="secundario" onPress={onLeerDeNuevo} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cont: { padding: 22, paddingTop: 28 },
  titulo: { fontSize: 26, fontWeight: '800', color: colores.petroleo, letterSpacing: -0.5 },
  nota: { color: colores.tenue, marginTop: 6, marginBottom: 18 },
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: 'transparent', ...sombra.suave },
  tarjetaSel: { borderColor: colores.petroleo2 },
  numero: { fontSize: 28, fontWeight: '800', letterSpacing: 1, color: colores.tinta, fontVariant: ['tabular-nums'] },
});
