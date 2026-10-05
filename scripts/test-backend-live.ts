import nextEnv from "@next/env";
import { del } from "@vercel/blob";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const rsvpRoute = await import("../app/api/rsvp/route");
const messagesRoute = await import("../app/api/messages/route");
const adminMessagesRoute = await import("../app/api/admin/messages/route");
const adminInvitationsRoute = await import("../app/api/admin/invitations/route");
const invitationVerifyRoute = await import("../app/api/invitations/verify/route");
const giftRoute = await import("../app/api/gift/route");

let invitationCode = "";
let confirmationCode = "";
let messageId = "";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  authorization?: string,
  cookie?: string,
) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `127.0.0.${Math.floor(Math.random() * 200) + 1}`,
      ...(authorization ? { authorization } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

try {
  const lockedRsvp = await rsvpRoute.POST(
    jsonRequest("http://test.local/api/rsvp", "POST", {
      contact: "test@invalid.example",
      attendance: "yes",
      guestCount: 1,
    }),
  );
  assert(lockedRsvp.status === 401, `Expected locked RSVP 401, received ${lockedRsvp.status}.`);

  const adminKey = process.env.ADMIN_KEY;
  assert(adminKey, "ADMIN_KEY is unavailable for the backend test.");
  const authorization = `Bearer ${adminKey}`;

  const createInvitationResponse = await adminInvitationsRoute.POST(
    jsonRequest(
      "http://test.local/api/admin/invitations",
      "POST",
      { guestName: "Automated Invitation Check", maxGuests: 2 },
      authorization,
    ),
  );
  const created = (await createInvitationResponse.json()) as {
    invitation?: { code: string; guestName: string; maxGuests: number };
  };
  invitationCode = created.invitation?.code ?? "";
  assert(createInvitationResponse.status === 201, `Expected invitation 201, received ${createInvitationResponse.status}.`);
  assert(/^IJ-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(invitationCode), "Invitation code was invalid.");

  const invalidInvitation = await invitationVerifyRoute.POST(
    jsonRequest("http://test.local/api/invitations/verify", "POST", { code: "IJ-NOT-A-CODE" }),
  );
  assert(invalidInvitation.status === 401, `Expected invalid invitation 401, received ${invalidInvitation.status}.`);

  const verifyResponse = await invitationVerifyRoute.POST(
    jsonRequest("http://test.local/api/invitations/verify", "POST", { code: invitationCode }),
  );
  assert(verifyResponse.status === 200, `Expected invitation verification 200, received ${verifyResponse.status}.`);
  const cookie = verifyResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert(cookie.startsWith("ij_private_invitation="), "Invitation session cookie was not issued.");

  const invalidRsvp = await rsvpRoute.POST(
    jsonRequest(
      "http://test.local/api/rsvp",
      "POST",
      { contact: "x", attendance: "invalid", guestCount: 1 },
      undefined,
      cookie,
    ),
  );
  assert(invalidRsvp.status === 400, `Expected invalid RSVP 400, received ${invalidRsvp.status}.`);

  const rsvpResponse = await rsvpRoute.POST(
    jsonRequest(
      "http://test.local/api/rsvp",
      "POST",
      { contact: "test@invalid.example", attendance: "yes", guestCount: 2 },
      undefined,
      cookie,
    ),
  );
  const rsvp = (await rsvpResponse.json()) as { confirmationCode?: string };
  confirmationCode = rsvp.confirmationCode ?? "";
  assert(rsvpResponse.status === 201, `Expected RSVP 201, received ${rsvpResponse.status}.`);
  assert(/^IJ-[A-F0-9]{8}$/.test(confirmationCode), "RSVP confirmation code was invalid.");

  const messageResponse = await messagesRoute.POST(
    jsonRequest(
      "http://test.local/api/messages",
      "POST",
      { message: "Private invitation and moderation test." },
      undefined,
      cookie,
    ),
  );
  const message = (await messageResponse.json()) as { id?: string };
  messageId = message.id ?? "";
  assert(messageResponse.status === 201, `Expected message 201, received ${messageResponse.status}.`);

  const unauthorized = await adminMessagesRoute.GET(
    jsonRequest("http://test.local/api/admin/messages", "GET", undefined, "Bearer incorrect-key"),
  );
  assert(unauthorized.status === 401, `Expected admin 401, received ${unauthorized.status}.`);

  const invitationListResponse = await adminInvitationsRoute.GET(
    jsonRequest("http://test.local/api/admin/invitations", "GET", undefined, authorization),
  );
  const invitationList = (await invitationListResponse.json()) as { invitations?: Array<{ code: string }> };
  assert(invitationList.invitations?.some((entry) => entry.code === invitationCode), "Created invitation was missing from admin list.");

  const adminResponse = await adminMessagesRoute.GET(
    jsonRequest("http://test.local/api/admin/messages", "GET", undefined, authorization),
  );
  const admin = (await adminResponse.json()) as { messages?: Array<{ id: string }> };
  assert(admin.messages?.some((entry) => entry.id === messageId), "Pending message was missing from admin list.");

  const moderationResponse = await adminMessagesRoute.PATCH(
    jsonRequest(
      "http://test.local/api/admin/messages",
      "PATCH",
      { id: messageId, status: "approved" },
      authorization,
    ),
  );
  assert(moderationResponse.status === 200, `Expected moderation 200, received ${moderationResponse.status}.`);

  const publicResponse = await messagesRoute.GET(
    jsonRequest("http://test.local/api/messages", "GET", undefined, undefined, cookie),
  );
  const publicMessages = (await publicResponse.json()) as { messages?: Array<{ id: string; status: string }> };
  assert(
    publicMessages.messages?.some((entry) => entry.id === messageId && entry.status === "approved"),
    "Approved message was missing from the private guestbook.",
  );

  const giftResponse = await giftRoute.GET(
    jsonRequest("http://test.local/api/gift", "GET", undefined, undefined, cookie),
  );
  const gift = (await giftResponse.json()) as { accountNumber?: string; bank?: string; accountName?: string };
  assert(gift.accountNumber && gift.bank && gift.accountName, "Gift API did not return every configured field.");

  const revokeResponse = await adminInvitationsRoute.PATCH(
    jsonRequest(
      "http://test.local/api/admin/invitations",
      "PATCH",
      { code: invitationCode, status: "revoked" },
      authorization,
    ),
  );
  assert(revokeResponse.status === 200, `Expected invitation revoke 200, received ${revokeResponse.status}.`);
  const revokedAccess = await giftRoute.GET(
    jsonRequest("http://test.local/api/gift", "GET", undefined, undefined, cookie),
  );
  assert(revokedAccess.status === 401, `Expected revoked session 401, received ${revokedAccess.status}.`);

  console.log(
    "PASS locked=401 invite-create invite-verify session-cookie rsvp message admin-list approve private-read gift revoke=401",
  );
} finally {
  const removals: Promise<void>[] = [];
  if (invitationCode) removals.push(del(`wedding/invitations/${invitationCode}.json`));
  if (confirmationCode) removals.push(del(`wedding/rsvps/${confirmationCode}.json`));
  if (messageId) removals.push(del(`wedding/messages/${messageId}.json`));
  await Promise.all(removals);
}
