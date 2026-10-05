"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  guestName: string;
  message: string;
  status: string;
  createdAt: string;
};

export default function ModerationPage() {
  const [key, setKey] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState("Enter the server-side admin key to review messages.");
  const [loading, setLoading] = useState(false);

  async function loadMessages() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/messages", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = (await response.json()) as { messages?: Message[]; error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Could not load messages.");
        return;
      }
      setMessages(data.messages ?? []);
      setStatus(`${data.messages?.length ?? 0} messages loaded.`);
    } catch {
      setStatus("The connection was interrupted. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function moderate(id: string, nextStatus: string) {
    try {
      const response = await fetch("/api/admin/messages", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (!response.ok) throw new Error("Moderation failed");
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, status: nextStatus } : message,
        ),
      );
      setStatus(`Message ${id} marked ${nextStatus}.`);
    } catch {
      setStatus("The moderation update did not save.");
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">PRIVATE CONSOLE / MESSAGE MODERATION</p>
          <h1>Guest message review</h1>
        </div>
        <Link href="/">Return to invitation</Link>
      </header>

      <section className="admin-login" aria-label="Admin access">
        <label htmlFor="admin-key">Admin key</label>
        <div className="admin-key-row">
          <Input
            id="admin-key"
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Server-side ADMIN_KEY"
            autoComplete="off"
          />
          <Button onClick={loadMessages} disabled={!key || loading}>
            {loading ? "Loading…" : "Unlock"}
          </Button>
        </div>
        <p aria-live="polite">{status}</p>
      </section>

      <section className="admin-list" aria-label="Messages">
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
    </main>
  );
}
