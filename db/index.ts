import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type RuntimeBindings = {
  DB?: Parameters<typeof drizzle>[0];
  ADMIN_KEY?: string;
};

export async function getRuntimeBindings(): Promise<RuntimeBindings> {
  if (process.env.VERCEL) {
    return { ADMIN_KEY: process.env.ADMIN_KEY };
  }

  // Keeping the module name indirect lets Next.js build for Vercel while
  // Vinext/Cloudflare still resolves its native runtime bindings.
  const cloudflareModule = "cloudflare:workers";
  const runtime = (await import(cloudflareModule)) as { env: RuntimeBindings };
  return runtime.env;
}

export async function getDb() {
  const env = await getRuntimeBindings();
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
