import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

admin.initializeApp();

const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;
const REPLY_TO = process.env.REPLY_TO || "invite@orbylox.de";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export const sendInviteEmail = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }

  const data = request.data as {
    to: string;
    projectId: string;
    subject?: string;
    bodyText?: string;
    appUrl?: string;
  };

  const to = String(data?.to || "").trim();
  const projectId = String(data?.projectId || "").trim();
  const appUrl = String(data?.appUrl || "").trim() || "https://orbylox.de";

  if (!to || !to.includes("@")) {
    throw new HttpsError("invalid-argument", "Invalid recipient email.");
  }
  if (!projectId) {
    throw new HttpsError("invalid-argument", "Missing projectId.");
  }
  if (!SMTP_USER || !SMTP_PASS) {
    throw new HttpsError("failed-precondition", "SMTP is not configured.");
  }

  const inviteLink = `${appUrl.replace(/\/$/, "")}/login?project=${encodeURIComponent(projectId)}`;
  const subject = data.subject || "You've been invited to ORBYLOX";
  const bodyText =
    data.bodyText ||
    `You've been invited to collaborate on a project in ORBYLOX.\n\nOpen the project: ${inviteLink}\n\nIf you don't have an account yet, create one first, then open the link again.`;

  try {
    const info = await transporter.sendMail({
      from: `ORBYLOX <${FROM_EMAIL}>`,
      to,
      replyTo: REPLY_TO,
      subject,
      text: bodyText,
    });
    return { status: "ok", messageId: info.messageId };
  } catch (err: any) {
    throw new HttpsError("internal", err?.message || "Failed to send email.");
  }
});

