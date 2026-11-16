import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import Guilloche from '../components/Guilloche';
import { Aviso, Boton, Opcion } from '../components/ui';
import { colores, sombra } from '../theme';

export default function Home({ onConsultar, onDiagnostico }) {
  const { usuario, logout } = useAuth();
  const puedeConsultar = usuario.permisos.includes('consultas:crear');
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={s.cabecera}>
        <Guilloche ancho={420} alto={220} lineas={20} opacidad={0.22} />
        <Text style={s.saludo}>{saludo}</Text>
        <Text style={s.nombre}>{usuario.nombres} {usuario.apellidos}</Text>
        <View style={s.chip}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colores.petroleo} />
          <Text style={s.chipTxt}>{usuario.rol} · ID {usuario.identificacion}</Text>
        </View>
      </View>
      <View style={s.cuerpo}>
        {puedeConsultar ? (
          <>
            <Text style={s.titulo}>¿Qué necesita hacer?</Text>
            <Opcion icono="search" titulo="Consultar un ciudadano" descripcion="Lea la cédula o escriba el número para ver su estado" onPress={onConsultar} />
            <Opcion icono="scan-outline" titulo="Diagnóstico del lector" descripcion="Herramienta para probar la lectura de una cédula" tono="suave" onPress={onDiagnostico} />
          </>
        ) : (
          <Aviso tipo="error">Su rol no tiene permiso para consultar ciudadanos desde la aplicación móvil.</Aviso>
        )}
        <Boton titulo="Cerrar sesión" variante="secundario" onPress={logout} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cabecera: { backgroundColor: colores.petroleo2, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 34, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: colores.señal, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, ...sombra.media },
  saludo: { color: '#b6d0cd', fontWeight: '600' },
  nombre: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  chip: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, backgroundColor: colores.señal, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 14 },
  chipTxt: { color: colores.petroleo, fontWeight: '800', fontSize: 12 },
  cuerpo: { padding: 20, paddingTop: 24 },
  titulo: { fontSize: 18, fontWeight: '800', color: colores.tinta, marginBottom: 14 },
});
