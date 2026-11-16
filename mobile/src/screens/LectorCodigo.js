import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton } from '../components/ui';
import { extraerIdentificacionPdf417 } from '../scanner/analisis';
import { colores } from '../theme';

/** Cédula amarilla: lee el código PDF417 y propone el número para que el funcionario lo confirme. */
export default function LectorCodigo({ onNumeros, onManual, onVolver }) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [linterna, setLinterna] = useState(false);
  const [aviso, setAviso] = useState('');
  const ocupado = useRef(false);

  if (!permiso) return <View style={s.centro}><Text>Comprobando permiso de cámara…</Text></View>;
  if (!permiso.granted) {
    return (
      <ScrollView contentContainerStyle={s.cont}>
        <Text style={s.titulo}>Permiso de cámara</Text>
        <Text style={s.nota}>Para leer el código de barras de la cédula necesitamos usar la cámara. La imagen no se guarda ni se envía.</Text>
        {permiso.canAskAgain === false && <Aviso tipo="error">El permiso fue denegado. Actívelo desde los ajustes del teléfono.</Aviso>}
        <Boton titulo="Permitir cámara" onPress={pedirPermiso} />
        <Boton titulo="Escribir el número" variante="secundario" onPress={onManual} />
        <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
      </ScrollView>
    );
  }

  function alLeer({ data }) {
    if (ocupado.current) return;
    ocupado.current = true;
    const numeros = extraerIdentificacionPdf417(data);
    if (numeros.length === 0) {
      setAviso('Se leyó un código, pero no contiene un número de cédula. Verifique que sea el código largo de la parte de atrás.');
      setTimeout(() => { ocupado.current = false; }, 1800);
      return;
    }
    onNumeros(numeros);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={{ flex: 1 }} facing="back" enableTorch={linterna} barcodeScannerSettings={{ barcodeTypes: ['pdf417'] }} onBarcodeScanned={alLeer} />
      <View style={s.guia} pointerEvents="none"><View style={s.marco} /></View>
      <Pressable style={s.linterna} onPress={() => setLinterna((v) => !v)} accessibilityRole="button" accessibilityLabel={linterna ? 'Apagar linterna' : 'Encender linterna'}>
        <Ionicons name={linterna ? 'flash-outline' : 'flash-off-outline'} size={22} color="#fff" />
      </Pressable>
      <View style={s.pie}>
        {aviso ? <Aviso tipo="error">{aviso}</Aviso> : <Text style={s.pieTxt}>Ubique el código largo dentro del marco. Buena luz, a 15–20 cm, sin mover el teléfono. Si no lee, pruebe en horizontal.</Text>}
        <Boton titulo="Escribir el número" variante="secundario" onPress={onManual} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onVolver} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cont: { padding: 24, paddingTop: 28 },
  titulo: { fontSize: 24, fontWeight: '800', color: colores.petroleo, marginBottom: 8 },
  nota: { color: colores.tenue, marginBottom: 14 },
  guia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 230, alignItems: 'center', justifyContent: 'center' },
  marco: { width: '86%', height: 130, borderWidth: 3, borderColor: colores.señal, borderRadius: 12, backgroundColor: 'rgba(242,183,5,.08)' },
  linterna: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,.5)', width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  pie: { backgroundColor: colores.fondo, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  pieTxt: { color: colores.tinta, marginBottom: 8 },
});
