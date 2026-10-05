import { NextResponse } from "next/server";
import { isRateLimited, readSmallJson } from "@/lib/api-security";
import {
  createInvitationToken,
  INVITATION_COOKIE,
  INVITATION_MAX_AGE,
} from "@/lib/invitation-session";
import { getInvitationByCode } from "@/lib/wedding-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (isRateLimited(request, "invitation-access", 12, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many attempts. Please wait before trying again." }, { status: 429 });
    }

    const payload = await readSmallJson(request);
    const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
    const invitation = await getInvitationByCode(code);
    if (!invitation || invitation.status !== "active") {
      return NextResponse.json({ error: "This invitation code is not active. Please contact the family." }, { status: 401 });
    }

    const token = createInvitationToken({
      code: invitation.code,
      guestName: invitation.guestName,
      maxGuests: invitation.maxGuests,
    });
    const response = NextResponse.json({
      ok: true,
      guestName: invitation.guestName,
      maxGuests: invitation.maxGuests,
    });
    response.cookies.set(INVITATION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: INVITATION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("Invitation verification failed", error);
    return NextResponse.json({ error: "Invitation access is temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(INVITATION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
