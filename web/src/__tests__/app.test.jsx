import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { ToastProvider } from '../components/ui.jsx';
import { setAccessToken } from '../api/client.js';

const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const err = (status, code, message, details) => json(status, { error: { code, message, details } });

const INFO = { sistema: 'x', simulaciones: { datos: true, defensa: true, correo: true } };
const usuario = (extra = {}) => ({ id: 1, identificacion: '1000000001', nombres: 'Ana', apellidos: 'Admin', rol: 'ADMINISTRADOR', permisos: ['ciudadanos:leer', 'usuarios:leer', 'roles:leer'], debeCambiarPassword: false, ...extra });

let llamadas;
function simular(rutas) {
  llamadas = [];
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const clave = `${opts.method ?? 'GET'} ${url.replace('/api/v1', '').split('?')[0]}`;
    llamadas.push({ clave, cuerpo: opts.body ? JSON.parse(opts.body) : undefined });
    if (clave === 'GET /info') return json(200, INFO);
    const h = rutas[clave];
    if (!h) return err(404, 'NO_ENCONTRADO', `sin mock para ${clave}`);
    return typeof h === 'function' ? h(opts) : h;
  });
}
const montar = (ruta = '/') => render(<MemoryRouter initialEntries={[ruta]}><AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider></MemoryRouter>);

beforeEach(() => { localStorage.clear(); setAccessToken(null); });
afterEach(() => cleanup());

describe('[HU03] pantalla de inicio de sesión', () => {
  it('sin sesión muestra el login y valida campos obligatorios (CA04) sin llamar a la API', async () => {
    simular({ 'POST /auth/refresh': err(401, 'TOKEN_INVALIDO', 'Sesión inválida') });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('La identificación es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(llamadas.some((l) => l.clave === 'POST /auth/login')).toBe(false);
  });

  it('muestra el mensaje genérico del servidor ante credenciales inválidas', async () => {
    simular({
      'POST /auth/refresh': err(401, 'TOKEN_INVALIDO', 'Sesión inválida'),
      'POST /auth/login': err(401, 'CREDENCIALES_INVALIDAS', 'Las credenciales no son válidas'),
    });
    montar();
    await userEvent.type(await screen.findByLabelText('Número de identificación'), '1000000001');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Mala1pass');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Las credenciales no son válidas');
  });

  it('"Recordar" guarda solo la identificación, nunca la contraseña ni el token', async () => {
    simular({
      'POST /auth/refresh': err(401, 'TOKEN_INVALIDO', 'Sesión inválida'),
      'POST /auth/login': json(200, { accessToken: 'tok-secreto', expiresIn: 900, usuario: usuario() }),
      'GET /resumen': json(200, {}),
    });
    montar();
    await userEvent.type(await screen.findByLabelText('Número de identificación'), '1000000001');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secreta1x');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await screen.findByRole('navigation', { name: 'Principal' });
    const guardado = JSON.stringify({ ...localStorage });
    expect(guardado).toContain('1000000001');
    expect(guardado).not.toContain('Secreta1x');
    expect(guardado).not.toContain('tok-secreto');
  });
});

describe('servidor no disponible', () => {
  it('si el proxy responde 500 sin cuerpo (backend apagado) explica que el servidor no responde', async () => {
    simular({
      'POST /auth/refresh': new Response(null, { status: 500 }),
      'POST /auth/login': new Response(null, { status: 500 }),
    });
    montar();
    await userEvent.type(await screen.findByLabelText('Número de identificación'), '1000000001');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Admin1');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no responde');
  });
});

