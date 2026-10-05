import nextEnv from "@next/env";
import { del } from "@vercel/blob";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const rsvpRoute = await import("../app/api/rsvp/route");
const messagesRoute = await import("../app/api/messages/route");
const adminRoute = await import("../app/api/admin/messages/route");
const giftRoute = await import("../app/api/gift/route");

let confirmationCode = "";
let messageId = "";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function jsonRequest(url: string, method: string, body?: unknown, authorization?: string) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `127.0.0.${Math.floor(Math.random() * 200) + 1}`,
      ...(authorization ? { authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

try {
  const invalidRsvp = await rsvpRoute.POST(
    jsonRequest("http://test.local/api/rsvp", "POST", {
      guestName: "A",
      contact: "x",
      attendance: "invalid",
      guestCount: 1,
    }),
  );
  assert(invalidRsvp.status === 400, `Expected invalid RSVP 400, received ${invalidRsvp.status}.`);

  const rsvpResponse = await rsvpRoute.POST(
    jsonRequest("http://test.local/api/rsvp", "POST", {
      guestName: "Automated Backend Check",
      contact: "test@invalid.example",
      attendance: "yes",
      guestCount: 2,
    }),
  );
  const rsvp = (await rsvpResponse.json()) as { confirmationCode?: string };
  confirmationCode = rsvp.confirmationCode ?? "";
  assert(rsvpResponse.status === 201, `Expected RSVP 201, received ${rsvpResponse.status}.`);
  assert(/^IJ-[A-F0-9]{8}$/.test(confirmationCode), "RSVP confirmation code was invalid.");

  const messageResponse = await messagesRoute.POST(
    jsonRequest("http://test.local/api/messages", "POST", {
      guestName: "Automated Backend Check",
      message: "Private storage and moderation test.",
    }),
  );
  const message = (await messageResponse.json()) as { id?: string };
  messageId = message.id ?? "";
  assert(messageResponse.status === 201, `Expected message 201, received ${messageResponse.status}.`);
  assert(/^msg_[a-f0-9-]{36}$/.test(messageId), "Guest message id was invalid.");

  const unauthorized = await adminRoute.GET(
    jsonRequest("http://test.local/api/admin/messages", "GET", undefined, "Bearer incorrect-key"),
  );
  assert(unauthorized.status === 401, `Expected admin 401, received ${unauthorized.status}.`);

  const adminKey = process.env.ADMIN_KEY;
  assert(adminKey, "ADMIN_KEY is unavailable for the moderation test.");
  const authorization = `Bearer ${adminKey}`;
  const adminResponse = await adminRoute.GET(
    jsonRequest("http://test.local/api/admin/messages", "GET", undefined, authorization),
  );
  const admin = (await adminResponse.json()) as { messages?: Array<{ id: string }> };
  assert(adminResponse.status === 200, `Expected admin list 200, received ${adminResponse.status}.`);
  assert(admin.messages?.some((entry) => entry.id === messageId), "Pending message was missing from admin list.");

  const moderationResponse = await adminRoute.PATCH(
    jsonRequest(
      "http://test.local/api/admin/messages",
      "PATCH",
      { id: messageId, status: "approved" },
      authorization,
    ),
  );
  assert(moderationResponse.status === 200, `Expected moderation 200, received ${moderationResponse.status}.`);

  const publicResponse = await messagesRoute.GET();
  const publicMessages = (await publicResponse.json()) as {
    messages?: Array<{ id: string; status: string }>;
  };
  assert(publicResponse.status === 200, `Expected guestbook 200, received ${publicResponse.status}.`);
  assert(
    publicMessages.messages?.some((entry) => entry.id === messageId && entry.status === "approved"),
    "Approved message was missing from the public guestbook.",
  );

  const giftResponse = await giftRoute.GET();
  const gift = (await giftResponse.json()) as {
    accountNumber?: string;
    bank?: string;
    accountName?: string;
  };
  assert(giftResponse.status === 200, `Expected gift API 200, received ${giftResponse.status}.`);
  assert(gift.accountNumber && gift.bank && gift.accountName, "Gift API did not return every configured field.");

  console.log(
    "PASS invalid-rsvp=400 rsvp-created message-created admin-401 admin-list admin-approve public-message gift-details",
  );
} finally {
  const removals: Promise<void>[] = [];
  if (confirmationCode) removals.push(del(`wedding/rsvps/${confirmationCode}.json`));
  if (messageId) removals.push(del(`wedding/messages/${messageId}.json`));
  await Promise.all(removals);
}
