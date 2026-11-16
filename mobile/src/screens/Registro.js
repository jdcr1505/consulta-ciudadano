import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { get, post } from '../api/client';
import { Aviso, Boton, Campo, Selector } from '../components/ui';
import { colores } from '../theme';
import { validarRegistro } from '../validation';

const VACIO = { identificacion: '', nombres: '', apellidos: '', fuerzaPublicaId: null, rangoId: null, idFuerza: '', correo: '' };

export default function Registro({ onVolver, onRegistrado }) {
  const [f, setF] = useState(VACIO);
  const [fuerzas, setFuerzas] = useState(null);
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cargarFuerzas = () => {
    setGeneral('');
    setFuerzas(null);
    get('/catalogos/fuerzas').then((d) => setFuerzas(d.fuerzas)).catch((e) => { setFuerzas([]); setGeneral(e.message); });
  };
  useEffect(cargarFuerzas, []);

  const rangos = useMemo(() => fuerzas?.find((x) => x.id === f.fuerzaPublicaId)?.rangos ?? [], [fuerzas, f.fuerzaPublicaId]);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  async function enviar() {
    setGeneral('');
    const e = validarRegistro(f);
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      setResultado(await post('/solicitudes', {
        identificacion: f.identificacion.trim(), nombres: f.nombres, apellidos: f.apellidos, fuerzaPublicaId: f.fuerzaPublicaId,
        rangoId: f.rangoId, idFuerza: f.idFuerza.trim(), correo: f.correo.trim(),
      }));
    } catch (err) {
      setErrores(err.campos ?? {});
      if (!err.details?.length) setGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    const ok = resultado.estado === 'VALIDADA';
    return (
      <ScrollView contentContainerStyle={s.cont}>
        <Text style={s.titulo}>{ok ? 'Registro validado' : 'Solicitud en revisión'}</Text>
        <Aviso tipo={ok ? 'ok' : 'info'}>{resultado.mensaje}</Aviso>
        {ok && <Text style={s.nota}>Revise su correo, ingrese con su identificación y la contraseña temporal, y cámbiela en el primer acceso.</Text>}
        <Boton titulo="Ir a iniciar sesión" onPress={() => onRegistrado(ok ? 'Registro validado. Use la contraseña temporal enviada a su correo.' : 'Su solicitud está pendiente de revisión por un administrador.')} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.cont} keyboardShouldPersistTaps="handled">
        <Text style={s.titulo}>Solicitar acceso</Text>
        <Text style={s.nota}>Sus datos se validan contra la fuente del Departamento de Defensa (en este proyecto, una simulación con datos ficticios).</Text>
        {general ? <Aviso tipo="error">{general}</Aviso> : null}
        <Campo etiqueta="Identificación" value={f.identificacion} onChangeText={set('identificacion')} error={errores.identificacion} keyboardType="number-pad" maxLength={10} />
        <Campo etiqueta="Nombres" value={f.nombres} onChangeText={set('nombres')} error={errores.nombres} autoCapitalize="words" />
        <Campo etiqueta="Apellidos" value={f.apellidos} onChangeText={set('apellidos')} error={errores.apellidos} autoCapitalize="words" />
        {fuerzas === null ? <ActivityIndicator color={colores.petroleo} accessibilityLabel="Cargando fuerzas" /> : (
          <>
            <Selector etiqueta="Fuerza pública" valor={f.fuerzaPublicaId} opciones={fuerzas} error={errores.fuerzaPublicaId}
              onCambiar={(id) => setF((p) => ({ ...p, fuerzaPublicaId: id, rangoId: null }))} />
            <Selector etiqueta="Rango" valor={f.rangoId} opciones={rangos} error={errores.rangoId} deshabilitado={!f.fuerzaPublicaId}
              placeholder={f.fuerzaPublicaId ? 'Seleccione…' : 'Elija primero la fuerza'} onCambiar={set('rangoId')} />
          </>
        )}
        <Campo etiqueta="ID Fuerza" value={f.idFuerza} onChangeText={set('idFuerza')} error={errores.idFuerza} autoCapitalize="characters" />
        <Campo etiqueta="Correo electrónico" value={f.correo} onChangeText={set('correo')} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        {fuerzas !== null && fuerzas.length === 0 && <Boton titulo="Reintentar cargar fuerzas" variante="secundario" onPress={cargarFuerzas} />}
        <Boton titulo="Enviar solicitud" onPress={enviar} cargando={enviando} disabled={fuerzas === null || fuerzas.length === 0} />
        <Boton titulo="Volver" variante="secundario" onPress={onVolver} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cont: { padding: 24, paddingTop: 28 },
  titulo: { fontSize: 24, fontWeight: '800', color: colores.petroleo, marginBottom: 8 },
  nota: { color: colores.tenue, marginBottom: 16 },
});
