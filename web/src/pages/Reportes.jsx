import { useCallback, useEffect, useState } from 'react';
import { descargarArchivo, get, qs } from '../api/client.js';
import { Icono } from '../components/icons.jsx';
import { Aviso, BarraProporcion, Boton, EstadoVacio, Esqueleto, Insignia, Iniciales, Paginacion, Segmentado, useToast } from '../components/ui.jsx';

const ESTADOS = [
  { valor: 'TODOS', texto: 'Todos' },
  { valor: 'REQUERIDO', texto: 'Requeridos' },
  { valor: 'NO_REQUERIDO', texto: 'No requeridos' },
];

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca consultado');

/** HU16 (criterios y vista previa) + HU17 (descarga del reporte en PDF con los mismos criterios). */
export default function Reportes() {
  const avisar = useToast();
  const [estado, setEstado] = useState('TODOS');
  const [resultado, setResultado] = useState(true);
  const [ultima, setUltima] = useState(false);
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const columnas = [resultado && 'resultado', ultima && 'ultimaConsulta'].filter(Boolean).join(',');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setDatos(await get(`/reportes/ciudadanos/vista-previa${qs({ estado, columnas, page, pageSize: 10 })}`));
    } catch (e) {
      setError(e.message);
      setDatos({ items: [], total: 0, resumen: null });
    }
  }, [estado, columnas, page]);

  useEffect(() => { cargar(); }, [cargar]);

  async function descargarPdf() {
    setGenerandoPdf(true);
    setError('');
    try {
      await descargarArchivo(`/reportes/ciudadanos/pdf${qs({ estado, columnas })}`, 'reporte-ciudadanos.pdf');
      avisar('Reporte PDF generado y descargado');
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerandoPdf(false);
    }
  }

  return (
    <section>
      <header className="encabezado">
        <div>
          <h1>Reportes</h1>
          <p>Elija qué ciudadanos y qué información incluir. Siempre se muestran identificación, nombres y apellidos.</p>
        </div>
        <div className="aviso-pdf">
          <Boton onClick={descargarPdf} cargando={generandoPdf} disabled={!datos || generandoPdf}>
            <Icono nombre="descargar" tam={16} />
            Generar PDF
          </Boton>
          <small>Exporta el reporte completo con los criterios activos</small>
        </div>
      </header>

      <div className="panel criterios">
        <fieldset>
          <legend>Estado del ciudadano</legend>
          <Segmentado etiqueta="Estado del ciudadano" valor={estado} opciones={ESTADOS} onCambiar={(v) => { setPage(1); setEstado(v); }} />
        </fieldset>
        <fieldset>
          <legend>Columnas adicionales</legend>
          <label className="check"><input type="checkbox" checked={resultado} onChange={(e) => setResultado(e.target.checked)} /><span>Resultado (estado vigente)</span></label>
          <label className="check"><input type="checkbox" checked={ultima} onChange={(e) => setUltima(e.target.checked)} /><span>Fecha de la última consulta</span></label>
        </fieldset>
        {datos?.resumen && (
          <div className="criterios-resumen">
            <legend>Universo disponible</legend>
            <BarraProporcion a={datos.resumen.requeridos} b={datos.resumen.noRequeridos} etiquetaA="Requeridos" etiquetaB="No requeridos" />
          </div>
        )}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      <h2 className="subtitulo">Vista previa {datos && !error ? <small>· {datos.total} ciudadano{datos.total === 1 ? '' : 's'} en el reporte</small> : null}</h2>
      {!datos ? <Esqueleto /> : (
        <>
          <div className="tabla-envoltorio">
            <table>
              <thead><tr><th>Identificación</th><th>Nombres</th><th>Apellidos</th>{resultado && <th>Resultado</th>}{ultima && <th>Última consulta</th>}</tr></thead>
              <tbody>
                {datos.items.map((c) => (
                  <tr key={c.identificacion}>
                    <td className="num">{c.identificacion}</td>
                    <td><span className="persona"><Iniciales nombres={c.nombres} apellidos={c.apellidos} />{c.nombres}</span></td>
                    <td>{c.apellidos}</td>
                    {resultado && <td><Insignia tono={c.resultado === 'REQUERIDO' ? 'alerta' : 'ok'}>{c.resultado === 'REQUERIDO' ? 'Requerido' : 'No requerido'}</Insignia></td>}
                    {ultima && <td className={c.ultimaConsulta ? '' : 'tenue'}>{fechaHora(c.ultimaConsulta)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {datos.items.length === 0 && <EstadoVacio titulo="No hay ciudadanos para estos criterios">Cambie el estado seleccionado para ver más resultados.</EstadoVacio>}
          </div>
          <Paginacion page={page} pageSize={10} total={datos.total} onCambiar={setPage} />
        </>
      )}
    </section>
  );
}