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

export type Attendance = "yes" | "no" | "maybe";
export type MessageStatus = "approved" | "hidden" | "pending";

export type RsvpRecord = {
  id: string;
  guestName: string;
  contact: string;
  attendance: Attendance;
  guestCount: number;
  confirmationCode: string;
  createdAt: string;
};

export type GuestMessageRecord = {
  id: string;
  guestName: string;
  message: string;
  status: MessageStatus;
  createdAt: string;
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

export async function saveGuestMessage(input: Pick<GuestMessageRecord, "guestName" | "message">) {
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
