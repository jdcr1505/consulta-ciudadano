import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Aviso, Boton, Campo, EstadoVacio, Esqueleto, Iniciales, Insignia, Paginacion } from '../components/ui.jsx';

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** HU07 — Historial de consultas realizadas en el sistema (con filtros por resultado, fecha, identificación y funcionario). */
export default function HistorialConsultas() {
  const { puede } = useAuth();
  const verTodas = puede('consultas:leer_todas');
  const puedeVerUsuarios = puede('usuarios:leer');

  const [filtros, setFiltros] = useState({
    identificacion: '',
    resultado: '',
    desde: '',
    hasta: '',
    usuarioId: '',
  });
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState(null);
  const [funcionarios, setFuncionarios] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!verTodas || !puedeVerUsuarios) return;
    get(`/usuarios${qs({ page: 1, pageSize: 100 })}`)
      .then((d) => setFuncionarios(d.items ?? []))
      .catch(() => {});
  }, [verTodas, puedeVerUsuarios]);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const idLimpia = filtros.identificacion.replace(/\D/g, '').slice(0, 10);
      setDatos(await get(`/consultas${qs({
        identificacion: idLimpia,
        resultado: filtros.resultado,
        desde: filtros.desde,
        hasta: filtros.hasta,
        usuarioId: verTodas ? filtros.usuarioId : '',
        page,
        pageSize: 10,
      })}`));
    } catch (e) {
      setError(e.message);
      setDatos({ items: [], total: 0 });
    }
  }, [filtros, page, verTodas]);

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  const cambiarFiltro = (k) => (e) => {
    setPage(1);
    const val = k === 'identificacion' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value;
    setFiltros((p) => ({ ...p, [k]: val }));
  };

  const hayFiltros = Object.values(filtros).some(Boolean);
  const limpiar = () => {
    setPage(1);
    setFiltros({ identificacion: '', resultado: '', desde: '', hasta: '', usuarioId: '' });
  };

  return (
    <section>
      <header className="encabezado">
        <div>
          <h1>Historial de consultas</h1>
          <p>{verTodas ? 'Trazabilidad completa de las verificaciones realizadas por los funcionarios.' : 'Registro de las consultas realizadas desde su cuenta.'}</p>
        </div>
        {hayFiltros && <Boton variante="secundario" onClick={limpiar}>Limpiar filtros</Boton>}
      </header>

      <div className={`filtros ${verTodas && puedeVerUsuarios ? 'filtros-5' : 'filtros-4'}`} role="search">
        <Campo etiqueta="Identificación consultada">
          {(id) => <input id={id} inputMode="numeric" maxLength={10} value={filtros.identificacion} onChange={cambiarFiltro('identificacion')} />}
        </Campo>
        <Campo etiqueta="Resultado">
          {(id) => (
            <select id={id} value={filtros.resultado} onChange={cambiarFiltro('resultado')}>
              <option value="">Todos</option>
              <option value="REQUERIDO">Requerido</option>
              <option value="NO_REQUERIDO">No requerido</option>
              <option value="NO_REGISTRADO">No figura en el sistema</option>
            </select>
          )}
        </Campo>
        <Campo etiqueta="Desde">
          {(id) => <input id={id} type="date" value={filtros.desde} onChange={cambiarFiltro('desde')} />}
        </Campo>
        <Campo etiqueta="Hasta">
          {(id) => <input id={id} type="date" value={filtros.hasta} onChange={cambiarFiltro('hasta')} />}
        </Campo>
        {verTodas && puedeVerUsuarios && (
          <Campo etiqueta="Funcionario">
            {(id) => (
              <select id={id} value={filtros.usuarioId} onChange={cambiarFiltro('usuarioId')}>
                <option value="">Todos</option>
                {funcionarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombres} {u.apellidos} ({u.identificacion})</option>
                ))}
              </select>
            )}
          </Campo>
        )}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {!datos ? <Esqueleto columnas={verTodas ? 6 : 5} /> : (
        <>
          <div className="tabla-envoltorio">
            <table>
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Identificación</th>
                  <th>Ciudadano</th>
                  <th>Resultado</th>
                  <th>Origen</th>
                  {verTodas && <th>Funcionario</th>}
                </tr>
              </thead>
              <tbody>
                {datos.items.map((c) => (
                  <tr key={c.id}>
                    <td>{fechaHora(c.fechaHora)}</td>
                    <td className="num">{c.identificacion}</td>
                    <td>
                      {c.ciudadano ? (
                        <span className="persona">
                          <Iniciales nombres={c.ciudadano.nombres} apellidos={c.ciudadano.apellidos} />
                          {c.ciudadano.nombres} {c.ciudadano.apellidos}
                        </span>
                      ) : (
                        <span className="tenue">No figura en el sistema</span>
                      )}
                    </td>
                    <td>
                      <Insignia tono={c.resultado === 'REQUERIDO' ? 'alerta' : 'ok'}>
                        {c.resultado === 'REQUERIDO' ? 'Requerido' : 'No requerido'}
                      </Insignia>
                      {!c.registrado && <><br /><small>Sin registro previo</small></>}
                    </td>
                    <td>{c.origen === 'ESCANER' ? 'Escáner' : 'Manual'}</td>
                    {verTodas && (
                      <td>
                        {c.funcionario ? (
                          <>
                            {c.funcionario.nombres} {c.funcionario.apellidos}
                            <br />
                            <small className="num">{c.funcionario.identificacion}</small>
                          </>
                        ) : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {datos.items.length === 0 && (
              <EstadoVacio titulo="No hay consultas registradas">
                No se encontraron consultas para los filtros seleccionados.
              </EstadoVacio>
            )}
          </div>
          <Paginacion page={page} pageSize={10} total={datos.total} onCambiar={setPage} />
        </>
      )}
    </section>
  );
}