import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Boton, Campo } from '../components/ui';
import { colores } from '../theme';
import { validarNumeroCedula } from '../validation';

export default function ConsultaManual({ onConsultar, onVolver, consultando }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  function enviar() {
    const r = validarNumeroCedula(texto);
    if (r.error) return setError(r.error);
    setError('');
    onConsultar(r.numero, 'MANUAL');
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.cont} keyboardShouldPersistTaps="handled">
        <Text style={s.titulo}>Escribir el número</Text>
        <Text style={s.nota}>Digite el número de la cédula sin puntos ni espacios.</Text>
        <Campo etiqueta="Número de identificación del ciudadano" value={texto} onChangeText={setTexto} error={error} keyboardType="number-pad" maxLength={12} style={s.grande} autoFocus />
        <Boton titulo="Consultar" onPress={enviar} cargando={consultando} />
        <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cont: { padding: 22, paddingTop: 28 },
  titulo: { fontSize: 26, fontWeight: '800', color: colores.petroleo, letterSpacing: -0.5 },
  nota: { color: colores.tenue, marginTop: 6, marginBottom: 20 },
  grande: { fontSize: 26, fontWeight: '800', letterSpacing: 2, minHeight: 62, borderColor: colores.petroleo2, borderWidth: 2 },
});
