import nodemailer from 'nodemailer';
import { plantillaCredenciales } from './MailProvider.js';

export class SmtpMailProvider {
  constructor(cfg) {
    this.from = cfg.mailFrom;
    this.simulado = false;
    this.transport = nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.port === 465,
      auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
    });
  }

  async enviarCredenciales(datos) {
    const { asunto, texto } = plantillaCredenciales(datos);
    await this.transport.sendMail({ from: this.from, to: datos.para, subject: asunto, text: texto });
  }
}
