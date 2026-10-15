import nodemailer, { type Transporter } from "nodemailer";

/*
 * Email for daily stock summaries, through any SMTP service (Brevo,
 * Zoho, Gmail…): SMTP_URL=smtp(s)://user:password@host:port and
 * MAIL_FROM="Mizan <alerts@yourdomain>".
 */

export const emailAvailable = () => Boolean(process.env.SMTP_URL && process.env.MAIL_FROM);

let transporter: Transporter | null = null;

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!emailAvailable()) throw new Error("Email is not configured");
  transporter ??= nodemailer.createTransport(process.env.SMTP_URL);
  await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html, text });
}
