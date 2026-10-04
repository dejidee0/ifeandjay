import { desc, eq } from "drizzle-orm";
import { getDb, getRuntimeBindings } from "@/db";
import { guestMessages } from "@/db/schema";

async function authorized(request: Request) {
  const { ADMIN_KEY: adminKey } = await getRuntimeBindings();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(adminKey && supplied && supplied === adminKey);
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  const db = await getDb();
  const messages = await db
    .select()
    .from(guestMessages)
    .orderBy(desc(guestMessages.createdAt), desc(guestMessages.id))
    .limit(100);
  return Response.json({ messages });
}

export async function PATCH(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  const payload = (await request.json()) as { id?: number; status?: string };
  const id = Number(payload.id);
  const status = payload.status;
  if (!Number.isInteger(id) || !new Set(["approved", "hidden", "pending"]).has(status ?? "")) {
    return Response.json({ error: "Invalid moderation update" }, { status: 400 });
  }

  const db = await getDb();
  await db.update(guestMessages).set({ status }).where(eq(guestMessages.id, id));
  return Response.json({ ok: true });
}
