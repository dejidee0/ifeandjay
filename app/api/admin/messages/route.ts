import { readSmallJson, secureCompare } from "@/lib/api-security";
import {
  listGuestMessages,
  updateGuestMessageStatus,
  type MessageStatus,
} from "@/lib/wedding-store";

export const dynamic = "force-dynamic";

async function authorized(request: Request) {
  const adminKey = process.env.ADMIN_KEY?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(adminKey && supplied && secureCompare(supplied, adminKey));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const messages = await listGuestMessages({ limit: 100 });
    return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin message list failed", error);
    return Response.json({ error: "Messages are temporarily unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const payload = await readSmallJson(request);
    const id = typeof payload.id === "string" ? payload.id : "";
    const status = typeof payload.status === "string" ? payload.status : "";
    if (!/^msg_[a-f0-9-]{36}$/i.test(id) || !new Set(["approved", "hidden", "pending"]).has(status)) {
      return Response.json({ error: "Invalid moderation update" }, { status: 400 });
    }

    const updated = await updateGuestMessageStatus(id, status as MessageStatus);
    if (!updated) return Response.json({ error: "Message not found" }, { status: 404 });
    return Response.json({ ok: true, message: updated });
  } catch (error) {
    console.error("Admin moderation update failed", error);
    return Response.json({ error: "The moderation update did not save." }, { status: 503 });
  }
}
