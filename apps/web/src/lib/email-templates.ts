/**
 * Gabarits d'e-mails transactionnels (HTML compatible clients mail + texte brut).
 */
import { formatEUR } from "@associa/accounting";
import { fmtDate } from "./utils";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, cta?: { label: string; url: string }, footer?: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #e7e7ea;border-radius:12px">
<tr><td style="padding:28px 32px 8px"><div style="font-weight:600;font-size:15px;letter-spacing:-0.01em"><span style="display:inline-block;width:20px;height:20px;border-radius:6px;background:#4f46e5;vertical-align:-4px;margin-right:8px"></span>ASSOCIA COMPTA</div></td></tr>
<tr><td style="padding:16px 32px 8px"><h1 style="margin:0 0 12px;font-size:19px;letter-spacing:-0.01em">${esc(title)}</h1><div style="font-size:14px;line-height:1.6;color:#3f3f46">${body}</div></td></tr>
${cta ? `<tr><td style="padding:16px 32px 8px"><a href="${esc(cta.url)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:500;font-size:14px;padding:10px 18px;border-radius:8px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding:24px 32px 28px;font-size:12px;color:#a1a1aa">${footer ?? "Vous recevez ce message car vous utilisez ASSOCIA COMPTA."}</td></tr>
</table></td></tr></table></body></html>`;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "propriétaire",
  admin: "administrateur",
  treasurer: "trésorier",
  member: "membre du bureau",
  viewer: "lecteur (commissaire aux comptes)",
};

export function invitationEmail(p: { orgName: string; inviter: string; role: string; url: string }) {
  const subject = `Invitation à rejoindre ${p.orgName} sur ASSOCIA COMPTA`;
  return {
    subject,
    html: layout(
      `Rejoignez ${p.orgName}`,
      `<p>${esc(p.inviter)} vous invite à rejoindre l'espace financier de <strong>${esc(p.orgName)}</strong> en tant que ${ROLE_LABEL[p.role] ?? p.role}.</p><p>L'invitation est valable 14 jours.</p>`,
      { label: "Accepter l'invitation", url: p.url },
    ),
    text: `${p.inviter} vous invite à rejoindre ${p.orgName} sur ASSOCIA COMPTA (${ROLE_LABEL[p.role] ?? p.role}).\n\nAccepter : ${p.url}\n\nL'invitation est valable 14 jours.`,
  };
}

export function feeReminderEmail(p: {
  orgName: string;
  firstName: string;
  label: string;
  remaining: number;
  dueDate: string;
  contactEmail?: string | null;
  paymentInstructions?: string | null;
}) {
  const amount = formatEUR(p.remaining);
  const subject = `${p.orgName} — rappel de cotisation ${p.label}`;
  const instructions = p.paymentInstructions ? `<p>${esc(p.paymentInstructions)}</p>` : "";
  return {
    subject,
    html: layout(
      `Bonjour ${p.firstName},`,
      `<p>Sauf erreur de notre part, votre cotisation <strong>${esc(p.label)}</strong> à ${esc(p.orgName)} reste à régler :</p>
       <p style="font-size:22px;font-weight:600;color:#18181b;margin:16px 0">${esc(amount)}</p>
       <p>Échéance : ${esc(fmtDate(p.dueDate))}.</p>${instructions}
       <p>Si vous avez déjà effectué le règlement, merci de ne pas tenir compte de ce message.</p>
       <p>Merci pour votre soutien,<br>Le bureau de ${esc(p.orgName)}</p>`,
      undefined,
      `Message envoyé par ${esc(p.orgName)} via ASSOCIA COMPTA.${p.contactEmail ? ` Pour toute question : ${esc(p.contactEmail)}` : ""}`,
    ),
    text: `Bonjour ${p.firstName},\n\nVotre cotisation ${p.label} à ${p.orgName} reste à régler : ${amount} (échéance ${fmtDate(p.dueDate)}).\n${p.paymentInstructions ?? ""}\nSi vous avez déjà réglé, merci de ne pas tenir compte de ce message.\n\nLe bureau de ${p.orgName}`,
    replyTo: p.contactEmail ?? undefined,
  };
}

export function supportReplyEmail(p: { subject: string; reply: string }) {
  return {
    subject: `Re : ${p.subject}`,
    html: layout("Réponse du support", `<p style="white-space:pre-wrap">${esc(p.reply)}</p>`),
    text: p.reply,
  };
}
