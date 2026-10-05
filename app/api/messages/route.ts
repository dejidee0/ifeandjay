import { isRateLimited, readSmallJson } from "@/lib/api-security";
import { listGuestMessages, saveGuestMessage } from "@/lib/wedding-store";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

export async function GET() {
  try {
    const messages = await listGuestMessages({ approvedOnly: true, limit: 12 });

    return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Guest messages unavailable", error);
    return Response.json({ messages: [], unavailable: true });
  }
}

export async function POST(request: Request) {
  try {
    if (isRateLimited(request, "guest-message", 6, 10 * 60 * 1000)) {
      return Response.json({ error: "Too many messages. Please wait a few minutes and try again." }, { status: 429 });
    }

    const payload = await readSmallJson(request);

    if (clean(payload.website, 50)) {
      return Response.json({ ok: true }, { status: 201 });
    }

    const guestName = clean(payload.guestName, 60);
    const message = clean(payload.message, 280);

    if (guestName.length < 2 || message.length < 3) {
      return Response.json({ error: "Please add your name and a short message." }, { status: 400 });
    }

    const saved = await saveGuestMessage({ guestName, message });
    return Response.json({ ok: true, id: saved.id }, { status: 201 });
  } catch (error) {
    console.error("Guest message submission failed", error);
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE")) {
      return Response.json({ error: "The message submission was not valid." }, { status: 400 });
    }
    return Response.json(
      { error: "We could not save your message just now. Please try again." },
      { status: 503 },
    );
  }
}
