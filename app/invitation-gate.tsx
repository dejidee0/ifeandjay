"use client";

import Link from "next/link";
import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SavedRequest = { requestId: string; accessToken: string; email: string };
type GateMode = "idle" | "sending" | "waiting" | "opening" | "error" | "declined";

const STORAGE_KEY = "ij_invitation_request";

const criticalStyles = `
.invitation-gate{position:relative;min-height:100svh;display:grid;place-items:center;align-content:center;gap:22px;overflow:hidden;padding:40px 16px;color:#f2e7d7;background:radial-gradient(circle at 50% 38%,#27201d 0,#111010 46%,#080808 100%);font-family:"Segoe UI",sans-serif}.gate-grid{position:absolute;inset:0;opacity:.08;background-image:linear-gradient(#ffffff29 1px,transparent 1px),linear-gradient(90deg,#ffffff29 1px,transparent 1px);background-size:72px 72px;mask-image:radial-gradient(circle,#000 15%,transparent 72%)}.gate-heading,.gate-footer,.invitation-stage{position:relative;z-index:1}.gate-heading{text-align:center;text-transform:uppercase;letter-spacing:.14em}.gate-heading p{margin:0 0 5px;color:#c09158;font:11px monospace}.gate-heading span{color:#f2e7d777;font:10px monospace}.invitation-stage{width:min(760px,96vw);perspective:1600px;padding:12px}.private-invitation-card{--invite-rotate-x:0deg;--invite-rotate-y:0deg;position:relative;min-height:540px;display:grid;grid-template-columns:.7fr 1.3fr;grid-template-rows:auto 1fr auto;gap:28px;padding:clamp(32px,5vw,64px);overflow:hidden;color:#261a17;background:linear-gradient(135deg,#f5ead8,#ddc9ae 48%,#f6ead6);border:1px solid #ffffff70;box-shadow:0 50px 90px #0009,0 5px 20px #0006,inset 0 0 60px #784f2c1f;transform-style:preserve-3d;transform:rotateX(var(--invite-rotate-x)) rotateY(var(--invite-rotate-y));transition:transform .28s ease,opacity .8s ease,filter .8s ease}.private-invitation-card:before{content:"";position:absolute;inset:16px;border:1px solid #74243d52}.private-invitation-card.is-opening{transform:rotateY(16deg) rotateX(-4deg) translateZ(160px) scale(1.08);opacity:0;filter:blur(8px)}.invite-monogram{grid-row:1/-1;align-self:center;justify-self:center;width:150px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;gap:4px;border-radius:50%;border:1px solid #74243d52;color:#4a1526;font:40px Georgia,serif;box-shadow:0 18px 28px #3c1f1438,inset 0 0 0 8px #c091582e,inset 0 0 0 10px #74243d29;transform:translateZ(44px)}.invite-monogram i{color:#9c6b36}.invite-gate-copy,.invite-request-form,.invite-waiting-panel{position:relative;transform:translateZ(28px)}.invite-private-label{display:flex;align-items:center;gap:8px;margin:0 0 14px;color:#74243d;font:10px monospace;letter-spacing:.14em}.invite-private-label svg{width:14px}.invite-gate-copy h1{margin:0;font:400 clamp(44px,7vw,78px)/.88 Georgia,serif;letter-spacing:-.055em}.invite-gate-copy h1 em{color:#74243d;font-weight:400}.invite-gate-copy>p:last-child{margin:18px 0 0;color:#261a17b3;font-size:14px}.invite-request-form{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}.invite-request-form .invite-field:first-child{grid-column:1/-1}.invite-field{display:grid;gap:5px}.invite-field label{color:#4a1526;font:10px monospace;letter-spacing:.1em;text-transform:uppercase}.invite-field input{width:100%;min-height:46px;padding:0 13px;border:1px solid #4a152659;background:#ffffff70;color:#251616;border-radius:0}.invite-request-form button{grid-column:1/-1;min-height:48px;border:0;background:#74243d;color:#fff8ee;text-transform:uppercase;letter-spacing:.1em;font:11px monospace;cursor:pointer}.invite-access-note,.invite-access-error{grid-column:1/-1;margin:2px 0 0;color:#261a1799;font:10px/1.45 monospace}.invite-access-error{color:#8a1737}.invite-waiting-panel{display:grid;justify-items:start;gap:12px;padding:18px;border:1px solid #74243d42;background:#fff5}.invite-waiting-panel svg{color:#74243d}.invite-waiting-panel h2{margin:0;font:28px Georgia,serif}.invite-waiting-panel p{margin:0;color:#261a17b3;font-size:13px}.invite-waiting-actions{display:flex;gap:8px;flex-wrap:wrap}.invite-waiting-actions button{min-height:40px;padding:0 14px;border:1px solid #74243d66;background:#74243d;color:white;font:10px monospace;text-transform:uppercase}.invite-waiting-actions .secondary{background:transparent;color:#4a1526}.invite-security-note{display:flex;align-items:center;gap:7px;color:#261a1773;font:9px monospace;text-transform:uppercase;letter-spacing:.08em}.invite-security-note svg{width:14px}.gate-footer{max-width:600px;margin:0;text-align:center;color:#f2e7d761;font:10px/1.5 monospace}.gate-footer a{color:#c09158;text-decoration:underline;text-underline-offset:3px}@media(max-width:760px){.private-invitation-card{grid-template-columns:1fr;min-height:650px;padding:34px 26px;gap:18px}.invite-monogram{grid-row:auto;width:96px;font-size:28px}.invite-gate-copy{text-align:center}.invite-private-label{justify-content:center}.invite-request-form{grid-template-columns:1fr}.invite-request-form .invite-field{grid-column:1/-1}.invite-security-note{justify-content:center;text-align:center}}@media(prefers-reduced-motion:reduce){.private-invitation-card{transition:none!important;transform:none!important}}
`;

