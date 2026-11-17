import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { post } from '../api/client';
import { Aviso, Boton } from '../components/ui';
import { colores } from '../theme';

const MENSAJES = {
  MRZ_NO_ENCONTRADA: 'No se encontraron las líneas de la zona MRZ. Encuadre la parte de atrás de la cédula completa, sin reflejos.',
  DIGITO_CONTROL_INVALIDO: 'Se leyeron las líneas, pero los dígitos de control no cuadran (la lectura tiene errores). Intente de nuevo con mejor luz.',
};

/**
 * Cédula digital: el código QR está cifrado, por lo que se lee la zona MRZ (3 líneas de letras y signos "<") con OCR.
 * La foto se envía al servidor solo para esta lectura; no se guarda. Los dígitos de control validan el resultado.
 */
export default function LectorMrz({ onNumero, onManual, onVolver }) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [linterna, setLinterna] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');
  const camara = useRef(null);

  if (!permiso) return <View style={s.centro}><Text>Comprobando permiso de cámara…</Text></View>;
  if (!permiso.granted) {
    return (
      <ScrollView contentContainerStyle={s.cont}>
        <Text style={s.titulo}>Permiso de cámara</Text>
        <Text style={s.nota}>Necesitamos la cámara para fotografiar la parte de atrás de la cédula digital.</Text>
        <Boton titulo="Permitir cámara" onPress={pedirPermiso} />
        <Boton titulo="Escribir el número" variante="secundario" onPress={onManual} />
        <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
      </ScrollView>
    );
  }

  async function capturar() {
    setError('');
    setLeyendo(true);
    try {
      const foto = await camara.current.takePictureAsync({ quality: 0.9 });
      // Se reduce para que la subida sea rápida; se conserva resolución suficiente para el OCR.
      const reducida = await manipulateAsync(foto.uri, [{ resize: { width: 1600 } }], { compress: 0.75, format: SaveFormat.JPEG, base64: true });
      const r = await post('/documentos/mrz', { imagen: reducida.base64 }, { timeoutMs: 60000 });
      if (r.valido) return onNumero(r.identificacion, r.confianza);
      setError(MENSAJES[r.motivo] ?? 'No se pudo leer la zona MRZ. Intente de nuevo.');
    } catch (e) {
      setError(e.code === 'SIN_CONEXION' ? e.message : e.message || 'No se pudo leer la imagen. Intente de nuevo.');
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={camara} style={{ flex: 1 }} facing="back" enableTorch={linterna} />
      <View style={s.guia} pointerEvents="none">
        <View style={s.marco}><Text style={s.marcoTxt}>Zona MRZ{'\n'}ICCOL…<Text style={{ opacity: 0.6 }}>{'<<<<<<'}</Text></Text></View>
      </View>
      <Pressable style={s.linterna} onPress={() => setLinterna((v) => !v)} accessibilityRole="button" accessibilityLabel={linterna ? 'Apagar linterna' : 'Encender linterna'}>
        <Ionicons name={linterna ? 'flash-outline' : 'flash-off-outline'} size={22} color="#fff" />
      </Pressable>
      {leyendo && (
        <View style={s.cargando}><ActivityIndicator size="large" color={colores.señal} /><Text style={s.cargandoTxt}>Leyendo la cédula…</Text></View>
      )}
      <View style={s.pie}>
        {error ? <Aviso tipo="error">{error}</Aviso> : <Text style={s.pieTxt}>Fotografíe la parte de atrás con las 3 líneas de letras y signos «&lt;» dentro del marco. Sin reflejos, con la cédula plana.</Text>}
        <Boton titulo="Tomar foto" onPress={capturar} cargando={leyendo} />
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
  guia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 300, alignItems: 'center', justifyContent: 'center' },
  marco: { width: '92%', height: 150, borderWidth: 3, borderColor: colores.señal, borderRadius: 12, backgroundColor: 'rgba(242,183,5,.08)', justifyContent: 'flex-end', padding: 8 },
  marcoTxt: { color: colores.señal, fontWeight: '700', fontSize: 12 },
  linterna: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,.5)', width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  cargando: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,30,33,.72)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  cargandoTxt: { color: '#fff', fontWeight: '700' },
  pie: { backgroundColor: colores.fondo, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  pieTxt: { color: colores.tinta, marginBottom: 8 },
});
