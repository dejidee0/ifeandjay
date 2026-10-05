type Attempt = { count: number; resetAt: number };

const attempts = new Map<string, Attempt>();

export function clientAddress(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function isRateLimited(request: Request, bucket: string, maximum: number, windowMs: number) {
  const now = Date.now();
  const key = `${bucket}:${clientAddress(request)}`;
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  current.count += 1;
  return current.count > maximum;
}

export async function readSmallJson(request: Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 12_000) throw new Error("PAYLOAD_TOO_LARGE");
  return (await request.json()) as Record<string, unknown>;
}

export function secureCompare(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function isAdminAuthorized(request: Request) {
  const adminKey = process.env.ADMIN_KEY?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(adminKey && supplied && secureCompare(supplied, adminKey));
}
