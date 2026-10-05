import {
  BlobPreconditionFailedError,
  get,
  list,
  put,
  type ListBlobResultBlob,
} from "@vercel/blob";

const ACCESS = "private" as const;
const RSVP_PREFIX = "wedding/rsvps/";
const MESSAGE_PREFIX = "wedding/messages/";
const INVITATION_PREFIX = "wedding/invitations/";
const INVITATION_REQUEST_PREFIX = "wedding/invitation-requests/";

export type Attendance = "yes" | "no" | "maybe";
export type MessageStatus = "approved" | "hidden" | "pending";
export type InvitationStatus = "active" | "revoked";
export type InvitationRequestStatus = "pending" | "approved" | "declined";

export type RsvpRecord = {
  id: string;
  guestName: string;
  contact: string;
  attendance: Attendance;
  guestCount: number;
  inviteCode: string;
  confirmationCode: string;
  createdAt: string;
};

export type GuestMessageRecord = {
  id: string;
  guestName: string;
  message: string;
  inviteCode: string;
  status: MessageStatus;
  createdAt: string;
};

export type InvitationRecord = {
  id: string;
  code: string;
  guestName: string;
  maxGuests: number;
  status: InvitationStatus;
  createdAt: string;
};

export type InvitationRequestRecord = {
  id: string;
  accessToken: string;
  guestName: string;
  email: string;
  requestedGuests: number;
  approvedGuests: number | null;
  invitationCode: string | null;
  status: InvitationRequestStatus;
  createdAt: string;
  updatedAt: string;
};

function assertConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)) {
    throw new Error("Private Vercel Blob storage is not configured.");
  }
}

function messagePath(id: string) {
  if (!/^msg_[a-f0-9-]{36}$/i.test(id)) {
    throw new Error("Invalid message id.");
  }
  return `${MESSAGE_PREFIX}${id}.json`;
}

function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function invitationPath(code: string) {
  const normalized = normalizeInviteCode(code);
  if (!/^IJ-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(normalized)) {
    throw new Error("Invalid invitation code.");
  }
  return `${INVITATION_PREFIX}${normalized}.json`;
}

function invitationRequestPath(id: string) {
  if (!/^request_[a-f0-9-]{36}$/i.test(id)) throw new Error("Invalid invitation request id.");
  return `${INVITATION_REQUEST_PREFIX}${id}.json`;
}

function randomInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `IJ-${value.slice(0, 4)}-${value.slice(4)}`;
}

async function readJson<T>(pathname: string, useCache = false): Promise<{ value: T; etag: string } | null> {
  assertConfigured();
  const result = await get(pathname, { access: ACCESS, useCache });
  if (!result || result.statusCode !== 200 || !result.stream) return null;

  const value = (await new Response(result.stream).json()) as T;
  return { value, etag: result.blob.etag };
}

async function listBlobs(prefix: string, maximum = 1000): Promise<ListBlobResultBlob[]> {
  assertConfigured();
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix, cursor, limit: Math.min(1000, maximum - blobs.length) });
    blobs.push(...page.blobs);
    cursor = page.hasMore && blobs.length < maximum ? page.cursor : undefined;
  } while (cursor && blobs.length < maximum);

  return blobs;
}

async function readRecords<T>(prefix: string, maximum = 1000): Promise<T[]> {
  const blobs = await listBlobs(prefix, maximum);
  const records = await Promise.all(
    blobs.map(async (blob) => {
      try {
        return (await readJson<T>(blob.pathname, false))?.value ?? null;
      } catch (error) {
        console.error(`Could not read wedding record ${blob.pathname}`, error);
        return null;
      }
    }),
  );
  return records.filter((record) => record !== null) as T[];
}

