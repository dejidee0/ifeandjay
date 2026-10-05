import { NextResponse } from "next/server";
import {
  createInvitationToken,
  INVITATION_COOKIE,
  INVITATION_MAX_AGE,
} from "@/lib/invitation-session";
import { getInvitationByCode } from "@/lib/wedding-store";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invitation = await getInvitationByCode(code);
  if (!invitation || invitation.status !== "active") {
    return NextResponse.redirect(new URL("/?invitation=invalid", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(
    INVITATION_COOKIE,
    createInvitationToken({
      code: invitation.code,
      guestName: invitation.guestName,
      maxGuests: invitation.maxGuests,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: INVITATION_MAX_AGE,
    },
  );
  return response;
}
