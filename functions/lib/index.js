"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInviteEmail = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const nodemailer_1 = __importDefault(require("nodemailer"));
admin.initializeApp();
const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;
const REPLY_TO = process.env.REPLY_TO || "invite@orbylox.de";
const transporter = nodemailer_1.default.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});
exports.sendInviteEmail = (0, https_1.onCall)(async (request) => {
    const auth = request.auth;
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "Sign-in required.");
    }
    const data = request.data;
    const to = String(data?.to || "").trim();
    const projectId = String(data?.projectId || "").trim();
    const appUrl = String(data?.appUrl || "").trim() || "https://orbylox.de";
    if (!to || !to.includes("@")) {
        throw new https_1.HttpsError("invalid-argument", "Invalid recipient email.");
    }
    if (!projectId) {
        throw new https_1.HttpsError("invalid-argument", "Missing projectId.");
    }
    if (!SMTP_USER || !SMTP_PASS) {
        throw new https_1.HttpsError("failed-precondition", "SMTP is not configured.");
    }
    const inviteLink = `${appUrl.replace(/\/$/, "")}/login?project=${encodeURIComponent(projectId)}`;
    const subject = data.subject || "You've been invited to ORBYLOX";
    const bodyText = data.bodyText ||
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
    }
    catch (err) {
        throw new https_1.HttpsError("internal", err?.message || "Failed to send email.");
    }
});
