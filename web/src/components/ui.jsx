import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { Icono } from './icons.jsx';

export function Campo({ etiqueta, error, ayuda, children }) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {typeof children === 'function' ? children(id, Boolean(error)) : children}
      {ayuda && !error && <p className="ayuda">{ayuda}</p>}
      {error && <p className="error-campo" role="alert">{error}</p>}
    </div>
  );
}

export function Aviso({ tipo = 'info', children }) {
  return <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Insignia({ tono = 'neutro', children }) {
  return <span className={`insignia insignia-${tono}`}><i className="punto" />{children}</span>;
}

export function Boton({ variante = 'primario', cargando, children, type = 'button', ...props }) {
  return (
    <button type={type} className={`btn btn-${variante}`} {...props} disabled={cargando || props.disabled}>
      {cargando ? 'Procesando…' : children}
    </button>
  );
}

export function Dialogo({ titulo, onCerrar, children, ancho }) {
  const ref = useRef(null);
  useEffect(() => {
    const previo = document.activeElement;
    ref.current?.querySelector('input, select, button.btn')?.focus();
    const esc = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); previo?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-label={titulo} ref={ref} style={{ maxWidth: ancho ?? 560 }}>
        <header><h2>{titulo}</h2><button className="cerrar" onClick={onCerrar} aria-label="Cerrar"><Icono nombre="cerrar" tam={18} /></button></header>
        {children}
      </div>
    </div>
  );
}

export function Confirmar({ titulo, mensaje, textoConfirmar = 'Confirmar', peligro, onConfirmar, onCancelar, cargando, error }) {
  return (
    <Dialogo titulo={titulo} onCerrar={onCancelar} ancho={440}>
      <p>{mensaje}</p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="acciones">
        <Boton variante="secundario" onClick={onCancelar}>Cancelar</Boton>
        <Boton variante={peligro ? 'peligro' : 'primario'} onClick={onConfirmar} cargando={cargando}>{textoConfirmar}</Boton>
      </div>
    </Dialogo>
  );
}

export function Paginacion({ page, pageSize, total, onCambiar }) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="paginacion" aria-label="Paginación">
      <span>{total} registro{total === 1 ? '' : 's'}</span>
      <div>
        <Boton variante="secundario" disabled={page <= 1} onClick={() => onCambiar(page - 1)}>Anterior</Boton>
        <span className="pagina">Página {page} de {paginas}</span>
        <Boton variante="secundario" disabled={page >= paginas} onClick={() => onCambiar(page + 1)}>Siguiente</Boton>
      </div>
    </nav>
  );
}

export const Cargando = ({ texto = 'Cargando…' }) => <p className="estado-tabla" role="status">{texto}</p>;
export const Vacio = ({ children }) => <p className="estado-tabla">{children}</p>;

/* ---------- Avisos emergentes (toast): confirman una acción sin desplazar el contenido ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const avisar = useCallback((mensaje, tipo = 'ok') => {
    if (!mensaje) return;
    const id = Math.random().toString(36).slice(2);
    setItems((p) => [...p, { id, mensaje, tipo }]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 5200);
  }, []);
  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <Icono nombre={t.tipo === 'error' ? 'alerta' : 'ok'} tam={18} />
            <span>{t.mensaje}</span>
            <button aria-label="Cerrar aviso" onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}><Icono nombre="cerrar" tam={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Piezas de presentación ---------- */
export function Iniciales({ nombres, apellidos }) {
  const t = `${(nombres ?? '').trim()[0] ?? ''}${(apellidos ?? '').trim()[0] ?? ''}`.toUpperCase();
  return <span className="iniciales" aria-hidden="true">{t}</span>;
}

export function Esqueleto({ filas = 5, columnas = 5 }) {
  return (
    <div className="tabla-envoltorio" role="status" aria-label="Cargando datos">
      <table>
        <tbody>
          {Array.from({ length: filas }).map((_, i) => (
            <tr key={i}>{Array.from({ length: columnas }).map((__, j) => <td key={j}><span className="esqueleto" style={{ width: `${55 + ((i * 7 + j * 13) % 40)}%` }} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EstadoVacio({ titulo, children, accion }) {
  return (
    <div className="vacio">
      <svg width="88" height="64" viewBox="0 0 88 64" fill="none" aria-hidden="true">
        <rect x="4" y="8" width="80" height="50" rx="8" stroke="#9BB0AE" strokeWidth="2" strokeDasharray="5 4" />
        <circle cx="26" cy="29" r="7" stroke="#9BB0AE" strokeWidth="2" />
        <path d="M14 48c1.6-6 6-8 12-8s10.400 2 12 8" stroke="#9BB0AE" strokeWidth="2" strokeLinecap="round" />
        <path d="M50 26h24M50 36h16" stroke="#C7D3D1" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="vacio-titulo">{titulo}</p>
      {children && <p className="vacio-texto">{children}</p>}
      {accion}
    </div>
  );
}

export function Segmentado({ etiqueta, valor, opciones, onCambiar }) {
  return (
    <div className="segmentado" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} className={valor === o.valor ? 'activo' : ''} onClick={() => onCambiar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/** Barra proporcional: muestra de un vistazo cómo se reparte un total entre dos categorías. */
export function BarraProporcion({ a, b, etiquetaA, etiquetaB, tonoA = 'alerta', tonoB = 'ok' }) {
  const total = a + b;
  const pa = total ? (a / total) * 100 : 0;
  return (
    <div className="proporcion">
      <div className="barra" role="img" aria-label={`${etiquetaA}: ${a}. ${etiquetaB}: ${b}.`}>
        <span className={`tramo tramo-${tonoA}`} style={{ width: `${pa}%` }} />
        <span className={`tramo tramo-${tonoB}`} style={{ width: `${100 - pa}%` }} />
      </div>
      <dl className="leyenda-barra">
        <div><dt><i className={`punto punto-${tonoA}`} />{etiquetaA}</dt><dd>{a}</dd></div>
        <div><dt><i className={`punto punto-${tonoB}`} />{etiquetaB}</dt><dd>{b}</dd></div>
      </dl>
    </div>
  );
}
