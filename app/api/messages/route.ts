import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guestMessages } from "@/db/schema";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

export async function GET() {
  try {
    const db = await getDb();
    const messages = await db
      .select({
        id: guestMessages.id,
        guestName: guestMessages.guestName,
        message: guestMessages.message,
        createdAt: guestMessages.createdAt,
      })
      .from(guestMessages)
      .where(and(eq(guestMessages.status, "approved")))
      .orderBy(desc(guestMessages.createdAt), desc(guestMessages.id))
      .limit(12);

    return Response.json({ messages });
  } catch (error) {
    console.error("Guest messages unavailable", error);
    return Response.json({ messages: [], unavailable: true });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;

    if (clean(payload.website, 50)) {
      return Response.json({ ok: true }, { status: 201 });
    }

    const guestName = clean(payload.guestName, 60);
    const message = clean(payload.message, 280);

    if (guestName.length < 2 || message.length < 3) {
      return Response.json({ error: "Please add your name and a short message." }, { status: 400 });
    }

    const db = await getDb();
    await db.insert(guestMessages).values({ guestName, message, status: "pending" });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Guest message submission failed", error);
    return Response.json(
      { error: "We could not save your message just now. Please try again." },
      { status: 503 },
    );
  }
}
