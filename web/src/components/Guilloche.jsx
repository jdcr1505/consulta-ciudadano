import { useMemo } from 'react';

/**
 * Guilloché: trama de líneas onduladas superpuestas, la medida antifalsificación clásica de cédulas y billetes.
 * Es la seña visual del sistema (panel de acceso, barra lateral, tarjetas de resultado).
 */
export default function Guilloche({ ancho = 600, alto = 240, lineas = 26, color = '#ffffff', opacidad = 0.16, fase = 0 }) {
  const trazos = useMemo(() => {
    const salida = [];
    for (let i = 0; i < lineas; i++) {
      const t = i / (lineas - 1);
      const base = alto * (0.12 + 0.76 * t);
      const a1 = alto * 0.16;
      const a2 = alto * 0.06;
      const pts = [];
      for (let x = 0; x <= ancho; x += 6) {
        const y = base + a1 * Math.sin((x / ancho) * Math.PI * 4 + t * 5 + fase) + a2 * Math.sin((x / ancho) * Math.PI * 11 - t * 9 + fase * 2);
        pts.push(`${x},${y.toFixed(1)}`);
      }
      salida.push(`M${pts.join(' L')}`);
    }
    return salida;
  }, [ancho, alto, lineas, fase]);

  return (
    <svg className="guilloche" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g fill="none" stroke={color} strokeWidth="0.7" strokeOpacity={opacidad}>
        {trazos.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  );
}

export function Sello() {
  return null;
}