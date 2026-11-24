import { useCallback, useEffect, useState } from 'react';
import { get, post, qs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Aviso, Boton, Campo, Confirmar, Dialogo, EstadoVacio, Esqueleto, Iniciales, Insignia, Paginacion, useToast } from '../components/ui.jsx';

const ESTADOS_SOLICITUD = {
  PENDIENTE_REVISION: { texto: 'Pendiente de revisión', tono: 'aviso' },
  VALIDADA: { texto: 'Validada automáticamente', tono: 'ok' },
  APROBADA: { texto: 'Aprobada', tono: 'ok' },
  RECHAZADA: { texto: 'Rechazada', tono: 'alerta' },
};

const VALIDACION_DEFENSA = {
  VALIDADO: 'Datos verificados con Defensa',
  NO_ENCONTRADO: 'No figura en registro de Defensa',
  DATOS_NO_COINCIDEN: 'Los datos no coinciden con Defensa',
  SERVICIO_NO_DISPONIBLE: 'Servicio de Defensa no disponible al solicitar',
};

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function DialogoRechazar({ solicitud, onCerrar, onRechazada }) {
  const [motivo, setMotivo] = useState('');
  const [errorCampo, setErrorCampo] = useState('');
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErrorCampo('');
    setErrorGeneral('');
    const limpio = motivo.trim();
    if (limpio.length < 5) {
      setErrorCampo('Indique el motivo del rechazo (mínimo 5 caracteres)');
      return;
    }
    setEnviando(true);
    try {
      await post(`/solicitudes/${solicitud.id}/rechazar`, { motivo: limpio });
      onRechazada();
    } catch (err) {
      if (err.campos?.motivo) setErrorCampo(err.campos.motivo);
      else setErrorGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={`Rechazar solicitud de ${solicitud.nombres} ${solicitud.apellidos}`} onCerrar={onCerrar} ancho={520}>
      <form onSubmit={enviar} noValidate>
        {errorGeneral && <Aviso tipo="error">{errorGeneral}</Aviso>}
        <p>La solicitud quedará marcada como <strong>Rechazada</strong> y el solicitante no recibirá acceso al sistema.</p>
        <Campo etiqueta="Motivo del rechazo" error={errorCampo} ayuda="Mínimo 5 y máximo 500 caracteres.">
          {(id, inv) => (
            <textarea
              id={id}
              rows={4}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={inv || undefined}
            />
          )}
        </Campo>
        <div className="acciones">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="peligro" cargando={enviando}>Rechazar solicitud</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function DetalleSolicitud({ solicitud, puedeResolver, onCerrar, onAprobar, onRechazar }) {
  const est = ESTADOS_SOLICITUD[solicitud.estado] ?? { texto: solicitud.estado, tono: 'neutro' };
  return (
    <Dialogo titulo={`Solicitud #${solicitud.id}`} onCerrar={onCerrar} ancho={600}>
      <div className="detalle-cabecera">
        <div>
          <h3>{solicitud.nombres} {solicitud.apellidos}</h3>
          <p className="tenue">Identificación: <strong className="num">{solicitud.identificacion}</strong></p>
        </div>
        <Insignia tono={est.tono}>{est.texto}</Insignia>
      </div>

      <dl className="detalle-grid">
        <div><dt>Correo electrónico</dt><dd>{solicitud.correo}</dd></div>
        <div><dt>Fecha de solicitud</dt><dd>{fechaHora(solicitud.creadaEn)}</dd></div>
        <div><dt>Fuerza pública</dt><dd>{solicitud.fuerza.nombre}</dd></div>
        <div><dt>Rango · ID Fuerza</dt><dd>{solicitud.rango.nombre} · <span className="num">{solicitud.idFuerza}</span></dd></div>
        <div className="span-2"><dt>Validación automática (Defensa)</dt><dd>{VALIDACION_DEFENSA[solicitud.resultadoValidacion] ?? solicitud.resultadoValidacion}</dd></div>
        {solicitud.resueltaPor && (
          <div><dt>Resuelta por</dt><dd>{solicitud.resueltaPor.nombres} {solicitud.resueltaPor.apellidos}</dd></div>
        )}
        {solicitud.resueltaEn && (
          <div><dt>Fecha de resolución</dt><dd>{fechaHora(solicitud.resueltaEn)}</dd></div>
        )}
        {solicitud.motivo && (
          <div className="span-2"><dt>Motivo de rechazo</dt><dd>{solicitud.motivo}</dd></div>
        )}
      </dl>

      <div className="acciones">
        <Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>
        {puedeResolver && solicitud.estado === 'PENDIENTE_REVISION' && (
          <>
            <Boton variante="peligro" onClick={() => { onCerrar(); onRechazar(solicitud); }}>Rechazar</Boton>
            <Boton onClick={() => { onCerrar(); onAprobar(solicitud); }}>Aprobar solicitud</Boton>
          </>
        )}
      </div>
    </Dialogo>
  );
}

/** HU10 (consultar solicitudes) y HU11 (aprobar o rechazar solicitudes pendientes de revisión). */
export default function Solicitudes() {
  const { puede } = useAuth();
  const avisar = useToast();
  const [filtros, setFiltros] = useState({ q: '', estado: '' });
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [aprobarDe, setAprobarDe] = useState(null);
  const [rechazarDe, setRechazarDe] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAprobar, setErrorAprobar] = useState('');

  const puedeResolver = puede('solicitudes:resolver');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setDatos(await get(`/solicitudes${qs({ ...filtros, page, pageSize: 10 })}`));
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

  async function confirmarAprobacion() {
    setProcesando(true);
    setErrorAprobar('');
    try {
      await post(`/solicitudes/${aprobarDe.id}/aprobar`);
      avisar('Solicitud aprobada. Se creó la cuenta de funcionario y se enviaron las credenciales temporales por correo.');
      setAprobarDe(null);
      cargar();
    } catch (e) {
      setErrorAprobar(e.message);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section>
      <header className="encabezado">
        <div>
          <h1>Solicitudes de acceso</h1>
          <p>Revise las solicitudes de registro de la fuerza pública y resuelva las pendientes de verificación.</p>
        </div>
      </header>

      <div className="filtros filtros-2" role="search">
        <Campo etiqueta="Buscar por identificación, nombre o correo">
          {(id) => <input id={id} value={filtros.q} onChange={cambiarFiltro('q')} />}
        </Campo>
        <Campo etiqueta="Estado de la solicitud">
          {(id) => (
            <select id={id} value={filtros.estado} onChange={cambiarFiltro('estado')}>
              <option value="">Todos</option>
              <option value="PENDIENTE_REVISION">Pendiente de revisión</option>
              <option value="VALIDADA">Validada automáticamente</option>
              <option value="APROBADA">Aprobada</option>
              <option value="RECHAZADA">Rechazada</option>
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
                  <th>Solicitante</th>
                  <th>Fuerza / Rango</th>
                  <th>Validación Defensa</th>
                  <th>Estado</th>
                  <th><span className="sr">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((s) => {
                  const est = ESTADOS_SOLICITUD[s.estado] ?? { texto: s.estado, tono: 'neutro' };
                  return (
                    <tr key={s.id}>
                      <td>{fechaHora(s.creadaEn)}</td>
                      <td>
                        <span className="persona">
                          <Iniciales nombres={s.nombres} apellidos={s.apellidos} />
                          <span>
                            <strong>{s.nombres} {s.apellidos}</strong>
                            <br />
                            <small className="num">{s.identificacion}</small> · <small>{s.correo}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        {s.fuerza.nombre}
                        <br />
                        <small>{s.rango.nombre} · {s.idFuerza}</small>
                      </td>
                      <td><small>{VALIDACION_DEFENSA[s.resultadoValidacion] ?? s.resultadoValidacion}</small></td>
                      <td><Insignia tono={est.tono}>{est.texto}</Insignia></td>
                      <td className="fila-acciones">
                        <button className="enlace" onClick={() => setDetalle(s)}>Detalle</button>
                        {puedeResolver && s.estado === 'PENDIENTE_REVISION' && (
                          <>
                            <button className="enlace" onClick={() => { setErrorAprobar(''); setAprobarDe(s); }}>Aprobar</button>
                            <button className="enlace" onClick={() => setRechazarDe(s)}>Rechazar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {datos.items.length === 0 && (
              <EstadoVacio titulo="No se encontraron solicitudes">
                Ajuste los filtros de búsqueda o espere nuevas solicitudes desde la aplicación móvil.
              </EstadoVacio>
            )}
          </div>
          <Paginacion page={page} pageSize={10} total={datos.total} onCambiar={setPage} />
        </>
      )}

      {detalle && (
        <DetalleSolicitud
          solicitud={detalle}
          puedeResolver={puedeResolver}
          onCerrar={() => setDetalle(null)}
          onAprobar={(s) => { setErrorAprobar(''); setAprobarDe(s); }}
          onRechazar={(s) => setRechazarDe(s)}
        />
      )}

      {aprobarDe && (
        <Confirmar
          titulo="Aprobar solicitud de acceso"
          mensaje={`¿Aprobar la solicitud de ${aprobarDe.nombres} ${aprobarDe.apellidos} (${aprobarDe.identificacion})? Se creará su cuenta de funcionario y se enviará una contraseña temporal a ${aprobarDe.correo}.`}
          textoConfirmar="Aprobar y enviar credenciales"
          onConfirmar={confirmarAprobacion}
          onCancelar={() => setAprobarDe(null)}
          cargando={procesando}
          error={errorAprobar}
        />
      )}

      {rechazarDe && (
        <DialogoRechazar
          solicitud={rechazarDe}
          onCerrar={() => setRechazarDe(null)}
          onRechazada={() => {
            setRechazarDe(null);
            avisar('Solicitud rechazada');
            cargar();
          }}
        />
      )}
    </section>
  );
}