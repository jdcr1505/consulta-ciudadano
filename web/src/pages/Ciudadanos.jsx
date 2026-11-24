import { useCallback, useEffect, useState } from 'react';
import { get, patch, post, qs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Icono } from '../components/icons.jsx';
import { Aviso, Boton, Campo, Confirmar, Dialogo, EstadoVacio, Esqueleto, Iniciales, Insignia, Paginacion, useToast } from '../components/ui.jsx';

const VACIO = {
  identificacion: '', nombres: '', apellidos: '', fechaNacimiento: '', lugarNacimiento: '', fechaExpedicion: '', lugarExpedicion: '',
  rh: '', grupoSanguineo: '', estaturaCm: '', estadoJudicial: 'NO_REQUERIDO',
};

function FormularioCiudadano({ inicial, onCerrar, onGuardado }) {
  const edicion = Boolean(inicial);
  const [f, setF] = useState(inicial ? { ...inicial, estaturaCm: String(inicial.estaturaCm) } : VACIO);
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    setGeneral('');
    const obligatorios = ['identificacion', 'nombres', 'apellidos', 'fechaNacimiento', 'lugarNacimiento', 'fechaExpedicion', 'lugarExpedicion', 'rh', 'grupoSanguineo', 'estaturaCm'];
    const faltan = Object.fromEntries(obligatorios.filter((k) => !String(f[k]).trim()).map((k) => [k, 'Este campo es obligatorio']));
    setErrores(faltan);
    if (Object.keys(faltan).length) return;
    setEnviando(true);
    try {
      const { identificacion, id, activo, ...datos } = f;
      const cuerpo = { ...datos, estaturaCm: Number(datos.estaturaCm) };
      if (edicion) await patch(`/ciudadanos/${inicial.id}`, cuerpo);
      else await post('/ciudadanos', { identificacion: identificacion.trim(), ...cuerpo });
      onGuardado(edicion ? 'Ciudadano actualizado' : 'Ciudadano registrado');
    } catch (err) {
      setErrores(err.campos ?? {});
      if (!err.details?.length) setGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const texto = (k, etiqueta, extra = {}) => (
    <Campo etiqueta={etiqueta} error={errores[k]}>
      {(id, inv) => <input id={id} value={f[k]} onChange={set(k)} aria-invalid={inv || undefined} {...extra} />}
    </Campo>
  );

  return (
    <Dialogo titulo={edicion ? 'Editar ciudadano' : 'Registrar ciudadano'} onCerrar={onCerrar} ancho={680}>
      <form onSubmit={enviar} noValidate>
        {general && <Aviso tipo="error">{general}</Aviso>}
        <div className="rejilla">
          {texto('identificacion', 'Identificación', { disabled: edicion, inputMode: 'numeric', maxLength: 10 })}
          {texto('estaturaCm', 'Estatura (cm)', { inputMode: 'numeric' })}
          {texto('nombres', 'Nombres')}
          {texto('apellidos', 'Apellidos')}
          {texto('fechaNacimiento', 'Fecha de nacimiento', { type: 'date' })}
          {texto('lugarNacimiento', 'Lugar de nacimiento')}
          {texto('fechaExpedicion', 'Fecha de expedición', { type: 'date' })}
          {texto('lugarExpedicion', 'Lugar de expedición')}
          <Campo etiqueta="RH" error={errores.rh}>
            {(id, inv) => (
              <select id={id} value={f.rh} onChange={set('rh')} aria-invalid={inv || undefined}>
                <option value="">Seleccione…</option><option value="POSITIVO">Positivo (+)</option><option value="NEGATIVO">Negativo (−)</option>
              </select>
            )}
          </Campo>
          <Campo etiqueta="Grupo sanguíneo" error={errores.grupoSanguineo}>
            {(id, inv) => (
              <select id={id} value={f.grupoSanguineo} onChange={set('grupoSanguineo')} aria-invalid={inv || undefined}>
                <option value="">Seleccione…</option>{['A', 'B', 'AB', 'O'].map((g) => <option key={g}>{g}</option>)}
              </select>
            )}
          </Campo>
          <Campo etiqueta="Estado judicial (simulado)" error={errores.estadoJudicial}>
            {(id) => (
              <select id={id} value={f.estadoJudicial} onChange={set('estadoJudicial')}>
                <option value="NO_REQUERIDO">No requerido</option><option value="REQUERIDO">Requerido</option>
              </select>
            )}
          </Campo>
        </div>
        <div className="acciones">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" cargando={enviando}>{edicion ? 'Guardar cambios' : 'Registrar'}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

export default function Ciudadanos() {
  const { puede } = useAuth();
  const [filtros, setFiltros] = useState({ q: '', estadoJudicial: '', activo: '' });
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const avisar = useToast();
  const [form, setForm] = useState(null); // null | 'nuevo' | ciudadano
  const [confirmar, setConfirmar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorConfirmar, setErrorConfirmar] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setDatos(await get(`/ciudadanos${qs({ ...filtros, page, pageSize: 10 })}`));
    } catch (e) {
      setError(e.message);
      setDatos({ items: [], total: 0 });
    }
  }, [filtros, page]);

  useEffect(() => {
    const t = setTimeout(cargar, 250); // pequeña espera mientras se escribe en la búsqueda
    return () => clearTimeout(t);
  }, [cargar]);

  const cambiarFiltro = (k) => (e) => { setPage(1); setFiltros((p) => ({ ...p, [k]: e.target.value })); };

  async function alternarActivo() {
    setProcesando(true); setErrorConfirmar('');
    try {
      await patch(`/ciudadanos/${confirmar.id}/activo`, { activo: !confirmar.activo });
      avisar(confirmar.activo ? 'Ciudadano desactivado' : 'Ciudadano activado');
      setConfirmar(null);
      cargar();
    } catch (e) { setErrorConfirmar(e.message); } finally { setProcesando(false); }
  }

  return (
    <section>
      <header className="encabezado">
        <div><h1>Ciudadanos</h1><p>Registro y consulta de la información general del ciudadano.</p></div>
        {puede('ciudadanos:crear') && <Boton onClick={() => setForm('nuevo')}><Icono nombre="mas" tam={16} />Registrar ciudadano</Boton>}
      </header>
      <div className="filtros" role="search">
        <Campo etiqueta="Buscar por identificación o nombre">{(id) => <input id={id} value={filtros.q} onChange={cambiarFiltro('q')} />}</Campo>
        <Campo etiqueta="Estado judicial">
          {(id) => <select id={id} value={filtros.estadoJudicial} onChange={cambiarFiltro('estadoJudicial')}><option value="">Todos</option><option value="REQUERIDO">Requerido</option><option value="NO_REQUERIDO">No requerido</option></select>}
        </Campo>
        <Campo etiqueta="Registro">
          {(id) => <select id={id} value={filtros.activo} onChange={cambiarFiltro('activo')}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select>}
        </Campo>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!datos ? <Esqueleto columnas={8} /> : (
        <>
          <div className="tabla-envoltorio">
            <table>
              <thead><tr><th>Identificación</th><th>Nombre</th><th>Nacimiento</th><th>Sangre</th><th>Estatura</th><th>Estado judicial</th><th>Registro</th><th><span className="sr">Acciones</span></th></tr></thead>
              <tbody>
                {datos.items.map((c) => (
                  <tr key={c.id} className={c.activo ? '' : 'inactiva'}>
                    <td className="num">{c.identificacion}</td>
                    <td><span className="persona"><Iniciales nombres={c.nombres} apellidos={c.apellidos} />{c.nombres} {c.apellidos}</span></td>
                    <td>{c.fechaNacimiento}<br /><small>{c.lugarNacimiento}</small></td>
                    <td>{c.grupoSanguineo}{c.rh === 'POSITIVO' ? '+' : '−'}</td>
                    <td>{c.estaturaCm} cm</td>
                    <td><Insignia tono={c.estadoJudicial === 'REQUERIDO' ? 'alerta' : 'ok'}>{c.estadoJudicial === 'REQUERIDO' ? 'Requerido' : 'No requerido'}</Insignia></td>
                    <td>{c.activo ? 'Activo' : 'Inactivo'}</td>
                    <td className="fila-acciones">
                      {puede('ciudadanos:editar') && <button className="enlace" onClick={() => setForm(c)}>Editar</button>}
                      {puede('ciudadanos:editar') && <button className="enlace" onClick={() => { setErrorConfirmar(''); setConfirmar(c); }}>{c.activo ? 'Desactivar' : 'Activar'}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {datos.items.length === 0 && <EstadoVacio titulo="No se encontraron ciudadanos">Pruebe con otra búsqueda o registre un ciudadano nuevo.</EstadoVacio>}
          </div>
          <Paginacion page={page} pageSize={10} total={datos.total} onCambiar={setPage} />
        </>
      )}
      {form && (
        <FormularioCiudadano
          inicial={form === 'nuevo' ? null : form}
          onCerrar={() => setForm(null)}
          onGuardado={(msg) => { setForm(null); avisar(msg); cargar(); }}
        />
      )}
      {confirmar && (
        <Confirmar
          titulo={confirmar.activo ? 'Desactivar ciudadano' : 'Activar ciudadano'}
          mensaje={confirmar.activo
            ? `¿Desactivar a ${confirmar.nombres} ${confirmar.apellidos}? El registro se conserva y deja de aparecer en listados y reportes. Su estado judicial seguirá reflejándose en las consultas.`
            : `¿Activar de nuevo a ${confirmar.nombres} ${confirmar.apellidos}?`}
          textoConfirmar={confirmar.activo ? 'Desactivar' : 'Activar'} peligro={confirmar.activo}
          onConfirmar={alternarActivo} onCancelar={() => setConfirmar(null)} cargando={procesando} error={errorConfirmar}
        />
      )}
    </section>
  );
}
