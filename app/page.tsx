import { cookies } from "next/headers";
import InvitationGate from "./invitation-gate";
import WeddingExperience from "./wedding-experience";
import { INVITATION_COOKIE, resolveInvitationToken } from "@/lib/invitation-session";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const isAdmin = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  let invitation = null;
  try {
    invitation = await resolveInvitationToken(cookieStore.get(INVITATION_COOKIE)?.value);
  } catch (error) {
    console.error("Invitation session unavailable", error);
  }

  if (isAdmin) {
    return <WeddingExperience invitation={{ code: "ADMIN", guestName: "Ifedayo & Joyce · Admin", maxGuests: 6 }} />;
  }
  if (!invitation) return <InvitationGate />;
  return <WeddingExperience invitation={invitation} />;
}
