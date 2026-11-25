import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import Guilloche from '../components/Guilloche';
import { Aviso, Boton, Opcion } from '../components/ui';
import { colores, sombra } from '../theme';

export default function Home({ onConsultar, onHistorial, onNuevaNovedad, onMisNovedades, onDiagnostico }) {
  const { usuario, logout } = useAuth();
  const p = usuario.permisos ?? [];
  const puedeConsultar = p.includes('consultas:crear');
  const puedeHistorial = p.includes('consultas:leer');
  const puedeCrearNovedad = p.includes('novedades:crear');
  const puedeMisNovedades = p.includes('novedades:leer_propias');
  const tieneOpciones = puedeConsultar || puedeHistorial || puedeCrearNovedad || puedeMisNovedades;

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={s.cabecera}>
        <Guilloche ancho={420} alto={220} lineas={20} opacidad={0.14} />
        <Text style={s.saludo}>{saludo}</Text>
        <Text style={s.nombre}>{usuario.nombres} {usuario.apellidos}</Text>
        <View style={s.chip}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#c4b5fd" />
          <Text style={s.chipTxt}>{usuario.rol} · ID {usuario.identificacion}</Text>
        </View>
      </View>
      <View style={s.cuerpo}>
        {tieneOpciones ? (
          <>
            <Text style={s.titulo}>¿Qué necesita hacer?</Text>
            {puedeConsultar && (
              <Opcion
                icono="search"
                titulo="Consultar un ciudadano"
                descripcion="Lea la cédula o escriba el número para ver su estado"
                onPress={onConsultar}
              />
            )}
            {puedeHistorial && (
              <Opcion
                icono="time-outline"
                titulo="Historial de consultas"
                descripcion="Revise las verificaciones realizadas desde su cuenta"
                onPress={onHistorial}
              />
            )}
            {puedeCrearNovedad && (
              <Opcion
                icono="flag-outline"
                titulo="Registrar novedad"
                descripcion="Reporte una inconsistencia o novedad sobre un ciudadano"
                onPress={onNuevaNovedad}
              />
            )}
            {puedeMisNovedades && (
              <Opcion
                icono="list-outline"
                titulo="Mis novedades"
                descripcion="Consulte el estado y respuesta de sus novedades reportadas"
                onPress={onMisNovedades}
              />
            )}
            {puedeConsultar && (
              <Opcion
                icono="scan-outline"
                titulo="Diagnóstico del lector"
                descripcion="Herramienta para probar la lectura de una cédula"
                onPress={onDiagnostico}
              />
            )}
          </>
        ) : (
          <Aviso tipo="error">Su rol no tiene opciones habilitadas en la aplicación móvil.</Aviso>
        )}
        <Boton titulo="Cerrar sesión" variante="secundario" onPress={logout} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cabecera: {
    backgroundColor: colores.panel,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 32,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colores.linea,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    ...sombra.media,
  },
  saludo: { color: '#a78bfa', fontWeight: '700', fontSize: 13 },
  nombre: { color: '#ffffff', fontSize: 25, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  chip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 14,
  },
  chipTxt: { color: '#e9d5ff', fontWeight: '700', fontSize: 12 },
  cuerpo: { padding: 20, paddingTop: 24 },
  titulo: { fontSize: 18, fontWeight: '800', color: colores.tinta, marginBottom: 14 },
});