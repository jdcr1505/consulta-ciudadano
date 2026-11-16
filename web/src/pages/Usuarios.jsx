import { useCallback, useEffect, useState } from 'react';
import { get, patch, post, qs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Icono } from '../components/icons.jsx';
import { Aviso, Boton, Campo, Confirmar, Dialogo, EstadoVacio, Esqueleto, Iniciales, Insignia, Paginacion, useToast } from '../components/ui.jsx';

const VACIO = { identificacion: '', nombres: '', apellidos: '', correo: '', rolId: '', fuerzaPublicaId: '', rangoId: '', idFuerza: '' };

function FormularioUsuario({ inicial, roles, fuerzas, onCerrar, onGuardado }) {
  const edicion = Boolean(inicial);
  const [f, setF] = useState(
    inicial
      ? { identificacion: inicial.identificacion, nombres: inicial.nombres, apellidos: inicial.apellidos, correo: inicial.correo, rolId: String(inicial.rol.id), fuerzaPublicaId: String(inicial.fuerza?.id ?? ''), rangoId: String(inicial.rango?.id ?? ''), idFuerza: inicial.idFuerza ?? '' }
      : VACIO,
  );
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value, ...(k === 'fuerzaPublicaId' ? { rangoId: '' } : {}) }));

  const rol = roles.find((r) => String(r.id) === f.rolId);
  const esFuncionario = rol?.nombre === 'FUNCIONARIO';
  const fuerza = fuerzas.find((x) => String(x.id) === f.fuerzaPublicaId);

  async function enviar(e) {
    e.preventDefault();
    setGeneral('');
    const req = ['identificacion', 'nombres', 'apellidos', 'correo', 'rolId'].filter((k) => !String(f[k]).trim());
    if (esFuncionario) req.push(...['fuerzaPublicaId', 'rangoId', 'idFuerza'].filter((k) => !String(f[k]).trim()));
    const faltan = Object.fromEntries(req.map((k) => [k, 'Este campo es obligatorio']));
    setErrores(faltan);
    if (req.length) return;
    setEnviando(true);
    try {
      const datos = {
        nombres: f.nombres, apellidos: f.apellidos, correo: f.correo,
        fuerzaPublicaId: f.fuerzaPublicaId ? Number(f.fuerzaPublicaId) : null,
        rangoId: f.rangoId ? Number(f.rangoId) : null,
        idFuerza: f.idFuerza.trim() || null,
      };
      if (edicion) await patch(`/usuarios/${inicial.id}`, datos);
      else await post('/usuarios', { ...datos, identificacion: f.identificacion.trim(), rolId: Number(f.rolId) });
      onGuardado(edicion ? 'Usuario actualizado' : 'Usuario creado. Se envió una contraseña temporal al correo indicado (simulado en modo desarrollo).');
    } catch (err) {
      setErrores(err.campos ?? {});
      if (!err.details?.length) setGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={edicion ? 'Editar usuario' : 'Crear usuario'} onCerrar={onCerrar} ancho={680}>
      <form onSubmit={enviar} noValidate>
        {general && <Aviso tipo="error">{general}</Aviso>}
        <div className="rejilla">
          <Campo etiqueta="Identificación" error={errores.identificacion}>
            {(id, inv) => <input id={id} value={f.identificacion} onChange={set('identificacion')} disabled={edicion} inputMode="numeric" maxLength={10} aria-invalid={inv || undefined} />}
          </Campo>
          <Campo etiqueta="Rol" error={errores.rolId}>
            {(id, inv) => (
              <select id={id} value={f.rolId} onChange={set('rolId')} disabled={edicion} aria-invalid={inv || undefined}>
                <option value="">Seleccione…</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            )}
          </Campo>
          <Campo etiqueta="Nombres" error={errores.nombres}>{(id, inv) => <input id={id} value={f.nombres} onChange={set('nombres')} aria-invalid={inv || undefined} />}</Campo>
          <Campo etiqueta="Apellidos" error={errores.apellidos}>{(id, inv) => <input id={id} value={f.apellidos} onChange={set('apellidos')} aria-invalid={inv || undefined} />}</Campo>
          <Campo etiqueta="Correo electrónico" error={errores.correo}>{(id, inv) => <input id={id} type="email" value={f.correo} onChange={set('correo')} aria-invalid={inv || undefined} />}</Campo>
          {(esFuncionario || f.fuerzaPublicaId) && (
            <>
              <Campo etiqueta="Fuerza pública" error={errores.fuerzaPublicaId}>
                {(id, inv) => (
                  <select id={id} value={f.fuerzaPublicaId} onChange={set('fuerzaPublicaId')} aria-invalid={inv || undefined}>
                    <option value="">Seleccione…</option>{fuerzas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                  </select>
                )}
              </Campo>
              <Campo etiqueta="Rango" error={errores.rangoId}>
                {(id, inv) => (
                  <select id={id} value={f.rangoId} onChange={set('rangoId')} disabled={!fuerza} aria-invalid={inv || undefined}>
                    <option value="">{fuerza ? 'Seleccione…' : 'Elija primero la fuerza'}</option>{fuerza?.rangos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                )}
              </Campo>
              <Campo etiqueta="ID Fuerza" error={errores.idFuerza}>{(id, inv) => <input id={id} value={f.idFuerza} onChange={set('idFuerza')} aria-invalid={inv || undefined} />}</Campo>
            </>
          )}
        </div>
        {!edicion && <p className="ayuda">Se generará una contraseña temporal de 6 caracteres y se enviará al correo. Deberá cambiarla en su primer ingreso.</p>}
        <div className="acciones">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" cargando={enviando}>{edicion ? 'Guardar cambios' : 'Crear usuario'}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function CambiarRol({ usuario, roles, onCerrar, onGuardado }) {
  const [rolId, setRolId] = useState(String(usuario.rol.id));
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setEnviando(true); setError('');
    try { await patch(`/usuarios/${usuario.id}/rol`, { rolId: Number(rolId) }); onGuardado('Rol actualizado'); } catch (e) { setError(e.message); } finally { setEnviando(false); }
  }
  return (
    <Dialogo titulo={`Cambiar rol de ${usuario.nombres} ${usuario.apellidos}`} onCerrar={onCerrar} ancho={460}>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo etiqueta="Rol (un usuario tiene un solo rol)">
        {(id) => <select id={id} value={rolId} onChange={(e) => setRolId(e.target.value)}>{roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>}
      </Campo>
      <div className="acciones"><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} cargando={enviando}>Guardar rol</Boton></div>
    </Dialogo>
  );
}

export default function Usuarios() {
  const { puede, usuario: yo } = useAuth();
  const [filtros, setFiltros] = useState({ q: '', estado: '', rolId: '' });
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState(null);
  const [roles, setRoles] = useState([]);
  const [fuerzas, setFuerzas] = useState([]);
  const [error, setError] = useState('');
  const avisar = useToast();
  const [form, setForm] = useState(null);
  const [rolDe, setRolDe] = useState(null);
  const [accion, setAccion] = useState(null); // { tipo: 'estado' | 'reset', usuario }
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  useEffect(() => {
    get('/roles').then((d) => setRoles(d.roles)).catch(() => {});
    get('/catalogos/fuerzas').then((d) => setFuerzas(d.fuerzas)).catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setError('');
    try { setDatos(await get(`/usuarios${qs({ ...filtros, page, pageSize: 10 })}`)); } catch (e) { setError(e.message); setDatos({ items: [], total: 0 }); }
  }, [filtros, page]);
  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

  const cambiarFiltro = (k) => (e) => { setPage(1); setFiltros((p) => ({ ...p, [k]: e.target.value })); };

  async function ejecutarAccion() {
    setProcesando(true); setErrorAccion('');
    try {
      const u = accion.usuario;
      if (accion.tipo === 'estado') {
        await patch(`/usuarios/${u.id}/estado`, { estado: u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
        avisar(u.estado === 'ACTIVO' ? 'Usuario desactivado y sesiones cerradas' : 'Usuario activado');
      } else {
        await post(`/usuarios/${u.id}/restablecer-password`);
        avisar('Contraseña restablecida: se envió una nueva contraseña temporal al correo (simulado en modo desarrollo).');
      }
      setAccion(null); cargar();
    } catch (e) { setErrorAccion(e.message); } finally { setProcesando(false); }
  }

  return (
    <section>
      <header className="encabezado">
        <div><h1>Usuarios</h1><p>Administre las cuentas, sus estados y roles.</p></div>
        {puede('usuarios:crear') && <Boton onClick={() => setForm('nuevo')}><Icono nombre="mas" tam={16} />Crear usuario</Boton>}
      </header>
      <div className="filtros" role="search">
        <Campo etiqueta="Buscar por identificación, nombre o correo">{(id) => <input id={id} value={filtros.q} onChange={cambiarFiltro('q')} />}</Campo>
        <Campo etiqueta="Rol">{(id) => <select id={id} value={filtros.rolId} onChange={cambiarFiltro('rolId')}><option value="">Todos</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>}</Campo>
        <Campo etiqueta="Estado">{(id) => <select id={id} value={filtros.estado} onChange={cambiarFiltro('estado')}><option value="">Todos</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option></select>}</Campo>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!datos ? <Esqueleto columnas={7} /> : (
        <>
          <div className="tabla-envoltorio">
            <table>
              <thead><tr><th>Identificación</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Fuerza / rango</th><th>Estado</th><th><span className="sr">Acciones</span></th></tr></thead>
              <tbody>
                {datos.items.map((u) => (
                  <tr key={u.id} className={u.estado === 'ACTIVO' ? '' : 'inactiva'}>
                    <td className="num">{u.identificacion}</td>
                    <td><span className="persona"><Iniciales nombres={u.nombres} apellidos={u.apellidos} />{u.nombres} {u.apellidos}</span></td>
                    <td>{u.correo}</td>
                    <td>{u.rol.nombre}</td>
                    <td>{u.fuerza ? <>{u.fuerza.nombre}<br /><small>{u.rango?.nombre} · {u.idFuerza}</small></> : '—'}</td>
                    <td>
                      <Insignia tono={u.estado === 'ACTIVO' ? 'ok' : 'neutro'}>{u.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</Insignia>
                      {u.debeCambiarPassword && <><br /><small>Contraseña temporal</small></>}
                      {u.bloqueado && <><br /><small>Bloqueado por intentos</small></>}
                    </td>
                    <td className="fila-acciones">
                      {u.id !== yo.id && puede('usuarios:editar') && (
                        <>
                          <button className="enlace" onClick={() => setForm(u)}>Editar</button>
                          <button className="enlace" onClick={() => setRolDe(u)}>Rol</button>
                          <button className="enlace" onClick={() => { setErrorAccion(''); setAccion({ tipo: 'reset', usuario: u }); }}>Restablecer contraseña</button>
                          <button className="enlace" onClick={() => { setErrorAccion(''); setAccion({ tipo: 'estado', usuario: u }); }}>{u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}</button>
                        </>
                      )}
                      {u.id === yo.id && <small>Su cuenta</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {datos.items.length === 0 && <EstadoVacio titulo="No se encontraron usuarios">Pruebe con otra búsqueda o cree un usuario nuevo.</EstadoVacio>}
          </div>
          <Paginacion page={page} pageSize={10} total={datos.total} onCambiar={setPage} />
        </>
      )}
      {form && <FormularioUsuario inicial={form === 'nuevo' ? null : form} roles={roles} fuerzas={fuerzas} onCerrar={() => setForm(null)} onGuardado={(m) => { setForm(null); avisar(m); cargar(); }} />}
      {rolDe && <CambiarRol usuario={rolDe} roles={roles} onCerrar={() => setRolDe(null)} onGuardado={(m) => { setRolDe(null); avisar(m); cargar(); }} />}
      {accion && (
        <Confirmar
          titulo={accion.tipo === 'reset' ? 'Restablecer contraseña' : accion.usuario.estado === 'ACTIVO' ? 'Desactivar usuario' : 'Activar usuario'}
          mensaje={accion.tipo === 'reset'
            ? `Se generará una nueva contraseña temporal para ${accion.usuario.nombres} ${accion.usuario.apellidos}, se enviará a su correo y se cerrarán sus sesiones.`
            : accion.usuario.estado === 'ACTIVO'
              ? `¿Desactivar a ${accion.usuario.nombres} ${accion.usuario.apellidos}? Sus sesiones se cerrarán y no podrá ingresar.`
              : `¿Activar de nuevo a ${accion.usuario.nombres} ${accion.usuario.apellidos}?`}
          textoConfirmar={accion.tipo === 'reset' ? 'Restablecer' : accion.usuario.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
          peligro={accion.tipo === 'estado' && accion.usuario.estado === 'ACTIVO'}
          onConfirmar={ejecutarAccion} onCancelar={() => setAccion(null)} cargando={procesando} error={errorAccion}
        />
      )}
    </section>
  );
}
