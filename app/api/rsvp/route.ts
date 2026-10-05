import { isRateLimited, readSmallJson } from "@/lib/api-security";
import { saveRsvp, type Attendance } from "@/lib/wedding-store";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

export async function POST(request: Request) {
  try {
    if (isRateLimited(request, "rsvp", 8, 10 * 60 * 1000)) {
      return Response.json({ error: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
    }

    const payload = await readSmallJson(request);

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

    const record = await saveRsvp({
      guestName,
      contact,
      attendance: attendance as Attendance,
      guestCount: attendance === "yes" ? guestCount : 1,
    });

    return Response.json(
      { ok: true, confirmationCode: record.confirmationCode },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("RSVP submission failed", error);
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE")) {
      return Response.json({ error: "The RSVP submission was not valid." }, { status: 400 });
    }
    return Response.json(
      { error: "We could not save your RSVP just now. Please try again." },
      { status: 503 },
    );
  }
}
