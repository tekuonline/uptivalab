import nodemailer from "nodemailer";
import type { NotificationChannel } from "@prisma/client";
import type { MonitorResult } from "@uptivalab/monitoring";
import { appConfig } from "../../config.js";
import { type NotificationAdapter, readChannelConfig } from "./base.js";

interface EmailConfig {
  email?: string;
  emails?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  [key: string]: string | undefined;
}

let globalTransporter: nodemailer.Transporter | null = null;

const getGlobalTransporter = () => {
  if (globalTransporter) return globalTransporter;
  if (!appConfig.SMTP_HOST) return null;
  
  globalTransporter = nodemailer.createTransport({
    host: appConfig.SMTP_HOST,
    port: appConfig.SMTP_PORT,
    auth: appConfig.SMTP_USER
      ? {
          user: appConfig.SMTP_USER,
          pass: appConfig.SMTP_PASS,
        }
      : undefined,
  });
  return globalTransporter;
};

const createTransporter = (config: EmailConfig) => {
  // Use per-channel SMTP settings if provided
  if (config.smtpHost && config.smtpPort) {
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: parseInt(config.smtpPort, 10),
      secure: parseInt(config.smtpPort, 10) === 465, // Use TLS for port 465
      auth: config.smtpUser && config.smtpPass
        ? {
            user: config.smtpUser,
            pass: config.smtpPass,
          }
        : undefined,
    });
  }
  
  // Fall back to global SMTP settings
  return getGlobalTransporter();
};

const send = async (channel: NotificationChannel, result: MonitorResult) => {
  const config = readChannelConfig<EmailConfig>(channel);
  const transport = createTransporter(config);
  
  if (!transport) {
    console.warn("No SMTP configuration available for email notification");
    return;
  }

  const fromEmail = config.smtpFrom || config.smtpUser || appConfig.SMTP_USER || "uptivalab@localhost";
  
  // Support multiple email recipients
  const toEmails = config.emails || config.email || channel.name;

  await transport.sendMail({
    to: toEmails,
    from: fromEmail,
    subject: `[UptivaLab] ${result.status.toUpperCase()} - ${result.monitorId}`,
    text: result.message,
  });
};

export const emailNotifier: NotificationAdapter = {
  send,
};
