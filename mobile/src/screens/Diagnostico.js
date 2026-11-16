import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton } from '../components/ui';
import { candidatosIdentificacion, resumen, sinCerosIzquierda } from '../scanner/analisis';
import { colores } from '../theme';

/**
 * DIAGNÓSTICO DEL LECTOR (herramienta de apoyo de HU04).
 * Muestra qué tipo de código se lee y cómo está organizado su contenido. NADA se envía a ningún servidor.
 */
export default function Diagnostico({ onVolver }) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [lectura, setLectura] = useState(null);
  const [mostrarDatos, setMostrarDatos] = useState(false);
  const ocupado = useRef(false);

  if (!permiso) return <View style={s.centro}><Text>Comprobando permiso de cámara…</Text></View>;
  if (!permiso.granted) {
    return (
      <ScrollView contentContainerStyle={s.cont}>
        <Text style={s.titulo}>Permiso de cámara</Text>
        <Text style={s.nota}>Para leer el código de barras de la cédula necesitamos usar la cámara. La imagen no se guarda ni se envía.</Text>
        {permiso.canAskAgain === false && <Aviso tipo="error">El permiso fue denegado. Actívelo desde los ajustes del teléfono.</Aviso>}
        <Boton titulo="Permitir cámara" onPress={pedirPermiso} />
        <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
      </ScrollView>
    );
  }

  function alLeer(r) {
    if (ocupado.current) return;
    ocupado.current = true;
    setLectura({ type: r.type, data: r.data, raw: r.raw });
  }
  function reiniciar() { ocupado.current = false; setLectura(null); setMostrarDatos(false); }

  if (lectura) {
    const res = resumen(lectura);
    const cands = candidatosIdentificacion(lectura.data);
    return (
      <ScrollView contentContainerStyle={s.cont}>
        <Text style={s.titulo}>Resultado de la lectura</Text>
        <Aviso>Esta pantalla es una herramienta de prueba. Lo leído se muestra solo aquí y no se envía a ningún servidor.</Aviso>
        <Text style={s.dato}>Tipo de código: <Text style={s.fuerte}>{res.tipo}</Text></Text>
        <Text style={s.dato}>Longitud del contenido: <Text style={s.fuerte}>{res.longitudData}</Text>{res.longitudRaw != null ? ` · raw: ${res.longitudRaw}` : ''}</Text>
        <Text style={s.sub}>Forma del contenido (se puede compartir)</Text>
        <Text style={s.leyenda}>9 = dígito · A = letra · _ = espacio · # = símbolo · · = byte no imprimible</Text>
        <Text selectable style={s.mono}>{res.huella}</Text>
        <Text style={s.sub}>Números de 6 a 10 dígitos encontrados</Text>
        {cands.length === 0 ? <Text style={s.nota}>Ninguno.</Text> : cands.map((c) => (
          <Text key={c.posicion} style={s.dato}>
            posición {c.posicion}, {c.longitud} dígitos{mostrarDatos ? `: ${c.valor}  (sin ceros: ${sinCerosIzquierda(c.valor)})` : ''}
          </Text>
        ))}
        <Boton titulo={mostrarDatos ? 'Ocultar los números' : 'Ver los números (datos personales)'} variante="secundario" onPress={() => setMostrarDatos((v) => !v)} />
        {mostrarDatos && <Text style={s.alerta}>Está viendo datos personales de la cédula. No los comparta ni los capture en pantalla.</Text>}
        <Boton titulo="Leer otra cédula" onPress={reiniciar} />
        <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['pdf417', 'qr', 'code128', 'code39', 'datamatrix', 'aztec'] }}
        onBarcodeScanned={alLeer}
      />
      <View style={s.pie}>
        <Text style={s.pieTxt}>Apunte al código de la parte de atrás de la cédula. Buena luz, a 15–20 cm, sin mover el teléfono. Si no lee, pruebe en horizontal.</Text>
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
  dato: { color: colores.tinta, marginBottom: 6, fontSize: 15 },
  fuerte: { fontWeight: '800' },
  sub: { fontWeight: '700', color: colores.petroleo, marginTop: 14, marginBottom: 4 },
  leyenda: { color: colores.tenue, fontSize: 12, marginBottom: 6 },
  mono: { fontFamily: 'monospace', fontSize: 12, backgroundColor: '#fff', padding: 8, borderWidth: 1, borderColor: colores.linea, marginBottom: 10 },
  alerta: { color: colores.peligro, marginBottom: 10 },
  pie: { backgroundColor: colores.fondo, padding: 16 },
  pieTxt: { color: colores.tinta, marginBottom: 8 },
});
