import { ScrollView, StyleSheet, Text } from 'react-native';
import { Boton, Opcion } from '../components/ui';
import { colores } from '../theme';

export default function NuevaConsulta({ onCodigo, onMrz, onManual, onVolver }) {
  return (
    <ScrollView contentContainerStyle={s.cont}>
      <Text style={s.titulo}>Consultar ciudadano</Text>
      <Text style={s.nota}>Elija cómo ingresar la cédula. Siempre podrá verificar el número antes de consultar.</Text>
      <Opcion icono="barcode-outline" titulo="Cédula amarilla" descripcion="Escanee el código de barras largo de la parte de atrás" onPress={onCodigo} />
      <Opcion icono="card-outline" titulo="Cédula digital" descripcion="Fotografíe las líneas de letras con signos < de atrás (zona MRZ)" onPress={onMrz} />
      <Opcion icono="keypad-outline" titulo="Escribir el número" descripcion="Si no puede escanear, digítelo a mano" onPress={onManual} />
      <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cont: { padding: 22, paddingTop: 28 },
  titulo: { fontSize: 26, fontWeight: '800', color: colores.tinta, letterSpacing: -0.5 },
  nota: { color: colores.tenue, marginTop: 6, marginBottom: 22 },
});