import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "ij_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type AdminSession = {
  role: "admin";
  issuedAt: number;
};

function secret() {
  const value = process.env.ADMIN_KEY?.trim();
  if (!value || value.length < 16) throw new Error("ADMIN_KEY is not configured securely.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createAdminSessionToken() {
  const payload = Buffer.from(JSON.stringify({ role: "admin", issuedAt: Date.now() })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminSessionToken(token?: string | null) {
  if (!token) return false;
  try {
    const [payload, suppliedSignature] = token.split(".");
    if (!payload || !suppliedSignature) return false;
    const expected = signature(payload);
    const left = Buffer.from(suppliedSignature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return false;

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    return session.role === "admin"
      && typeof session.issuedAt === "number"
      && Date.now() - session.issuedAt <= ADMIN_SESSION_MAX_AGE * 1000;
  } catch {
    return false;
  }
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function adminFromRequest(request: Request) {
  return verifyAdminSessionToken(cookieValue(request, ADMIN_SESSION_COOKIE));
}
