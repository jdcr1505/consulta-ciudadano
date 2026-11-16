import { AppError, badRequest, conflict } from '../../common/errors.js';
import { ServicioNoDisponibleError } from '../../integrations/defensa/DefensaProvider.js';
import { generarCredencialTemporal } from '../auth/credenciales.js';
import { solicitudesRepository as repo } from './solicitudes.repository.js';

export const ROL_FUNCIONARIO = 'FUNCIONARIO';

const MENSAJES = {
  VALIDADA: 'Su información fue validada. Enviamos una contraseña temporal al correo registrado.',
  PENDIENTE_REVISION:
    'No fue posible validar su información de forma automática. Su solicitud quedó pendiente de revisión por un administrador. Mientras esté pendiente no tendrá acceso al sistema.',
};

/** HU01 — Registrar solicitud de acceso (con validación simulada contra Defensa) y HU02 — emisión de credenciales. */
export function createSolicitudesService({ prisma, cfg, defensa, mail, audit }) {
  return {
    async crear(data, ip) {
      const rango = await repo.fuerzaConRango(prisma, data.fuerzaPublicaId, data.rangoId);
      if (!rango) throw badRequest('FUERZA_RANGO_INVALIDO', 'El rango seleccionado no corresponde a la fuerza pública indicada');

      if (await repo.usuarioPorIdentificacionOCorreo(prisma, data.identificacion, data.correo)) {
        throw conflict('USUARIO_YA_REGISTRADO', 'Ya existe un acceso registrado con la identificación o el correo indicados');
      }
      if (await repo.pendientePorIdentificacion(prisma, data.identificacion)) {
        throw conflict('SOLICITUD_PENDIENTE', 'Ya existe una solicitud pendiente de revisión para esta identificación');
      }

      let resultado;
      try {
        resultado = await defensa.validar({
          identificacion: data.identificacion,
          nombres: data.nombres,
          apellidos: data.apellidos,
          fuerza: rango.fuerza.nombre,
          rango: rango.nombre,
          idFuerza: data.idFuerza,
        });
      } catch (e) {
        if (!(e instanceof ServicioNoDisponibleError)) throw e;
        resultado = 'SERVICIO_NO_DISPONIBLE';
      }

      const base = {
        identificacion: data.identificacion,
        nombres: data.nombres,
        apellidos: data.apellidos,
        correo: data.correo,
        fuerzaPublicaId: data.fuerzaPublicaId,
        rangoId: data.rangoId,
        idFuerza: data.idFuerza,
        resultadoValidacion: resultado,
      };

      try {
        if (resultado !== 'VALIDADO') {
          const s = await prisma.$transaction(async (tx) => {
            const creada = await repo.crearSolicitud(tx, { ...base, estado: 'PENDIENTE_REVISION' });
            await audit.registrar(
              { accion: 'SOLICITUD_CREADA', entidad: 'solicitud', entidadId: creada.id, ip, detalle: { estado: 'PENDIENTE_REVISION', resultado } },
              tx,
            );
            return creada;
          });
          return { solicitudId: s.id, estado: 'PENDIENTE_REVISION', resultadoValidacion: resultado, mensaje: MENSAJES.PENDIENTE_REVISION };
        }

        const cred = await generarCredencialTemporal(cfg);
        const rol = await repo.rolPorNombre(prisma, ROL_FUNCIONARIO);
        const s = await prisma.$transaction(async (tx) => {
          const usuario = await repo.crearUsuarioFuncionario(tx, {
            identificacion: data.identificacion,
            nombres: data.nombres,
            apellidos: data.apellidos,
            correo: data.correo,
            rolId: rol.id,
            fuerzaPublicaId: data.fuerzaPublicaId,
            rangoId: data.rangoId,
            idFuerza: data.idFuerza,
            passwordHash: cred.passwordHash,
            debeCambiarPassword: true,
            passwordExpiraEn: cred.passwordExpiraEn,
          });
          const creada = await repo.crearSolicitud(tx, { ...base, estado: 'VALIDADA', usuarioId: usuario.id });
          await audit.registrar(
            { usuarioId: usuario.id, accion: 'SOLICITUD_CREADA', entidad: 'solicitud', entidadId: creada.id, ip, detalle: { estado: 'VALIDADA' } },
            tx,
          );
          // Si el correo falla, la transacción se revierte: no quedan cuentas sin credenciales entregadas.
          try {
            await mail.enviarCredenciales({
              para: data.correo,
              nombres: data.nombres,
              identificacion: data.identificacion,
              passwordTemporal: cred.passwordTemporal,
              expiraEn: cred.passwordExpiraEn,
            });
          } catch {
            throw new AppError(503, 'CORREO_NO_DISPONIBLE', 'No fue posible enviar el correo con sus credenciales. Intente más tarde');
          }
          return creada;
        });
        return { solicitudId: s.id, estado: 'VALIDADA', resultadoValidacion: 'VALIDADO', mensaje: MENSAJES.VALIDADA };
      } catch (e) {
        if (e?.code === 'P2002') {
          throw conflict('USUARIO_YA_REGISTRADO', 'Ya existe un acceso o una solicitud pendiente con los datos indicados');
        }
        throw e;
      }
    },
  };
}
