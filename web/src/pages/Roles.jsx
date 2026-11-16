import { useCallback, useEffect, useState } from 'react';
import { del, get, patch, post, put } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Icono } from '../components/icons.jsx';
import { Aviso, Boton, Campo, Cargando, Confirmar, Dialogo, Insignia, useToast } from '../components/ui.jsx';

function NuevoRol({ onCerrar, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    setGeneral('');
    if (!nombre.trim()) return setErrores({ nombre: 'El nombre es obligatorio' });
    setEnviando(true);
    try {
      const d = await post('/roles', { nombre: nombre.trim(), descripcion: descripcion.trim() || null, permisoIds: [] });
      onCreado(d.rol);
    } catch (err) {
      setErrores(err.campos ?? {});
      if (!err.details?.length) setGeneral(err.message);
    } finally { setEnviando(false); }
  }
  return (
    <Dialogo titulo="Crear rol" onCerrar={onCerrar} ancho={480}>
      <form onSubmit={enviar} noValidate>
        {general && <Aviso tipo="error">{general}</Aviso>}
        <Campo etiqueta="Nombre del rol" error={errores.nombre}>{(id, inv) => <input id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} aria-invalid={inv || undefined} />}</Campo>
        <Campo etiqueta="Descripción (opcional)" error={errores.descripcion}>{(id) => <input id={id} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={200} />}</Campo>
        <p className="ayuda">Después de crearlo podrá marcar sus permisos en la matriz.</p>
        <div className="acciones"><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton type="submit" cargando={enviando}>Crear rol</Boton></div>
      </form>
    </Dialogo>
  );
}

export default function Roles() {
  const { puede } = useAuth();
  const [roles, setRoles] = useState(null);
  const [opciones, setOpciones] = useState([]);
  const [selId, setSelId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [marcados, setMarcados] = useState(new Set());
  const [error, setError] = useState('');
  const avisar = useToast();
  const [nuevo, setNuevo] = useState(false);
  const [eliminar, setEliminar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');

  const cargarRoles = useCallback(async () => {
    try { const d = await get('/roles'); setRoles(d.roles); return d.roles; } catch (e) { setError(e.message); setRoles([]); return []; }
  }, []);

  useEffect(() => {
    cargarRoles().then((r) => r[0] && setSelId(r[0].id));
    get('/roles/permisos').then((d) => setOpciones(d.opciones)).catch((e) => setError(e.message));
  }, [cargarRoles]);

  useEffect(() => {
    if (!selId) return;
    setDetalle(null);
    get(`/roles/${selId}`).then((d) => { setDetalle(d.rol); setMarcados(new Set(d.rol.permisos.map((p) => p.id))); }).catch((e) => setError(e.message));
  }, [selId]);

  const protegido = detalle?.nombre === 'ADMINISTRADOR';
  const puedeEditar = puede('roles:editar') && !protegido;
  const alternar = (id) => setMarcados((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sinCambios = detalle && marcados.size === detalle.permisos.length && detalle.permisos.every((p) => marcados.has(p.id));

  async function guardar() {
    setGuardando(true); setError(''); avisar('');
    try {
      const d = await put(`/roles/${selId}/permisos`, { permisoIds: [...marcados] });
      setDetalle(d.rol); avisar('Permisos guardados'); cargarRoles();
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  }

  async function borrar() {
    setGuardando(true); setErrorEliminar('');
    try {
      await del(`/roles/${selId}`);
      setEliminar(false); avisar('Rol eliminado');
      const r = await cargarRoles(); setSelId(r[0]?.id ?? null);
    } catch (e) { setErrorEliminar(e.message); } finally { setGuardando(false); }
  }

  return (
    <section>
      <header className="encabezado">
        <div><h1>Roles y permisos</h1><p>Cada permiso es una acción sobre una opción del sistema. Un usuario tiene un único rol.</p></div>
        {puede('roles:crear') && <Boton onClick={() => setNuevo(true)}><Icono nombre="mas" tam={16} />Crear rol</Boton>}
      </header>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!roles ? <Cargando /> : (
        <div className="roles-layout">
          <ul className="lista-roles" aria-label="Roles">
            {roles.map((r) => (
              <li key={r.id}>
                <button className={r.id === selId ? 'activo' : ''} onClick={() => { avisar(''); setError(''); setSelId(r.id); }}>
                  <span>{r.nombre}</span>
                  <small>{r.usuarios} usuario{r.usuarios === 1 ? '' : 's'} · {r.permisos} permisos</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="matriz-panel">
            {!detalle ? <Cargando /> : (
              <>
                <div className="matriz-cabecera">
                  <div>
                    <h2>{detalle.nombre} {detalle.esBase && <Insignia>Rol base</Insignia>}</h2>
                    <p>{detalle.descripcion ?? 'Sin descripción'}</p>
                  </div>
                </div>
                {protegido && <Aviso>Los permisos del rol Administrador no se pueden modificar: garantiza que el sistema siempre tenga quién lo administre.</Aviso>}
                <div className="tabla-envoltorio">
                  <table className="matriz">
                    <thead><tr><th>Opción</th><th>Acciones permitidas</th></tr></thead>
                    <tbody>
                      {opciones.map((o) => (
                        <tr key={o.id}>
                          <th scope="row">{o.nombre}</th>
                          <td>
                            <div className="acciones-permiso">
                              {o.permisos.map((p) => (
                                <label key={p.id} className="check">
                                  <input type="checkbox" checked={marcados.has(p.id)} disabled={!puedeEditar} onChange={() => alternar(p.id)} />
                                  <span>{p.accion.replace('_', ' ')}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="acciones izquierda">
                  {puedeEditar && <Boton onClick={guardar} cargando={guardando} disabled={sinCambios}>Guardar permisos</Boton>}
                  {puede('roles:eliminar') && !detalle.esBase && <Boton variante="peligro" onClick={() => { setErrorEliminar(''); setEliminar(true); }}>Eliminar rol</Boton>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {nuevo && <NuevoRol onCerrar={() => setNuevo(false)} onCreado={async (r) => { setNuevo(false); avisar('Rol creado. Marque sus permisos y guarde.'); await cargarRoles(); setSelId(r.id); }} />}
      {eliminar && <Confirmar titulo="Eliminar rol" mensaje={`¿Eliminar el rol ${detalle.nombre}? Solo es posible si no tiene usuarios asignados.`} textoConfirmar="Eliminar" peligro onConfirmar={borrar} onCancelar={() => setEliminar(false)} cargando={guardando} error={errorEliminar} />}
    </section>
  );
}
