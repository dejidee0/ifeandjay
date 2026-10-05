import { createHmac, timingSafeEqual } from "node:crypto";
import { getInvitationByCode } from "@/lib/wedding-store";
import { adminFromRequest } from "@/lib/admin-session";

export const INVITATION_COOKIE = "ij_private_invitation";
export const INVITATION_MAX_AGE = 60 * 60 * 24 * 60;

export type InvitationSession = {
  code: string;
  guestName: string;
  maxGuests: number;
  issuedAt: number;
};

function secret() {
  const value = process.env.INVITATION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("INVITATION_SECRET is not configured securely.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createInvitationToken(session: Omit<InvitationSession, "issuedAt">) {
  const payload = Buffer.from(JSON.stringify({ ...session, issuedAt: Date.now() })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyInvitationToken(token: string): InvitationSession | null {
  try {
    const [payload, suppliedSignature] = token.split(".");
    if (!payload || !suppliedSignature) return null;
    const expected = signature(payload);
    const left = Buffer.from(suppliedSignature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as InvitationSession;
    if (
      typeof session.code !== "string" ||
      typeof session.guestName !== "string" ||
      !Number.isInteger(session.maxGuests) ||
      typeof session.issuedAt !== "number" ||
      Date.now() - session.issuedAt > INVITATION_MAX_AGE * 1000
    ) return null;
    return session;
  } catch {
    return null;
  }
}

export async function resolveInvitationToken(token?: string | null) {
  if (!token) return null;
  const session = verifyInvitationToken(token);
  if (!session) return null;
  const invitation = await getInvitationByCode(session.code);
  if (!invitation || invitation.status !== "active") return null;
  return {
    code: invitation.code,
    guestName: invitation.guestName,
    maxGuests: invitation.maxGuests,
  };
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function invitationFromRequest(request: Request) {
  if (adminFromRequest(request)) {
    return Promise.resolve({ code: "ADMIN", guestName: "Ifedayo & Joyce · Admin", maxGuests: 6 });
  }
  return resolveInvitationToken(cookieValue(request, INVITATION_COOKIE));
}
