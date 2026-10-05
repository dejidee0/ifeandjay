"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Link2, MailCheck, RefreshCw, ShieldCheck, ShieldOff, X } from "lucide-react";
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

type InvitationRequest = {
  id: string;
  guestName: string;
  email: string;
  requestedGuests: number;
  approvedGuests: number | null;
  invitationCode: string | null;
  status: "pending" | "approved" | "declined";
  createdAt: string;
};

function RequestCard({
  request,
  busy,
  onReview,
}: {
  request: InvitationRequest;
  busy: boolean;
  onReview: (id: string, status: "approved" | "declined", approvedGuests: number) => Promise<void>;
}) {
  const [approvedGuests, setApprovedGuests] = useState(request.requestedGuests);
  return (
    <article className={`admin-request is-${request.status}`}>
      <div className="admin-request-main">
        <div className="admin-request-status"><span /> {request.status}</div>
        <h3>{request.guestName}</h3>
        <a href={`mailto:${request.email}`}>{request.email}</a>
        <p>Requested {request.requestedGuests} {request.requestedGuests === 1 ? "place" : "places"} · {new Date(request.createdAt).toLocaleString()}</p>
      </div>

      {request.status === "pending" ? (
        <div className="admin-request-review">
          <label htmlFor={`guests-${request.id}`}>Approve places</label>
          <Input
            id={`guests-${request.id}`}
            type="number"
            min={1}
            max={6}
            value={approvedGuests}
            onChange={(event) => setApprovedGuests(Number(event.target.value))}
          />
          <Button disabled={busy} onClick={() => onReview(request.id, "approved", approvedGuests)}>
            <MailCheck /> Approve & unlock
          </Button>
          <Button disabled={busy} variant="outline" onClick={() => onReview(request.id, "declined", approvedGuests)}>
            <X /> Decline
          </Button>
        </div>
      ) : (
        <div className="admin-request-result">
          {request.status === "approved" ? <ShieldCheck /> : <ShieldOff />}
          <strong>{request.status === "approved" ? "Site access granted" : "Request declined"}</strong>
          {request.approvedGuests ? <span>{request.approvedGuests} approved places</span> : null}
        </div>
      )}
    </article>
  );
}

