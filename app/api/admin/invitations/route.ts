import { isAdminAuthorized, readSmallJson } from "@/lib/api-security";
import {
  createInvitation,
  listInvitations,
  updateInvitationStatus,
  type InvitationStatus,
} from "@/lib/wedding-store";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const invitations = await listInvitations();
    return Response.json({ invitations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin invitation list failed", error);
    return Response.json({ error: "Invitations are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const payload = await readSmallJson(request);
    const guestName = clean(payload.guestName, 100);
    const maxGuests = Math.max(1, Math.min(6, Number(payload.maxGuests) || 1));
    if (guestName.length < 2) {
      return Response.json({ error: "Add the invited guest or household name." }, { status: 400 });
    }

    const invitation = await createInvitation({ guestName, maxGuests });
    return Response.json({ ok: true, invitation }, { status: 201 });
  } catch (error) {
    console.error("Invitation creation failed", error);
    return Response.json({ error: "The invitation could not be created." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminAuthorized(request)) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const payload = await readSmallJson(request);
    const code = clean(payload.code, 20).toUpperCase();
    const status = clean(payload.status, 10);
    if (!new Set(["active", "revoked"]).has(status)) {
      return Response.json({ error: "Invalid invitation update." }, { status: 400 });
    }

    const invitation = await updateInvitationStatus(code, status as InvitationStatus);
    if (!invitation) return Response.json({ error: "Invitation not found." }, { status: 404 });
    return Response.json({ ok: true, invitation });
  } catch (error) {
    console.error("Invitation update failed", error);
    return Response.json({ error: "The invitation update did not save." }, { status: 503 });
  }
}
