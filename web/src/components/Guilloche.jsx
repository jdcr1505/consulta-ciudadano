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

export function Sello({ tam = 36 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 40 40" role="img" aria-label="Registraduría Konrad Lorenz">
      <rect width="40" height="40" rx="10" fill="#F2B705" />
      <rect x="7" y="11" width="26" height="18" rx="3" fill="none" stroke="#0B3135" strokeWidth="2" />
      <circle cx="15" cy="18" r="2.6" fill="#0B3135" />
      <path d="M11 25c.6-2 2-2.8 4-2.8s3.4.8 4 2.8" fill="none" stroke="#0B3135" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M23 17h6M23 21h5" stroke="#0B3135" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
