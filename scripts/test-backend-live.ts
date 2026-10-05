import nextEnv from "@next/env";
import { del } from "@vercel/blob";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const rsvpRoute = await import("../app/api/rsvp/route");
const messagesRoute = await import("../app/api/messages/route");
const adminMessagesRoute = await import("../app/api/admin/messages/route");
const adminInvitationsRoute = await import("../app/api/admin/invitations/route");
const invitationRequestRoute = await import("../app/api/invitations/request/route");
const invitationStatusRoute = await import("../app/api/invitations/status/route");
const adminRequestsRoute = await import("../app/api/admin/invitation-requests/route");
const giftRoute = await import("../app/api/gift/route");

let requestId = "";
let accessToken = "";
let invitationCode = "";
let confirmationCode = "";
let messageId = "";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function jsonRequest(url: string, method: string, body?: unknown, authorization?: string, cookie?: string) {
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
  const lockedRsvp = await rsvpRoute.POST(jsonRequest("http://test.local/api/rsvp", "POST", {
    contact: "test@invalid.example", attendance: "yes", guestCount: 1,
  }));
  assert(lockedRsvp.status === 401, `Expected locked RSVP 401, received ${lockedRsvp.status}.`);

  const adminKey = process.env.ADMIN_KEY;
  assert(adminKey, "ADMIN_KEY is unavailable for the backend test.");
  const authorization = `Bearer ${adminKey}`;

  const requestResponse = await invitationRequestRoute.POST(
    jsonRequest("http://test.local/api/invitations/request", "POST", {
      guestName: "Automated Approval Check",
      email: `approval-${Date.now()}@invalid.example`,
      requestedGuests: 2,
    }),
  );
  const submitted = (await requestResponse.json()) as { requestId?: string; accessToken?: string; status?: string };
  requestId = submitted.requestId ?? "";
  accessToken = submitted.accessToken ?? "";
  assert(requestResponse.status === 201, `Expected request 201, received ${requestResponse.status}.`);
  assert(requestId.startsWith("request_") && accessToken.length > 20, "Invitation request credentials were invalid.");

  const pendingResponse = await invitationStatusRoute.POST(
    jsonRequest("http://test.local/api/invitations/status", "POST", { requestId, accessToken }),
  );
  const pending = (await pendingResponse.json()) as { status?: string };
  assert(pendingResponse.status === 200 && pending.status === "pending", "Guest request did not enter the pending state.");
  assert(!pendingResponse.headers.get("set-cookie"), "Pending request must not receive an invitation session.");

  const unauthorized = await adminRequestsRoute.GET(
    jsonRequest("http://test.local/api/admin/invitation-requests", "GET", undefined, "Bearer incorrect-key"),
  );
  assert(unauthorized.status === 401, `Expected admin 401, received ${unauthorized.status}.`);

  const requestListResponse = await adminRequestsRoute.GET(
    jsonRequest("http://test.local/api/admin/invitation-requests", "GET", undefined, authorization),
  );
  const requestList = (await requestListResponse.json()) as { requests?: Array<{ id: string }> };
  assert(requestList.requests?.some((entry) => entry.id === requestId), "Pending request was missing from the admin queue.");

  const approvalResponse = await adminRequestsRoute.PATCH(
    jsonRequest("http://test.local/api/admin/invitation-requests", "PATCH", {
      id: requestId, status: "approved", approvedGuests: 2,
    }, authorization),
  );
  const approval = (await approvalResponse.json()) as { request?: { invitationCode: string; status: string } };
  invitationCode = approval.request?.invitationCode ?? "";
  assert(approvalResponse.status === 200 && approval.request?.status === "approved", "Admin approval failed.");
  assert(/^IJ-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(invitationCode), "Approval did not create a valid invitation.");

  const approvedResponse = await invitationStatusRoute.POST(
    jsonRequest("http://test.local/api/invitations/status", "POST", { requestId, accessToken }),
  );
  assert(approvedResponse.status === 200, `Expected approved status 200, received ${approvedResponse.status}.`);
  const approved = (await approvedResponse.json()) as { status?: string; maxGuests?: number };
  assert(approved.status === "approved" && approved.maxGuests === 2, "Guest request did not unlock after approval.");
  const cookie = approvedResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert(cookie.startsWith("ij_private_invitation="), "Approved guest session cookie was not issued.");

  const invalidRsvp = await rsvpRoute.POST(jsonRequest(
    "http://test.local/api/rsvp", "POST", { contact: "x", attendance: "invalid", guestCount: 1 }, undefined, cookie,
  ));
  assert(invalidRsvp.status === 400, `Expected invalid RSVP 400, received ${invalidRsvp.status}.`);

  const rsvpResponse = await rsvpRoute.POST(jsonRequest(
    "http://test.local/api/rsvp", "POST", { contact: "test@invalid.example", attendance: "yes", guestCount: 2 }, undefined, cookie,
  ));
  const rsvp = (await rsvpResponse.json()) as { confirmationCode?: string };
  confirmationCode = rsvp.confirmationCode ?? "";
  assert(rsvpResponse.status === 201, `Expected RSVP 201, received ${rsvpResponse.status}.`);
  assert(/^IJ-[A-F0-9]{8}$/.test(confirmationCode), "RSVP confirmation code was invalid.");

  const messageResponse = await messagesRoute.POST(jsonRequest(
    "http://test.local/api/messages", "POST", { message: "Email approval and moderation test." }, undefined, cookie,
  ));
  const message = (await messageResponse.json()) as { id?: string };
  messageId = message.id ?? "";
  assert(messageResponse.status === 201, `Expected message 201, received ${messageResponse.status}.`);

  const adminResponse = await adminMessagesRoute.GET(
    jsonRequest("http://test.local/api/admin/messages", "GET", undefined, authorization),
  );
  const admin = (await adminResponse.json()) as { messages?: Array<{ id: string }> };
  assert(admin.messages?.some((entry) => entry.id === messageId), "Pending message was missing from admin list.");

  const moderationResponse = await adminMessagesRoute.PATCH(jsonRequest(
    "http://test.local/api/admin/messages", "PATCH", { id: messageId, status: "approved" }, authorization,
  ));
  assert(moderationResponse.status === 200, `Expected moderation 200, received ${moderationResponse.status}.`);

  const publicResponse = await messagesRoute.GET(
    jsonRequest("http://test.local/api/messages", "GET", undefined, undefined, cookie),
  );
  const publicMessages = (await publicResponse.json()) as { messages?: Array<{ id: string; status: string }> };
  assert(publicMessages.messages?.some((entry) => entry.id === messageId && entry.status === "approved"), "Approved message was missing from the private guestbook.");

  const giftResponse = await giftRoute.GET(
    jsonRequest("http://test.local/api/gift", "GET", undefined, undefined, cookie),
  );
  const gift = (await giftResponse.json()) as { accountNumber?: string; bank?: string; accountName?: string };
  assert(gift.accountNumber && gift.bank && gift.accountName, "Gift API did not return every configured field.");

  const revokeResponse = await adminInvitationsRoute.PATCH(jsonRequest(
    "http://test.local/api/admin/invitations", "PATCH", { code: invitationCode, status: "revoked" }, authorization,
  ));
  assert(revokeResponse.status === 200, `Expected invitation revoke 200, received ${revokeResponse.status}.`);
  const revokedAccess = await giftRoute.GET(
    jsonRequest("http://test.local/api/gift", "GET", undefined, undefined, cookie),
  );
  assert(revokedAccess.status === 401, `Expected revoked session 401, received ${revokedAccess.status}.`);

  console.log("PASS locked=401 email-request pending admin-queue approval auto-unlock session-cookie rsvp message moderation gift revoke=401");
} finally {
  const removals: Promise<void>[] = [];
  if (requestId) removals.push(del(`wedding/invitation-requests/${requestId}.json`));
  if (invitationCode) removals.push(del(`wedding/invitations/${invitationCode}.json`));
  if (confirmationCode) removals.push(del(`wedding/rsvps/${confirmationCode}.json`));
  if (messageId) removals.push(del(`wedding/messages/${messageId}.json`));
  await Promise.all(removals);
}
