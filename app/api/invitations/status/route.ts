import { NextResponse } from "next/server";
import { readSmallJson, secureCompare } from "@/lib/api-security";
import {
  createInvitationToken,
  INVITATION_COOKIE,
  INVITATION_MAX_AGE,
} from "@/lib/invitation-session";
import { getInvitationByCode, getInvitationRequest } from "@/lib/wedding-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await readSmallJson(request);
    const requestId = typeof payload.requestId === "string" ? payload.requestId : "";
    const accessToken = typeof payload.accessToken === "string" ? payload.accessToken : "";
    const invitationRequest = await getInvitationRequest(requestId);
    if (!invitationRequest || !accessToken || !secureCompare(accessToken, invitationRequest.accessToken)) {
      return NextResponse.json({ error: "Invitation request not found." }, { status: 404 });
    }

    if (invitationRequest.status !== "approved" || !invitationRequest.invitationCode) {
      return NextResponse.json({ status: invitationRequest.status });
    }

    const invitation = await getInvitationByCode(invitationRequest.invitationCode);
    if (!invitation || invitation.status !== "active") {
      return NextResponse.json({ status: "declined" });
    }

    const response = NextResponse.json({
      status: "approved",
      guestName: invitation.guestName,
      maxGuests: invitation.maxGuests,
    });
    response.cookies.set(
      INVITATION_COOKIE,
      createInvitationToken({ code: invitation.code, guestName: invitation.guestName, maxGuests: invitation.maxGuests }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: INVITATION_MAX_AGE,
      },
    );
    return response;
  } catch (error) {
    console.error("Invitation status check failed", error);
    return NextResponse.json({ error: "Invitation status is temporarily unavailable." }, { status: 503 });
  }
}
