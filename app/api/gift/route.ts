import { invitationFromRequest } from "@/lib/invitation-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const invitation = await invitationFromRequest(request);
  if (!invitation) {
    return Response.json(
      { error: "A valid private invitation is required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const accountNumber = process.env.GIFT_ACCOUNT_NUMBER?.trim();
  const bank = process.env.GIFT_BANK?.trim();
  const accountName = process.env.GIFT_ACCOUNT_NAME?.trim();

  if (!accountNumber || !bank || !accountName) {
    return Response.json(
      { error: "Gift details are not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { accountNumber, bank, accountName },
    { headers: { "Cache-Control": "no-store" } },
  );
}
