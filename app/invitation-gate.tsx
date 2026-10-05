"use client";

import { FormEvent, PointerEvent, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InvitationGate() {
  const card = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"idle" | "checking" | "opening" | "error">("idle");
  const [message, setMessage] = useState("Enter the private code shared with you by the family.");

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (!card.current || mode === "opening") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.current.style.setProperty("--invite-rotate-y", `${x * 8}deg`);
    card.current.style.setProperty("--invite-rotate-x", `${y * -7}deg`);
  }

  function resetTilt() {
    card.current?.style.setProperty("--invite-rotate-y", "0deg");
    card.current?.style.setProperty("--invite-rotate-x", "0deg");
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "checking" || mode === "opening") return;
    setMode("checking");
    setMessage("Verifying your invitation…");

    try {
      const response = await fetch("/api/invitations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { error?: string; guestName?: string };
      if (!response.ok) {
        setMode("error");
        setMessage(data.error ?? "We could not verify this invitation.");
        return;
      }

      setMode("opening");
      setMessage(`Welcome, ${data.guestName}. Opening your invitation…`);
      window.setTimeout(() => window.location.replace("/"), 850);
    } catch {
      setMode("error");
      setMessage("The connection was interrupted. Please try again.");
    }
  }

  return (
    <main className="invitation-gate">
      <div className="gate-glow gate-glow-teal" aria-hidden="true" />
      <div className="gate-glow gate-glow-wine" aria-hidden="true" />
      <div className="gate-grid" aria-hidden="true" />

      <div className="gate-heading">
        <p>THE ADEDEJI × AKORA UNION</p>
        <span>Private traditional wedding · November 2026</span>
      </div>

      <div
        className="invitation-stage"
        onPointerMove={tilt}
        onPointerLeave={resetTilt}
      >
        <div ref={card} className={`private-invitation-card ${mode === "opening" ? "is-opening" : ""}`}>
          <div className="invite-card-edge" aria-hidden="true" />
          <div className="invite-corner invite-corner-one" aria-hidden="true" />
          <div className="invite-corner invite-corner-two" aria-hidden="true" />

          <div className="invite-monogram" aria-hidden="true">
            <span>I</span><i>&</i><span>J</span>
          </div>

          <div className="invite-gate-copy">
            <p className="invite-private-label"><LockKeyhole /> STRICTLY BY INVITATION</p>
            <h1>Your place<br /><em>has been prepared.</em></h1>
            <p>This private celebration is reserved for the guests personally invited by our families.</p>
          </div>

          <form className="invite-code-form" onSubmit={unlock}>
            <label htmlFor="invitation-code">Invitation access code</label>
            <div className="invite-code-row">
              <Input
                id="invitation-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="IJ-XXXX-XXXX"
                autoComplete="one-time-code"
                spellCheck={false}
                required
                minLength={10}
                maxLength={12}
              />
              <Button type="submit" disabled={mode === "checking" || mode === "opening"} aria-label="Open private invitation">
                <ArrowRight />
              </Button>
            </div>
            <p className={mode === "error" ? "invite-access-error" : "invite-access-note"} aria-live="polite">{message}</p>
          </form>

          <div className="invite-security-note"><ShieldCheck /> Verified guest access · one invitation per household</div>
        </div>
      </div>

      <p className="gate-footer">If your code is missing, please contact the family member who shared your invitation.</p>
    </main>
  );
}
