import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { post } from './src/api/client';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { BandaSimulacion } from './src/components/ui';
import CambiarPassword from './src/screens/CambiarPassword';
import ConfirmarNumero from './src/screens/ConfirmarNumero';
import ConsultaManual from './src/screens/ConsultaManual';
import Diagnostico from './src/screens/Diagnostico';
import Home from './src/screens/Home';
import LectorCodigo from './src/screens/LectorCodigo';
import LectorMrz from './src/screens/LectorMrz';
import Login from './src/screens/Login';
import NuevaConsulta from './src/screens/NuevaConsulta';
import Registro from './src/screens/Registro';
import Resultado from './src/screens/Resultado';
import { colores } from './src/theme';

function Raiz() {
  const { usuario, cargando } = useAuth();
  const [pantalla, setPantalla] = useState('login');
  const [aviso, setAviso] = useState('');
  const [vista, setVista] = useState({ n: 'inicio' });
  const [consultando, setConsultando] = useState(false);
  const ir = (n, extra = {}) => setVista({ n, ...extra });

  // HU04–HU06: la consulta la resuelve el servidor, que valida, busca y registra. Un error NUNCA se muestra como "No requerido".
  async function consultar(identificacion, origen) {
    setConsultando(true);
    try {
      const datos = await post('/consultas', { identificacion, origen });
      ir('resultado', { tipo: 'ok', datos, identificacion });
    } catch (e) {
      if (e.code === 'CIUDADANO_NO_ENCONTRADO') ir('resultado', { tipo: 'sinregistro', identificacion });
      else ir('resultado', { tipo: 'error', codigo: e.code, mensaje: e.message, identificacion });
    } finally {
      setConsultando(false);
    }
  }

  if (cargando) return <View style={s.centro}><ActivityIndicator size="large" color={colores.petroleo} accessibilityLabel="Cargando" /></View>;

  if (usuario) {
    if (usuario.debeCambiarPassword) return <CambiarPassword />;
    switch (vista.n) {
      case 'consulta': return <NuevaConsulta onCodigo={() => ir('codigo')} onMrz={() => ir('mrz')} onManual={() => ir('manual')} onVolver={() => ir('inicio')} />;
      case 'codigo': return <LectorCodigo onNumeros={(numeros) => ir('confirmar', { numeros, volver: 'codigo' })} onManual={() => ir('manual')} onVolver={() => ir('consulta')} />;
      case 'mrz': return <LectorMrz onNumero={(n) => ir('confirmar', { numeros: [n], volver: 'mrz' })} onManual={() => ir('manual')} onVolver={() => ir('consulta')} />;
      case 'manual': return <ConsultaManual onConsultar={consultar} onVolver={() => ir('consulta')} consultando={consultando} />;
      case 'confirmar': return <ConfirmarNumero numeros={vista.numeros} onConsultar={consultar} onLeerDeNuevo={() => ir(vista.volver)} consultando={consultando} />;
      case 'resultado': return <Resultado vista={vista} onNueva={() => ir('consulta')} onInicio={() => ir('inicio')} />;
      case 'diagnostico': return <Diagnostico onVolver={() => ir('inicio')} />;
      default: return <Home onConsultar={() => ir('consulta')} onDiagnostico={() => ir('diagnostico')} />;
    }
  }
  if (pantalla === 'registro') return <Registro onVolver={() => setPantalla('login')} onRegistrado={(m) => { setAviso(m); setPantalla('login'); }} />;
  return <Login aviso={aviso} onRegistro={() => { setAviso(''); setPantalla('registro'); }} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafeAreaView style={s.raiz}>
          <StatusBar style="dark" />
          <BandaSimulacion />
          <Raiz />
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
