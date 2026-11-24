import { useCallback, useEffect, useState } from 'react';
import { get, patch, qs } from '../api/client.js';
import { Aviso, Boton, Campo, Cargando, Dialogo, EstadoVacio, Esqueleto, Iniciales, Insignia, Paginacion, useToast } from '../components/ui.jsx';

const ESTADOS_NOVEDAD = {
  REGISTRADA: { texto: 'Registrada', tono: 'neutro' },
  EN_REVISION: { texto: 'En revisión', tono: 'aviso' },
  ATENDIDA: { texto: 'Atendida', tono: 'ok' },
  DESCARTADA: { texto: 'Descartada', tono: 'alerta' },
};

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function GestionarNovedad({ novedadId, onCerrar, onActualizada }) {
  const avisar = useToast();
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [comentario, setComentario] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarDetalle = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const d = await get(`/novedades/${novedadId}`);
      setDetalle(d.novedad);
      setNuevoEstado(d.novedad.siguientes?.[0] ?? '');
      setComentario('');
    } catch (e) {
      setErrorCarga(e.message);
    } finally {
      setCargando(false);
    }
  }, [novedadId]);

  useEffect(() => { cargarDetalle(); }, [cargarDetalle]);

  async function cambiarEstado(e) {
    e.preventDefault();
    setErrorForm('');
    if (!nuevoEstado) return;
    if (nuevoEstado === 'DESCARTADA' && !comentario.trim()) {
      setErrorForm('Indique el motivo para descartar la novedad');
      return;
    }
    setGuardando(true);
    try {
      const d = await patch(`/novedades/${novedadId}/estado`, {
        estado: nuevoEstado,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      });
      setDetalle(d.novedad);
      setNuevoEstado(d.novedad.siguientes?.[0] ?? '');
      setComentario('');
      avisar('Estado de la novedad actualizado');
      onActualizada();
    } catch (err) {
      setErrorForm(err.campos?.comentario ?? err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialogo titulo={`Novedad #${novedadId}`} onCerrar={onCerrar} ancho={660}>
      {cargando ? <Cargando texto="Cargando detalle de la novedad…" /> : errorCarga ? (
        <Aviso tipo="error">{errorCarga}</Aviso>
      ) : detalle && (
        <>
          <div className="detalle-cabecera">
            <div>
              <h3>{detalle.ciudadano.nombres} {detalle.ciudadano.apellidos}</h3>
              <p className="tenue">Ciudadano ID: <strong className="num">{detalle.ciudadano.identificacion}</strong></p>
            </div>
            <Insignia tono={ESTADOS_NOVEDAD[detalle.estado]?.tono ?? 'neutro'}>
              {ESTADOS_NOVEDAD[detalle.estado]?.texto ?? detalle.estado}
            </Insignia>
          </div>

          <dl className="detalle-grid">
            <div>
              <dt>Reportada por</dt>
              <dd>{detalle.registradaPor ? `${detalle.registradaPor.nombres} ${detalle.registradaPor.apellidos} (${detalle.registradaPor.identificacion})` : '—'}</dd>
            </div>
            <div>
              <dt>Fecha de registro</dt>
              <dd>{fechaHora(detalle.creadaEn)}</dd>
            </div>
            <div className="span-2">
              <dt>Descripción de la novedad</dt>
              <dd className="texto-largo">{detalle.descripcion}</dd>
            </div>
          </dl>

          <h3 className="subtitulo-dialogo">Trazabilidad de estados</h3>
          <ol className="historial-lista">
            {detalle.historial.map((h, i) => {
              const estNuevo = ESTADOS_NOVEDAD[h.estadoNuevo]?.texto ?? h.estadoNuevo;
              return (
                <li key={i}>
                  <div className="historial-fila">
                    <strong>{estNuevo}</strong>
                    <small>{fechaHora(h.fecha)}</small>
                  </div>
                  {h.por && <small className="tenue">Por: {h.por.nombres} {h.por.apellidos}</small>}
                  {h.comentario && <p className="historial-comentario">{h.comentario}</p>}
                </li>
              );
            })}
          </ol>

          {detalle.siguientes?.length > 0 && (
            <form onSubmit={cambiarEstado} className="form-transicion" noValidate>
              <h3 className="subtitulo-dialogo">Actualizar estado</h3>
              {errorForm && <Aviso tipo="error">{errorForm}</Aviso>}
              <div className="rejilla">
                <Campo etiqueta="Nuevo estado">
                  {(id) => (
                    <select id={id} value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
                      {detalle.siguientes.map((st) => (
                        <option key={st} value={st}>{ESTADOS_NOVEDAD[st]?.texto ?? st}</option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Campo
                  etiqueta={nuevoEstado === 'DESCARTADA' ? 'Motivo del descarte (obligatorio)' : 'Comentario u observación (opcional)'}
                  ayuda="Máximo 500 caracteres."
                >
                  {(id) => (
                    <input
                      id={id}
                      maxLength={500}
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder={nuevoEstado === 'DESCARTADA' ? 'Explique por qué se descarta…' : 'Nota de seguimiento…'}
                    />
                  )}
                </Campo>
              </div>
              <div className="acciones">
                <Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>
                <Boton type="submit" cargando={guardando}>Guardar cambio de estado</Boton>
              </div>
            </form>
          )}

          {(!detalle.siguientes || detalle.siguientes.length === 0) && (
            <div className="acciones">
              <Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>
            </div>
          )}
        </>
      )}
    </Dialogo>
  );
}

/** HU15 — Consultar y gestionar novedades registradas por los funcionarios. */
export default function Novedades() {
  const [filtros, setFiltros] = useState({ q: '', estado: '' });
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [seleccionadaId, setSeleccionadaId] = useState(null);

  const cargar = useCallback(async () => {
    setError('');
    try {
      setDatos(await get(`/novedades${qs({ ...filtros, page, pageSize: 10 })}`));
    } catch (e) {
      setError(e.message);
      setDatos({ items: [], total: 0 });
    }
  }, [filtros, page]);

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  const cambiarFiltro = (k) => (e) => {
    setPage(1);
    setFiltros((p) => ({ ...p, [k]: e.target.value }));
  };

  return (
    <section>
      <header className="encabezado">
        <div>
          <h1>Novedades</h1>
          <p>Revise y dé trámite a las novedades reportadas por la fuerza pública sobre ciudadanos registrados.</p>
        </div>
      </header>

      <div className="filtros filtros-2" role="search">
        <Campo etiqueta="Buscar por ciudadano, identificación o descripción">
          {(id) => <input id={id} value={filtros.q} onChange={cambiarFiltro('q')} />}
        </Campo>
        <Campo etiqueta="Estado de la novedad">
          {(id) => (
            <select id={id} value={filtros.estado} onChange={cambiarFiltro('estado')}>
              <option value="">Todos</option>
              <option value="REGISTRADA">Registrada</option>
              <option value="EN_REVISION">En revisión</option>
              <option value="ATENDIDA">Atendida</option>
              <option value="DESCARTADA">Descartada</option>
            </select>
          )}
        </Campo>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {!datos ? <Esqueleto columnas={6} /> : (
        <>
          <div className="tabla-envoltorio">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ciudadano</th>
                  <th>Descripción</th>
                  <th>Reportada por</th>
                  <th>Estado</th>
                  <th><span className="sr">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((n) => {
                  const est = ESTADOS_NOVEDAD[n.estado] ?? { texto: n.estado, tono: 'neutro' };
                  const abierta = n.estado === 'REGISTRADA' || n.estado === 'EN_REVISION';
                  return (
                    <tr key={n.id}>
                      <td>{fechaHora(n.creadaEn)}</td>
                      <td>
                        <span className="persona">
                          <Iniciales nombres={n.ciudadano.nombres} apellidos={n.ciudadano.apellidos} />
                          <span>
                            <strong>{n.ciudadano.nombres} {n.ciudadano.apellidos}</strong>
                            <br />
                            <small className="num">{n.ciudadano.identificacion}</small>
                          </span>
                        </span>
                      </td>
                      <td className="celda-desc">{n.descripcion}</td>
                      <td>
                        {n.registradaPor ? (
                          <>
                            {n.registradaPor.nombres} {n.registradaPor.apellidos}
                            <br />
                            <small className="num">{n.registradaPor.identificacion}</small>
                          </>
                        ) : '—'}
                      </td>
                      <td><Insignia tono={est.tono}>{est.texto}</Insignia></td>
                      <td className="fila-acciones">
                        <button className="enlace" onClick={() => setSeleccionadaId(n.id)}>
                          {abierta ? 'Gestionar' : 'Ver historial'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {datos.items.length === 0 && (
              <EstadoVacio titulo="No se encontraron novedades">
                No hay novedades registradas que coincidan con los filtros seleccionados.
              </EstadoVacio>
            )}
          </div>
          <Paginacion page={page} pageSize={10} total={datos.total} onCambiar={setPage} />
        </>
      )}

      {seleccionadaId && (
        <GestionarNovedad
          novedadId={seleccionadaId}
          onCerrar={() => setSeleccionadaId(null)}
          onActualizada={cargar}
        />
      )}
    </section>
  );
}