export default function ModerationPage() {
  const [key, setKey] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [requests, setRequests] = useState<InvitationRequest[]>([]);
  const [status, setStatus] = useState("Enter your private ADMIN_KEY. This page is never blocked by the guest invitation screen.");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const orderedRequests = useMemo(
    () => [...requests].sort((left, right) => Number(left.status !== "pending") - Number(right.status !== "pending")),
    [requests],
  );
  const pendingCount = requests.filter((request) => request.status === "pending").length;

  function authHeaders(json = false) {
    return {
      Authorization: `Bearer ${key}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }

  async function loadConsole() {
    setLoading(true);
    try {
      const [messageResponse, invitationResponse, requestResponse, sessionResponse] = await Promise.all([
        fetch("/api/admin/messages", { headers: authHeaders() }),
        fetch("/api/admin/invitations", { headers: authHeaders() }),
        fetch("/api/admin/invitation-requests", { headers: authHeaders() }),
        fetch("/api/admin/session", { method: "POST", headers: authHeaders() }),
      ]);
      const messageData = (await messageResponse.json()) as { messages?: Message[]; error?: string };
      const invitationData = (await invitationResponse.json()) as { invitations?: Invitation[]; error?: string };
      const requestData = (await requestResponse.json()) as { requests?: InvitationRequest[]; error?: string };
      if (!messageResponse.ok || !invitationResponse.ok || !requestResponse.ok || !sessionResponse.ok) {
        setUnlocked(false);
        setStatus(requestData.error ?? messageData.error ?? invitationData.error ?? "Could not unlock the console.");
        return;
      }
      setMessages(messageData.messages ?? []);
      setInvitations(invitationData.invitations ?? []);
      setRequests(requestData.requests ?? []);
      setUnlocked(true);
      const pending = requestData.requests?.filter((request) => request.status === "pending").length ?? 0;
      setStatus(`Console unlocked · ${pending} waiting for approval · ${messageData.messages?.length ?? 0} messages.`);
    } catch {
      setStatus("The connection was interrupted. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function reviewRequest(id: string, nextStatus: "approved" | "declined", approvedGuests: number) {
    setReviewing(id);
    try {
      const response = await fetch("/api/admin/invitation-requests", {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ id, status: nextStatus, approvedGuests }),
      });
      const data = (await response.json()) as { request?: InvitationRequest; error?: string };
      if (!response.ok || !data.request) throw new Error(data.error ?? "Approval did not save.");
      setRequests((current) => current.map((request) => request.id === id ? data.request! : request));
      setStatus(nextStatus === "approved"
        ? `${data.request.guestName} is approved. Their waiting invitation will unlock automatically.`
        : `${data.request.guestName}'s request was declined.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The approval did not save.");
    } finally {
      setReviewing(null);
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
        body: JSON.stringify({ guestName: fields.get("guestName"), maxGuests: Number(fields.get("maxGuests")) }),
      });
      const data = (await response.json()) as { invitation?: Invitation; error?: string };
      if (!response.ok || !data.invitation) throw new Error(data.error ?? "Invitation creation failed.");
      setInvitations((current) => [data.invitation!, ...current]);
      form.reset();
      setStatus(`Manual invitation created for ${data.invitation.guestName}.`);
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
      setInvitations((current) => current.map((invitation) => invitation.code === code ? { ...invitation, status: nextStatus } : invitation));
      setStatus(`${code} marked ${nextStatus}.`);
    } catch {
      setStatus("The invitation update did not save.");
    }
  }

  async function copyInvite(invitation: Invitation) {
    const url = `${window.location.origin}/invite/${invitation.code}`;
    await navigator.clipboard.writeText(`You are personally invited to Ifedayo & Joyce's traditional wedding.\n\nOpen your private invitation: ${url}`);
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
      setMessages((current) => current.map((message) => message.id === id ? { ...message, status: nextStatus } : message));
      setStatus(`Message marked ${nextStatus}.`);
    } catch {
      setStatus("The moderation update did not save.");
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div><p className="eyebrow">COUPLE-ONLY CONTROL ROOM</p><h1>Wedding administration</h1></div>
        <Link href="/">View wedding site</Link>
      </header>

      <section className="admin-login" aria-label="Admin access">
        <div><p className="mono-note">ADMIN ACCESS</p><h2>{unlocked ? "Console unlocked" : "Welcome, Ifedayo & Joyce"}</h2></div>
        <label htmlFor="admin-key">Private admin key</label>
        <div className="admin-key-row">
          <Input id="admin-key" type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Paste your ADMIN_KEY" autoComplete="current-password" onKeyDown={(event) => { if (event.key === "Enter") void loadConsole(); }} />
          <Button onClick={loadConsole} disabled={!key || loading}>{loading ? "Opening..." : unlocked ? "Refresh" : "Open console"}</Button>
        </div>
        <p aria-live="polite">{status}</p>
      </section>

      {unlocked && (
        <>
          <section className="admin-site-access">
            <div><ShieldCheck /><div><p className="mono-note">ADMIN SESSION ACTIVE</p><h2>You can now view the complete wedding website.</h2><p>Your secure admin access remains active in this browser for seven days.</p></div></div>
            <Button asChild><Link href="/">Open full wedding site</Link></Button>
          </section>
          <section className="admin-request-list" aria-label="Invitation requests">
            <div className="admin-section-title admin-title-row">
              <div><p className="mono-note">EMAIL APPROVAL QUEUE</p><h2>{pendingCount ? `${pendingCount} waiting for you` : "No requests waiting"}</h2><p>Guests remain on their private waiting card until you approve them here.</p></div>
              <Button variant="outline" onClick={loadConsole} disabled={loading}><RefreshCw /> Refresh</Button>
            </div>
            {orderedRequests.length ? orderedRequests.map((request) => (
              <RequestCard key={request.id} request={request} busy={reviewing === request.id} onReview={reviewRequest} />
            )) : <div className="admin-empty"><MailCheck /><p>New email requests will appear here.</p></div>}
          </section>

          <details className="admin-manual-tools">
            <summary>Manual guest links <span>Optional backup access</span></summary>
            <section className="admin-invitation-tools" aria-label="Create manual invitation">
              <div><p className="mono-note">MANUAL PRIVATE PASS</p><h2>Create a direct link</h2><p>Use this only when you want to invite someone directly without the email approval queue.</p></div>
              <form onSubmit={createInvite}>
                <label htmlFor="invite-name">Guest or household name</label>
                <Input id="invite-name" name="guestName" required minLength={2} placeholder="Mr & Mrs Example" />
                <label htmlFor="invite-capacity">Maximum guests</label>
                <Input id="invite-capacity" name="maxGuests" type="number" min={1} max={6} defaultValue={1} required />
                <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create direct invitation"}</Button>
              </form>
            </section>
          </details>

          <section className="admin-invite-list" aria-label="Private invitations">
            <div className="admin-section-title"><p className="mono-note">ACTIVE ACCESS</p><h2>{invitations.length} private invitations</h2></div>
            {invitations.length ? invitations.map((invitation) => (
              <article key={invitation.id} className={`admin-invite ${invitation.status === "revoked" ? "is-revoked" : ""}`}>
                <div><p className="mono-note">{invitation.code} · {invitation.status}</p><h3>{invitation.guestName}</h3><p>Admit {invitation.maxGuests}</p></div>
                <div className="admin-actions">
                  <Button size="sm" onClick={() => copyInvite(invitation)} disabled={invitation.status === "revoked"}><Copy /> Copy link</Button>
                  {invitation.status === "active"
                    ? <Button size="sm" variant="outline" onClick={() => updateInvite(invitation.code, "revoked")}><ShieldOff /> Revoke</Button>
                    : <Button size="sm" variant="outline" onClick={() => updateInvite(invitation.code, "active")}><Check /> Reactivate</Button>}
                </div>
              </article>
            )) : <div className="admin-empty"><Link2 /><p>No approved invitations yet.</p></div>}
          </section>

          <section className="admin-list" aria-label="Guest messages">
            <div className="admin-section-title"><p className="mono-note">MESSAGE MODERATION</p><h2>{messages.length} guest messages</h2></div>
            {messages.map((message) => (
              <article key={message.id} className="admin-message">
                <div><p className="mono-note">#{message.id} · {message.status}</p><h2>{message.guestName}</h2><p>{message.message}</p></div>
                <div className="admin-actions"><Button size="sm" onClick={() => moderate(message.id, "approved")}>Approve</Button><Button size="sm" variant="outline" onClick={() => moderate(message.id, "hidden")}>Hide</Button></div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