describe('[HU03] cambio obligatorio de contraseña (CA08)', () => {
  it('con contraseña temporal solo se ve el formulario de cambio y valida la confirmación', async () => {
    simular({ 'POST /auth/refresh': json(200, { accessToken: 't', expiresIn: 900, usuario: usuario({ debeCambiarPassword: true }) }) });
    montar();
    expect(await screen.findByRole('heading', { name: 'Cambie su contraseña' })).toBeInTheDocument();
    expect(screen.queryByText('Ciudadanos')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Contraseña actual (temporal)'), 'Tmp123');
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'Nueva123');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña nueva'), 'Distinta1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('La confirmación no coincide')).toBeInTheDocument();
    expect(llamadas.some((l) => l.clave === 'POST /auth/cambiar-password')).toBe(false);
  });

  it('muestra el error de política devuelto por el servidor', async () => {
    simular({
      'POST /auth/refresh': json(200, { accessToken: 't', expiresIn: 900, usuario: usuario({ debeCambiarPassword: true }) }),
      'POST /auth/cambiar-password': err(400, 'PASSWORD_NO_CUMPLE_POLITICA', 'La contraseña debe tener entre 6 y 64 caracteres'),
    });
    montar();
    await userEvent.type(await screen.findByLabelText('Contraseña actual (temporal)'), 'Tmp123');
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'abc');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña nueva'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('entre 6 y 64 caracteres');
  });
});