export async function saveRsvp(input: Omit<RsvpRecord, "id" | "confirmationCode" | "createdAt">) {
  assertConfigured();
  const confirmationCode = `IJ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const record: RsvpRecord = {
    ...input,
    id: crypto.randomUUID(),
    confirmationCode,
    createdAt: new Date().toISOString(),
  };

  await put(`${RSVP_PREFIX}${confirmationCode}.json`, JSON.stringify(record), {
    access: ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return record;
}

export async function saveGuestMessage(input: Pick<GuestMessageRecord, "guestName" | "message" | "inviteCode">) {
  assertConfigured();
  const id = `msg_${crypto.randomUUID()}`;
  const record: GuestMessageRecord = {
    ...input,
    id,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await put(messagePath(id), JSON.stringify(record), {
    access: ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return record;
}

export async function getInvitationByCode(code: string) {
  try {
    return (await readJson<InvitationRecord>(invitationPath(code), false))?.value ?? null;
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid invitation code.") return null;
    throw error;
  }
}

export async function createInvitation(input: { guestName: string; maxGuests: number }) {
  assertConfigured();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomInviteCode();
    if (await getInvitationByCode(code)) continue;

    const record: InvitationRecord = {
      id: `invite_${crypto.randomUUID()}`,
      code,
      guestName: input.guestName,
      maxGuests: Math.max(1, Math.min(6, Math.floor(input.maxGuests))),
      status: "active",
      createdAt: new Date().toISOString(),
    };
    await put(invitationPath(code), JSON.stringify(record), {
      access: ACCESS,
      contentType: "application/json",
      addRandomSuffix: false,
    });
    return record;
  }

  throw new Error("Could not generate a unique invitation code.");
}

export async function listInvitations(limit = 500) {
  const records = await readRecords<InvitationRecord>(INVITATION_PREFIX, limit);
  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function updateInvitationStatus(code: string, status: InvitationStatus) {
  const pathname = invitationPath(code);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await readJson<InvitationRecord>(pathname, false);
    if (!current) return null;

    const updated: InvitationRecord = { ...current.value, status };
    try {
      await put(pathname, JSON.stringify(updated), {
        access: ACCESS,
        contentType: "application/json",
        allowOverwrite: true,
        ifMatch: current.etag,
      });
      return updated;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) || attempt === 1) throw error;
    }
  }

  return null;
}

export async function createInvitationRequest(input: {
  guestName: string;
  email: string;
  requestedGuests: number;
}) {
  assertConfigured();
  const now = new Date().toISOString();
  const record: InvitationRequestRecord = {
    id: `request_${crypto.randomUUID()}`,
    accessToken: crypto.randomUUID(),
    guestName: input.guestName,
    email: input.email.toLowerCase(),
    requestedGuests: Math.max(1, Math.min(6, Math.floor(input.requestedGuests))),
    approvedGuests: null,
    invitationCode: null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await put(invitationRequestPath(record.id), JSON.stringify(record), {
    access: ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
  });
  return record;
}

export async function getInvitationRequest(id: string) {
  try {
    return (await readJson<InvitationRequestRecord>(invitationRequestPath(id), false))?.value ?? null;
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid invitation request id.") return null;
    throw error;
  }
}

export async function listInvitationRequests(limit = 500) {
  const records = await readRecords<InvitationRequestRecord>(INVITATION_REQUEST_PREFIX, limit);
  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function updateInvitationRequest(
  id: string,
  update: Pick<InvitationRequestRecord, "status" | "approvedGuests" | "invitationCode">,
) {
  const pathname = invitationRequestPath(id);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await readJson<InvitationRequestRecord>(pathname, false);
    if (!current) return null;
    const updated: InvitationRequestRecord = {
      ...current.value,
      ...update,
      updatedAt: new Date().toISOString(),
    };
    try {
      await put(pathname, JSON.stringify(updated), {
        access: ACCESS,
        contentType: "application/json",
        allowOverwrite: true,
        ifMatch: current.etag,
      });
      return updated;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) || attempt === 1) throw error;
    }
  }
  return null;
}

export async function listGuestMessages(options: { approvedOnly?: boolean; limit?: number } = {}) {
  const { approvedOnly = false, limit = 100 } = options;
  const records = await readRecords<GuestMessageRecord>(MESSAGE_PREFIX);
  return records
    .filter((record) => !approvedOnly || record.status === "approved")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function updateGuestMessageStatus(id: string, status: MessageStatus) {
  const pathname = messagePath(id);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await readJson<GuestMessageRecord>(pathname, false);
    if (!current) return null;

    const updated: GuestMessageRecord = { ...current.value, status };
    try {
      await put(pathname, JSON.stringify(updated), {
        access: ACCESS,
        contentType: "application/json",
        allowOverwrite: true,
        ifMatch: current.etag,
      });
      return updated;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) || attempt === 1) throw error;
    }
  }

  return null;
}
