import { getDb } from "@/db";
import { rsvps } from "@/db/schema";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;

    if (clean(payload.website, 50)) {
      return Response.json({ ok: true, confirmationCode: "RECEIVED" }, { status: 201 });
    }

    const guestName = clean(payload.guestName, 80);
    const contact = clean(payload.contact, 120);
    const attendance = clean(payload.attendance, 12);
    const guestCount = Math.max(1, Math.min(6, Number(payload.guestCount) || 1));

    if (guestName.length < 2 || contact.length < 5) {
      return Response.json({ error: "Please add your name and a valid contact." }, { status: 400 });
    }

    if (!new Set(["yes", "no", "maybe"]).has(attendance)) {
      return Response.json({ error: "Please select an attendance response." }, { status: 400 });
    }

    const confirmationCode = `IJ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const db = await getDb();
    await db.insert(rsvps).values({
      guestName,
      contact,
      attendance,
      guestCount: attendance === "yes" ? guestCount : 1,
      confirmationCode,
    });

    return Response.json({ ok: true, confirmationCode }, { status: 201 });
  } catch (error) {
    console.error("RSVP submission failed", error);
    return Response.json(
      { error: "We could not save your RSVP just now. Please try again." },
      { status: 503 },
    );
  }
}
