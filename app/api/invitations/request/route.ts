import { isRateLimited, readSmallJson } from "@/lib/api-security";
import { createInvitationRequest } from "@/lib/wedding-store";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

export async function POST(request: Request) {
  try {
    if (isRateLimited(request, "invitation-request", 5, 30 * 60 * 1000)) {
      return Response.json({ error: "Too many requests. Please wait before trying again." }, { status: 429 });
    }

    const payload = await readSmallJson(request);
    if (clean(payload.website, 50)) return Response.json({ ok: true }, { status: 201 });
    const guestName = clean(payload.guestName, 100);
    const email = clean(payload.email, 160).toLowerCase();
    const requestedGuests = Math.max(1, Math.min(6, Number(payload.requestedGuests) || 1));
    if (guestName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Please enter your name and a valid email address." }, { status: 400 });
    }

    const invitationRequest = await createInvitationRequest({ guestName, email, requestedGuests });
    return Response.json(
      { ok: true, requestId: invitationRequest.id, accessToken: invitationRequest.accessToken, status: invitationRequest.status },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Invitation request failed", error);
    return Response.json({ error: "We could not send your request just now." }, { status: 503 });
  }
}
