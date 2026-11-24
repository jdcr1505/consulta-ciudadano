import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { post } from '../api/client';
import { Aviso, Boton, Campo } from '../components/ui';
import { colores } from '../theme';
import { validarNovedad } from '../validation';

/** HU08 — Registrar una novedad sobre un ciudadano registrado en el sistema. */
export default function NuevaNovedad({ identificacionInicial = '', onRegistrada, onVolver }) {
  const [identificacion, setIdentificacion] = useState(identificacionInicial);
  const [descripcion, setDescripcion] = useState('');
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setGeneral('');
    const e = validarNovedad({ identificacion, descripcion });
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    setEnviando(true);
    try {
      const d = await post('/novedades', {
        identificacion: identificacion.replace(/\D/g, '').replace(/^0+/, ''),
        descripcion: descripcion.trim(),
      });
      onRegistrada(d.novedad);
    } catch (err) {
      setErrores(err.campos ?? {});
      if (!err.details?.length) setGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.cont} keyboardShouldPersistTaps="handled">
        <Text style={s.titulo}>Registrar novedad</Text>
        <Text style={s.nota}>
          Reporte una inconsistencia o situación observada respecto a un ciudadano registrado en el sistema.
        </Text>

        {general ? <Aviso tipo="error">{general}</Aviso> : null}

        <Campo
          etiqueta="Identificación del ciudadano"
          value={identificacion}
          onChangeText={(t) => setIdentificacion(t.replace(/\D/g, '').slice(0, 10))}
          error={errores.identificacion}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="Entre 6 y 10 dígitos"
        />

        <Campo
          etiqueta="Descripción detallada de la novedad"
          value={descripcion}
          onChangeText={setDescripcion}
          error={errores.descripcion}
          ayuda={`${descripcion.trim().length} / 1000 caracteres (mínimo 10)`}
          multiline
          numberOfLines={5}
          maxLength={1000}
          style={s.area}
          placeholder="Describa claramente la novedad encontrada…"
        />

        <Boton titulo="Enviar novedad" onPress={enviar} cargando={enviando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onVolver} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cont: { padding: 22, paddingTop: 26, paddingBottom: 32 },
  titulo: { fontSize: 26, fontWeight: '800', color: colores.petroleo, letterSpacing: -0.5 },
  nota: { color: colores.tenue, marginTop: 6, marginBottom: 18 },
  area: { minHeight: 120, textAlignVertical: 'top' },
});