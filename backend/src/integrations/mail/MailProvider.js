/**
 * Contrato del proveedor de correo:
 *   enviarCredenciales({ para, nombres, identificacion, passwordTemporal, expiraEn }) -> Promise<void>
 * Debe lanzar una excepción si el envío falla. NUNCA debe registrar la contraseña en logs.
 */
export function plantillaCredenciales({ nombres, identificacion, passwordTemporal, expiraEn }) {
  return {
    asunto: 'Sistema de Consulta Ciudadano — sus credenciales de acceso',
    texto:
      `Hola ${nombres},\n\n` +
      `Su acceso fue habilitado. Ingrese con su identificación (${identificacion}) y esta contraseña temporal:\n\n` +
      `    ${passwordTemporal}\n\n` +
      `La contraseña vence el ${expiraEn.toISOString()} y deberá cambiarla en su primer acceso.\n` +
      `No comparta este mensaje. Si no solicitó el acceso, ignórelo.\n\n` +
      `(Sistema académico con datos ficticios.)`,
  };
}
