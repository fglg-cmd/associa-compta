import "server-only";
import { Resend } from "resend";
import { serverEnv } from "./env";

let client: Resend | null = null;

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/**
 * Envoi via Resend. Sans clé configurée, renvoie { ok:false } explicitement :
 * l'interface informe l'utilisateur, aucun envoi n'est simulé.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!serverEnv.resendApiKey) return { ok: false, error: "L'envoi d'e-mails n'est pas configuré (RESEND_API_KEY)." };
  client ??= new Resend(serverEnv.resendApiKey);
  const { data, error } = await client.emails.send({
    from: serverEnv.emailFrom,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: msg.replyTo,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Échec de l'envoi" };
  return { ok: true, id: data.id };
}