export default function InvitationGate() {
  const card = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<GateMode>("idle");
  const [message, setMessage] = useState("Request access using the email address the couple will recognise.");
  const [savedRequest, setSavedRequest] = useState<SavedRequest | null>(null);

  async function checkStatus(request = savedRequest) {
    if (!request || mode === "opening") return;
    try {
      const response = await fetch("/api/invitations/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = (await response.json()) as { status?: string; guestName?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Status check failed.");
      if (data.status === "approved") {
        setMode("opening");
        setMessage(`Approved. Welcome, ${data.guestName}.`);
        window.localStorage.removeItem(STORAGE_KEY);
        window.setTimeout(() => window.location.replace("/"), 850);
      } else if (data.status === "declined") {
        setMode("declined");
        setMessage("This request was not approved. Please contact the couple if you believe this is a mistake.");
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      setMessage("We could not check your approval just now. We will try again automatically.");
    }
  }

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      try {
        const request = JSON.parse(raw) as SavedRequest;
        if (request.requestId && request.accessToken && request.email) {
          setSavedRequest(request);
          setMode("waiting");
          setMessage("Your invitation request is waiting for the couple's approval.");
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (mode !== "waiting" || !savedRequest) return;
    const firstCheck = window.setTimeout(() => void checkStatus(savedRequest), 0);
    const timer = window.setInterval(() => void checkStatus(savedRequest), 5000);
    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, savedRequest]);

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (!card.current || mode === "opening") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.current.style.setProperty("--invite-rotate-y", `${x * 8}deg`);
    card.current.style.setProperty("--invite-rotate-x", `${y * -7}deg`);
  }

  async function requestInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMode("sending");
    setMessage("Sending your request to the couple…");
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const response = await fetch("/api/invitations/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: fields.get("guestName"),
          email: fields.get("email"),
          requestedGuests: Number(fields.get("requestedGuests")),
          website: fields.get("website"),
        }),
      });
      const data = (await response.json()) as { requestId?: string; accessToken?: string; error?: string };
      if (!response.ok || !data.requestId || !data.accessToken) throw new Error(data.error ?? "Request failed.");
      const request = { requestId: data.requestId, accessToken: data.accessToken, email: String(fields.get("email")) };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(request));
      setSavedRequest(request);
      setMode("waiting");
      setMessage("Request received. This page will open automatically after approval.");
    } catch (error) {
      setMode("error");
      setMessage(error instanceof Error ? error.message : "We could not send your request.");
    }
  }

  function startOver() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSavedRequest(null);
    setMode("idle");
    setMessage("Request access using the email address the couple will recognise.");
  }

  return (
    <main className="invitation-gate">
      <style>{criticalStyles}</style>
      <div className="gate-grid" aria-hidden="true" />
      <div className="gate-heading"><p>THE ADEDEJI × AKORA UNION</p><span>Private traditional wedding · November 2026</span></div>

      <div className="invitation-stage" onPointerMove={tilt} onPointerLeave={() => {
        card.current?.style.setProperty("--invite-rotate-y", "0deg");
        card.current?.style.setProperty("--invite-rotate-x", "0deg");
      }}>
        <div ref={card} className={`private-invitation-card ${mode === "opening" ? "is-opening" : ""}`}>
          <div className="invite-monogram" aria-hidden="true"><span>I</span><i>&</i><span>J</span></div>
          <div className="invite-gate-copy">
            <p className="invite-private-label"><LockKeyhole /> STRICTLY BY INVITATION</p>
            <h1>Request your<br /><em>private invitation.</em></h1>
            <p>Tell us who you are. The couple will review your email and approve invited guests personally.</p>
          </div>

          {mode === "waiting" || mode === "opening" ? (
            <div className="invite-waiting-panel">
              {mode === "opening" ? <CheckCircle2 /> : <Clock3 />}
              <h2>{mode === "opening" ? "Invitation approved" : "Awaiting approval"}</h2>
              <p>{savedRequest?.email}</p><p>{message}</p>
              {mode === "waiting" && <div className="invite-waiting-actions"><button type="button" onClick={() => void checkStatus()}>Check now</button><button type="button" className="secondary" onClick={startOver}>Use another email</button></div>}
            </div>
          ) : (
            <form className="invite-request-form" onSubmit={requestInvitation}>
              <div className="invite-field"><label htmlFor="request-name">Your full name</label><Input id="request-name" name="guestName" required minLength={2} placeholder="Name the couple will recognise" /></div>
              <div className="invite-field"><label htmlFor="request-email">Email address</label><Input id="request-email" name="email" type="email" required placeholder="you@example.com" /></div>
              <div className="invite-field"><label htmlFor="request-guests">Requested guests</label><Input id="request-guests" name="requestedGuests" type="number" min={1} max={6} defaultValue={1} required /></div>
              <div className="honeypot" aria-hidden="true"><label htmlFor="request-website">Website</label><input id="request-website" name="website" tabIndex={-1} autoComplete="off" /></div>
              <Button type="submit" disabled={mode === "sending"}><Mail /> {mode === "sending" ? "Sending request…" : "Request invitation"} <ArrowRight /></Button>
              <p className={mode === "error" || mode === "declined" ? "invite-access-error" : "invite-access-note"} aria-live="polite">{message}</p>
            </form>
          )}

          <div className="invite-security-note"><ShieldCheck /> Private approval · email visible only to the couple</div>
        </div>
      </div>

      <p className="gate-footer">Already managing the wedding? <Link href="/admin">Open the couple’s private administration console</Link>.</p>
    </main>
  );
}
