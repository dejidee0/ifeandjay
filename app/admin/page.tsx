"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Check, Copy, Link2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  guestName: string;
  message: string;
  status: string;
  createdAt: string;
};

type Invitation = {
  id: string;
  code: string;
  guestName: string;
  maxGuests: number;
  status: "active" | "revoked";
  createdAt: string;
};

export default function ModerationPage() {
  const [key, setKey] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [status, setStatus] = useState("Enter the server-side admin key to manage private invitations.");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const unlocked = invitations.length > 0 || status.includes("console unlocked");

  function authHeaders(json = false) {
    return {
      Authorization: `Bearer ${key}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }

  async function loadConsole() {
    setLoading(true);
    try {
      const [messageResponse, invitationResponse] = await Promise.all([
        fetch("/api/admin/messages", { headers: authHeaders() }),
        fetch("/api/admin/invitations", { headers: authHeaders() }),
      ]);
      const messageData = (await messageResponse.json()) as { messages?: Message[]; error?: string };
      const invitationData = (await invitationResponse.json()) as { invitations?: Invitation[]; error?: string };
      if (!messageResponse.ok || !invitationResponse.ok) {
        setStatus(messageData.error ?? invitationData.error ?? "Could not unlock the console.");
        return;
      }
      setMessages(messageData.messages ?? []);
      setInvitations(invitationData.invitations ?? []);
      setStatus(`Private console unlocked · ${invitationData.invitations?.length ?? 0} invitations · ${messageData.messages?.length ?? 0} messages.`);
    } catch {
      setStatus("The connection was interrupted. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          guestName: fields.get("guestName"),
          maxGuests: Number(fields.get("maxGuests")),
        }),
      });
      const data = (await response.json()) as { invitation?: Invitation; error?: string };
      if (!response.ok || !data.invitation) throw new Error(data.error ?? "Invitation creation failed.");
      setInvitations((current) => [data.invitation!, ...current]);
      form.reset();
      setStatus(`Invitation created for ${data.invitation.guestName}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The invitation could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function updateInvite(code: string, nextStatus: "active" | "revoked") {
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ code, status: nextStatus }),
      });
      if (!response.ok) throw new Error("Invitation update failed.");
      setInvitations((current) =>
        current.map((invitation) => invitation.code === code ? { ...invitation, status: nextStatus } : invitation),
      );
      setStatus(`${code} marked ${nextStatus}.`);
    } catch {
      setStatus("The invitation update did not save.");
    }
  }

  async function copyInvite(invitation: Invitation) {
    const url = `${window.location.origin}/invite/${invitation.code}`;
    await navigator.clipboard.writeText(`You are personally invited to Ifedayo & Joyce's traditional wedding.\n\nOpen your private invitation: ${url}\nAccess code: ${invitation.code}`);
    setStatus(`Private link copied for ${invitation.guestName}.`);
  }

  async function moderate(id: string, nextStatus: string) {
    try {
      const response = await fetch("/api/admin/messages", {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (!response.ok) throw new Error("Moderation failed");
      setMessages((current) =>
        current.map((message) => message.id === id ? { ...message, status: nextStatus } : message),
      );
      setStatus(`Message marked ${nextStatus}.`);
    } catch {
      setStatus("The moderation update did not save.");
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">PRIVATE CONSOLE / GUEST ACCESS</p>
          <h1>Invitation manager</h1>
        </div>
        <Link href="/">Return to invitation</Link>
      </header>

      <section className="admin-login" aria-label="Admin access">
        <label htmlFor="admin-key">Admin key</label>
        <div className="admin-key-row">
          <Input id="admin-key" type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Server-side ADMIN_KEY" autoComplete="off" />
          <Button onClick={loadConsole} disabled={!key || loading}>{loading ? "Loading…" : "Unlock"}</Button>
        </div>
        <p aria-live="polite">{status}</p>
      </section>

      {unlocked && (
        <>
          <section className="admin-invitation-tools" aria-label="Create invitation">
            <div>
              <p className="mono-note">NEW PRIVATE GUEST PASS</p>
              <h2>Create a personal invitation</h2>
              <p>Each guest receives a unique code and a one-click private link. Set the exact number their invitation admits.</p>
            </div>
            <form onSubmit={createInvite}>
              <label htmlFor="invite-name">Guest or household name</label>
              <Input id="invite-name" name="guestName" required minLength={2} placeholder="Mr & Mrs Example" />
              <label htmlFor="invite-capacity">Maximum guests</label>
              <Input id="invite-capacity" name="maxGuests" type="number" min={1} max={6} defaultValue={1} required />
              <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create private invitation"}</Button>
            </form>
          </section>

          <section className="admin-invite-list" aria-label="Private invitations">
            <div className="admin-section-title"><p className="mono-note">INVITED HOUSEHOLDS</p><h2>{invitations.length} private invitations</h2></div>
            {invitations.length ? invitations.map((invitation) => (
              <article key={invitation.id} className={`admin-invite ${invitation.status === "revoked" ? "is-revoked" : ""}`}>
                <div>
                  <p className="mono-note">{invitation.code} · {invitation.status}</p>
                  <h3>{invitation.guestName}</h3>
                  <p>Admit {invitation.maxGuests}</p>
                </div>
                <div className="admin-actions">
                  <Button size="sm" onClick={() => copyInvite(invitation)} disabled={invitation.status === "revoked"}><Copy /> Copy link</Button>
                  {invitation.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => updateInvite(invitation.code, "revoked")}><ShieldOff /> Revoke</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => updateInvite(invitation.code, "active")}><Check /> Reactivate</Button>
                  )}
                </div>
              </article>
            )) : <div className="admin-empty"><Link2 /><p>No invitations yet. Create the first private guest pass above.</p></div>}
          </section>

          <section className="admin-list" aria-label="Guest messages">
            <div className="admin-section-title"><p className="mono-note">MESSAGE MODERATION</p><h2>{messages.length} guest messages</h2></div>
            {messages.map((message) => (
              <article key={message.id} className="admin-message">
                <div>
                  <p className="mono-note">#{message.id} · {message.status}</p>
                  <h2>{message.guestName}</h2>
                  <p>{message.message}</p>
                </div>
                <div className="admin-actions">
                  <Button size="sm" onClick={() => moderate(message.id, "approved")}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => moderate(message.id, "hidden")}>Hide</Button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
