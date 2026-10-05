import { isAdminAuthorized, readSmallJson } from "@/lib/api-security";
import {
  createInvitation,
  getInvitationRequest,
  listInvitationRequests,
  updateInvitationRequest,
} from "@/lib/wedding-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) return Response.json({ error: "Not authorized" }, { status: 401 });
  try {
    const requests = await listInvitationRequests();
    return Response.json({ requests }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Invitation request list failed", error);
    return Response.json({ error: "Invitation requests are temporarily unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminAuthorized(request)) return Response.json({ error: "Not authorized" }, { status: 401 });
  try {
    const payload = await readSmallJson(request);
    const id = typeof payload.id === "string" ? payload.id : "";
    const status = payload.status === "approved" ? "approved" : payload.status === "declined" ? "declined" : "";
    const current = await getInvitationRequest(id);
    if (!current) return Response.json({ error: "Invitation request not found." }, { status: 404 });
    if (!status) return Response.json({ error: "Invalid approval update." }, { status: 400 });

    if (status === "declined") {
      const updated = await updateInvitationRequest(id, { status, approvedGuests: null, invitationCode: null });
      return Response.json({ ok: true, request: updated });
    }

    if (current.status === "approved" && current.invitationCode) {
      return Response.json({ ok: true, request: current });
    }

    const approvedGuests = Math.max(1, Math.min(6, Number(payload.approvedGuests) || current.requestedGuests));
    const invitation = await createInvitation({ guestName: current.guestName, maxGuests: approvedGuests });
    const updated = await updateInvitationRequest(id, {
      status: "approved",
      approvedGuests,
      invitationCode: invitation.code,
    });
    return Response.json({ ok: true, request: updated });
  } catch (error) {
    console.error("Invitation approval failed", error);
    return Response.json({ error: "The invitation approval did not save." }, { status: 503 });
  }
}
