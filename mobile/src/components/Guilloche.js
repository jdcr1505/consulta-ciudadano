import { useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';

/** Guilloché: trama de líneas onduladas (medida antifalsificación de cédulas y billetes). Seña visual del sistema. */
export default function Guilloche({ ancho = 400, alto = 200, lineas = 20, color = '#ffffff', opacidad = 0.18, fase = 0, style }) {
  const trazos = useMemo(() => {
    const salida = [];
    for (let i = 0; i < lineas; i++) {
      const t = i / (lineas - 1);
      const base = alto * (0.12 + 0.76 * t);
      const pts = [];
      for (let x = 0; x <= ancho; x += 8) {
        const y = base + alto * 0.16 * Math.sin((x / ancho) * Math.PI * 4 + t * 5 + fase) + alto * 0.06 * Math.sin((x / ancho) * Math.PI * 11 - t * 9 + fase * 2);
        pts.push(`${x},${y.toFixed(1)}`);
      }
      salida.push(`M${pts.join(' L')}`);
    }
    return salida;
  }, [ancho, alto, lineas, fase]);
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" style={[{ position: 'absolute', top: 0, left: 0 }, style]} pointerEvents="none">
      {trazos.map((d, i) => <Path key={i} d={d} fill="none" stroke={color} strokeWidth={0.8} strokeOpacity={opacidad} />)}
    </Svg>
  );
}