describe('navegación según permisos', () => {
  it('el administrador ve las tres opciones y los datos persistidos de la API', async () => {
    simular({
      'POST /auth/refresh': json(200, { accessToken: 't', expiresIn: 900, usuario: usuario({ permisos: ['ciudadanos:leer', 'ciudadanos:crear', 'usuarios:leer', 'roles:leer', 'reportes:leer'] }) }),
      'GET /ciudadanos': json(200, { total: 1, page: 1, pageSize: 10, items: [{ id: 1, identificacion: '00123456', nombres: 'Marta Lucía', apellidos: 'Herrera Soto', fechaNacimiento: '1960-09-05', lugarNacimiento: 'Bucaramanga', fechaExpedicion: '1978-10-11', lugarExpedicion: 'Bucaramanga', rh: 'NEGATIVO', grupoSanguineo: 'A', estaturaCm: 158, estadoJudicial: 'NO_REQUERIDO', activo: true }] }),
    });
    montar('/ciudadanos');
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(nav).toHaveTextContent('Inicio');
    expect(nav).toHaveTextContent('Ciudadanos');
    expect(nav).toHaveTextContent('Usuarios');
    expect(nav).toHaveTextContent('Roles y permisos');
    expect(nav).toHaveTextContent('Reportes');
    // el cero inicial de la identificación se conserva en pantalla
    expect(await screen.findByText('00123456')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar ciudadano' })).toBeInTheDocument();
  });

  it('un funcionario (sin permisos web) ve un mensaje y ninguna opción', async () => {
    simular({ 'POST /auth/refresh': json(200, { accessToken: 't', expiresIn: 900, usuario: usuario({ rol: 'FUNCIONARIO', permisos: ['consultas:crear'] }) }) });
    montar();
    expect(await screen.findByRole('heading', { name: 'Sin opciones disponibles' })).toBeInTheDocument();
    expect(screen.getByText(/aplicación móvil/)).toBeInTheDocument();
  });

  it('muestra la banda que declara las simulaciones activas', async () => {
    simular({ 'POST /auth/refresh': err(401, 'TOKEN_INVALIDO', 'x') });
    montar();
    await waitFor(() => expect(screen.getByRole('note')).toHaveTextContent('datos ficticios'));
    expect(screen.getByRole('note')).toHaveTextContent('validación de Defensa simulada');
  });
});

describe('Inicio (indicadores por permisos)', () => {
  it('muestra los indicadores que el rol puede ver, con la proporción de requeridos', async () => {
    simular({
      'POST /auth/refresh': json(200, { accessToken: 't', expiresIn: 900, usuario: usuario() }),
      'GET /resumen': json(200, { ciudadanos: { total: 8, requeridos: 3, noRequeridos: 5 }, usuarios: { activos: 2, inactivos: 1 }, consultasHoy: { total: 4, requeridos: 1, noEncontrados: 1 } }),
    });
    montar('/inicio');
    expect(await screen.findByText('Ciudadanos activos')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Requeridos: 3. No requeridos: 5/ })).toBeInTheDocument();
    expect(screen.getByText('Consultas de hoy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Preparar un reporte|Registrar o consultar/ })).toBeInTheDocument();
  });

  it('un rol sin permisos de consulta no ve indicadores', async () => {
    simular({
      'POST /auth/refresh': json(200, { accessToken: 't', expiresIn: 900, usuario: usuario({ rol: 'FUNCIONARIO', permisos: ['consultas:crear'] }) }),
      'GET /resumen': json(200, {}),
    });
    montar('/inicio');
    expect(await screen.findByRole('heading', { name: 'Sin opciones disponibles' })).toBeInTheDocument();
    expect(screen.queryByText('Ciudadanos activos')).not.toBeInTheDocument();
  });
});

describe('[HU16] selección de la información del reporte', () => {
  const fila = (id, n, a, r, u) => ({ identificacion: id, nombres: n, apellidos: a, resultado: r, ultimaConsulta: u });
  function reportes(extra = {}) {
    return {
      'POST /auth/refresh': json(200, { accessToken: 't', expiresIn: 900, usuario: usuario({ permisos: ['reportes:leer'] }) }),
      'GET /reportes/ciudadanos/vista-previa': (opts) => json(200, {
        criterios: {}, resumen: { total: 8, requeridos: 3, noRequeridos: 5 }, total: 2, page: 1, pageSize: 10,
        items: [fila('79123456', 'Jorge Enrique', 'Castaño Lara', 'REQUERIDO', null), fila('80987654', 'Andrés Felipe', 'Gómez Ríos', 'REQUERIDO', '2026-11-15T15:00:00Z')],
      }),
      ...extra,
    };
  }
  const ultimaConsulta = () => globalThis.fetch.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('vista-previa')).at(-1);

  it('muestra la vista previa con identificación, nombres, apellidos y resultado', async () => {
    simular(reportes());
    montar('/reportes');
    expect(await screen.findByText('79123456')).toBeInTheDocument();
    expect(screen.getByText('Castaño Lara')).toBeInTheDocument();
    expect(screen.getAllByText('Requerido').length).toBeGreaterThan(0);
    expect(ultimaConsulta()).toContain('estado=TODOS');
    expect(ultimaConsulta()).toContain('columnas=resultado');
  });

  it('cambiar el estado y las columnas vuelve a consultar con esos criterios', async () => {
    simular(reportes());
    montar('/reportes');
    await screen.findByText('79123456');
    await userEvent.click(screen.getByRole('radio', { name: 'Requeridos' }));
    await waitFor(() => expect(ultimaConsulta()).toContain('estado=REQUERIDO'));
    await userEvent.click(screen.getByRole('checkbox', { name: /última consulta/ }));
    await waitFor(() => expect(ultimaConsulta()).toContain('columnas=resultado%2CultimaConsulta'));
    expect(await screen.findByText('Nunca consultado')).toBeInTheDocument();
  });

  it('el botón de PDF está deshabilitado y explica que llega con HU17', async () => {
    simular(reportes());
    montar('/reportes');
    expect(await screen.findByRole('button', { name: /Generar PDF/ })).toBeDisabled();
    expect(screen.getByText(/Sprint 3 \(HU17\)/)).toBeInTheDocument();
  });

  it('sin permiso reportes:leer la ruta redirige al inicio', async () => {
    simular({ 'POST /auth/refresh': json(200, { accessToken: 't', expiresIn: 900, usuario: usuario({ permisos: ['ciudadanos:leer'] }) }), 'GET /resumen': json(200, {}) });
    montar('/reportes');
    expect(await screen.findByText('Accesos rápidos')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reportes' })).not.toBeInTheDocument();
  });
});
