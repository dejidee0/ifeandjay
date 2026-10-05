import { cookies } from "next/headers";
import InvitationGate from "./invitation-gate";
import WeddingExperience from "./wedding-experience";
import { INVITATION_COOKIE, resolveInvitationToken } from "@/lib/invitation-session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  let invitation = null;
  try {
    invitation = await resolveInvitationToken(cookieStore.get(INVITATION_COOKIE)?.value);
  } catch (error) {
    console.error("Invitation session unavailable", error);
  }

  if (!invitation) return <InvitationGate />;
  return <WeddingExperience invitation={invitation} />;
}
