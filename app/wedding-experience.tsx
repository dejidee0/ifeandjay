"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Gift,
  Heart,
  MapPin,
  Send,
  Share2,
  Terminal as TerminalIcon,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { weddingConfig as config } from "@/lib/wedding-config";

type GuestMessage = {
  id: number;
  guestName: string;
  message: string;
  createdAt: string;
};

type GiftDetails = {
  accountNumber: string;
  bank: string;
  accountName: string;
};

type ToolContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

const terminalResponses: Record<string, string[]> = {
  "git status": [
    "On branch forever",
    "Your hearts are in sync.",
    "nothing to commit, love is up to date ♥",
  ],
  "sudo love": [
    "Permission granted.",
    "Installing patience, laughter & grace… done.",
  ],
  "404 single life not found": [
    "404: single life not found.",
    "Redirecting to /together/forever",
  ],
  "commit forever": [
    "[forever 1107love] two families, one future",
    "Commit signed by Ifedayo & Joyce.",
  ],
};

function Countdown() {
  const target = config.event.exactDate;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const values = useMemo(() => {
    if (!target) {
      return [
        ["--", "days"],
        ["--", "hours"],
        ["--", "minutes"],
        ["--", "seconds"],
      ];
    }
    const delta = Math.max(0, new Date(target).getTime() - now);
    return [
      [String(Math.floor(delta / 86400000)).padStart(2, "0"), "days"],
      [String(Math.floor((delta / 3600000) % 24)).padStart(2, "0"), "hours"],
      [String(Math.floor((delta / 60000) % 60)).padStart(2, "0"), "minutes"],
      [String(Math.floor((delta / 1000) % 60)).padStart(2, "0"), "seconds"],
    ];
  }, [target, now]);

  return (
    <div className="countdown-wrap" aria-label={target ? "Wedding countdown" : "Countdown awaiting exact date"}>
      <div className="countdown-grid">
        {values.map(([value, label]) => (
          <div className="countdown-unit" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {!target && <p className="countdown-note">Countdown initializes when the exact date is confirmed.</p>}
    </div>
  );
}

function SectionHeading({ index, eyebrow, title, intro }: { index: string; eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="section-heading" data-reveal>
      <p className="eyebrow"><span>{index}</span>{eyebrow}</p>
      <h2>{title}</h2>
      {intro && <p>{intro}</p>}
    </div>
  );
}

export default function WeddingExperience() {
  const [attendance, setAttendance] = useState("yes");
  const [rsvpState, setRsvpState] = useState<{ mode: "idle" | "sending" | "success" | "error"; message: string }>({ mode: "idle", message: "" });
  const [messageState, setMessageState] = useState("");
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [giftDetails, setGiftDetails] = useState<GiftDetails | null>(null);
  const [giftStatus, setGiftStatus] = useState("");
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLines, setTerminalLines] = useState(["wedding-os v1.0", "Connection established. Type a command to continue."]);
  const terminalField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
      { threshold: 0.14 },
    );
    document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/messages")
      .then(async (response) => (await response.json()) as { messages?: GuestMessage[] })
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]));
  }, []);

  useEffect(() => {
    fetch("/api/gift", { cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as GiftDetails) : null))
      .then((data) => setGiftDetails(data))
      .catch(() => setGiftDetails(null));
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ToolContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "submit_wedding_rsvp",
          title: "Submit wedding RSVP",
          description: "Submit a guest RSVP for Ifedayo and Joyce and return its confirmation code.",
          inputSchema: {
            type: "object",
            properties: {
              guestName: { type: "string", minLength: 2, maxLength: 80 },
              contact: { type: "string", minLength: 5, maxLength: 120 },
              attendance: { type: "string", enum: ["yes", "no", "maybe"] },
              guestCount: { type: "integer", minimum: 1, maximum: 6 },
            },
            required: ["guestName", "contact", "attendance", "guestCount"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const response = await fetch("/api/rsvp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input),
            });
            const data = (await response.json()) as {
              confirmationCode?: string;
              error?: string;
            };
            if (!response.ok) throw new Error(data.error ?? "RSVP failed");
            return { status: "confirmed", confirmationCode: data.confirmationCode };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  async function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRsvpState({ mode: "sending", message: "Saving your response…" });
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: form.get("guestName"),
        contact: form.get("contact"),
        guestCount: Number(form.get("guestCount")),
        website: form.get("website"),
        attendance,
      }),
    });
    const data = (await response.json()) as { confirmationCode?: string; error?: string };
    if (!response.ok) {
      setRsvpState({ mode: "error", message: data.error ?? "Please try again." });
      return;
    }
    setRsvpState({ mode: "success", message: data.confirmationCode ?? "Confirmed" });
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessageState("Sending…");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: fields.get("guestName"),
        message: fields.get("message"),
        website: fields.get("website"),
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessageState(data.error ?? "Please try again.");
      return;
    }
    form.reset();
    setMessageState("Received with love. Your message will appear after family approval.");
  }

  function runCommand(raw: string) {
    const command = raw.trim().toLowerCase();
    if (!command) return;
    const result = terminalResponses[command] ?? ["command not found — try one of the hints below"];
    setTerminalLines((lines) => [...lines.slice(-6), `guest@forever:~$ ${command}`, ...result]);
    setTerminalInput("");
    window.setTimeout(() => terminalField.current?.focus(), 0);
  }

  async function shareInvitation() {
    const shareData = {
      title: "Ifedayo & Joyce · Traditional Wedding",
      text: "Join us as Ifedayo and Joyce celebrate their traditional wedding in November 2026.",
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setMessageState("Invitation link copied.");
    }
  }

  async function copyGiftDetails() {
    if (!giftDetails) return;
    const text = `${giftDetails.bank}\n${giftDetails.accountName}\n${giftDetails.accountNumber}`;
    await navigator.clipboard.writeText(text);
    setGiftStatus("Account details copied. Thank you for celebrating with us.");
    window.setTimeout(() => setGiftStatus(""), 3500);
  }

  return (
    <main>
      <a className="skip-link" href="#story">Skip to our story</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Ifedayo and Joyce home"><span>I</span><i>&</i><span>J</span></a>
        <nav aria-label="Main navigation">
          <a href="#story">Story</a>
          <a href="#event">Event</a>
          <a href="#gallery">Gallery</a>
          <a href="#rsvp">RSVP</a>
        </nav>
        <a href="#rsvp" className="header-rsvp">Confirm attendance</a>
      </header>

      <section className="hero" id="top">
        <Image className="hero-image" src="/couple-hero.png" alt="Ifedayo and Joyce in jewel-teal traditional attire walking together through a candlelit celebration" fill priority sizes="100vw" />
        <div className="hero-shade" />
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-content">
          <div className="connection-pill"><span /> Connection established <code>200 OK</code></div>
          <p className="hero-kicker">{config.event.title} · {config.event.month}</p>
          <h1><span>{config.couple.displayGroom}</span><em>&</em><span>{config.couple.displayBride}</span></h1>
          <p className="hero-copy">Two families. One beautiful beginning. Join us as we honour tradition and commit our next chapter to forever.</p>
          <Countdown />
          <div className="hero-actions">
            <Button asChild size="lg"><a href="#story">Explore our story</a></Button>
            <Button asChild size="lg" variant="outline"><a href="#rsvp">RSVP</a></Button>
          </div>
        </div>
        <a className="scroll-cue" href="#story"><span>Scroll to enter</span><ChevronDown aria-hidden="true" /></a>
      </section>

      <section className="story section" id="story">
        <SectionHeading index="01" eyebrow="OUR STORY / COMMIT HISTORY" title="A love worth building." intro="Not every meaningful beginning arrives with a grand announcement. Ours grew line by line—in trust, in friendship and in the choice to keep showing up." />
        <div className="commit-layout">
          <div className="commit-rail" data-reveal>
            {config.story.map((entry, index) => (
              <article className="commit" key={entry.hash}>
                <div className="commit-node"><span>{index + 1}</span></div>
                <div className="commit-card">
                  <p><code>commit {entry.hash}</code><span>{entry.date}</span></p>
                  <h3>{entry.title}</h3>
                  <p>{entry.body}</p>
                </div>
              </article>
            ))}
          </div>
          <figure className="story-image" data-reveal>
            <Image src="/couple-story.png" alt="Ifedayo and Joyce sharing an affectionate look in jewel-teal traditional attire" fill sizes="(max-width: 900px) 100vw, 42vw" />
            <figcaption><code>merge: two lives → one future</code><span>Built with grace. Rooted in love.</span></figcaption>
          </figure>
        </div>
      </section>

      <section className="tradition section" id="tradition">
        <SectionHeading index="02" eyebrow="THE TRADITION / OUR FAMILIES" title="Where two lineages meet." />
        <div className="family-pair" data-reveal>
          <article><p>FAMILY / 01</p><h3>{config.families.groom}</h3><span>Welcoming a daughter</span></article>
          <div className="family-mark"><span>I</span><i>&</i><span>J</span></div>
          <article><p>FAMILY / 02</p><h3>{config.families.bride}</h3><span>Welcoming a son</span></article>
        </div>
        <div className="tradition-copy" data-reveal>
          <p className="dropcap">Our traditional wedding is a gathering of families, elders and friends—a moment to honour those who raised us, receive their blessings and celebrate the joining of two homes.</p>
          <p>Every rite will be guided by our families with care and respect. The final ceremonial details will be shared only after they are confirmed by both households.</p>
        </div>
      </section>

      <section className="event section" id="event">
        <SectionHeading index="03" eyebrow="THE EVENT / SAVE THE MONTH" title="November, with love." intro="The exact date, time and location will appear here the moment both families confirm them." />
        <div className="event-grid" data-reveal>
          <article className="event-primary">
            <CalendarDays aria-hidden="true" />
            <p>DATE</p><h3>{config.event.month}</h3><span>Exact date to be inserted</span>
          </article>
          <article><Clock3 aria-hidden="true" /><p>TIME</p><h3>{config.event.time}</h3></article>
          <article><MapPin aria-hidden="true" /><p>VENUE</p><h3>{config.event.venue}</h3><Button variant="outline" disabled={!config.event.mapUrl}>Navigation unlocks with venue</Button></article>
        </div>
        <div className="programme" data-reveal>
          <p className="eyebrow"><span>RUN OF SHOW</span> A DAY OF BLESSING & CELEBRATION</p>
          <ol>{config.programme.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p><code>→</code></li>)}</ol>
        </div>
      </section>

      <section className="dress section" id="dress-code">
        <SectionHeading index="04" eyebrow="DRESS CODE / COLOUR STORY" title="Two palettes, one celebration." intro="Jewel teal belongs to the couple; deep wine, burgundy and warm ivory belong to the room around them—distinct colours, beautifully woven together." />
        <div className="palette-card" data-reveal>
          <div className="swatches" aria-label="Wedding colour palette">
            <span className="swatch teal"><i>#006B80</i></span>
            <span className="swatch peacock"><i>#004F63</i></span>
            <span className="swatch wine"><i>#5D172F</i></span>
            <span className="swatch ivory"><i>#EFE3D1</i></span>
            <span className="swatch gold"><i>#B68A50</i></span>
          </div>
          <div className="dress-notes">
            <article><p>GUEST PALETTE</p><h3>{config.dressCode.guests}</h3></article>
            <article><p>THE BRIDE</p><h3>{config.dressCode.bride}</h3></article>
            <article><p>THE GROOM</p><h3>{config.dressCode.groom}</h3></article>
          </div>
          <div className="asoebi-note"><span>ASOEBI.INFO</span><p>{config.dressCode.asoebi}</p></div>
        </div>
      </section>

      <section className="gallery section" id="gallery">
        <SectionHeading index="05" eyebrow="GALLERY / MEMORY ARCHIVE" title="Moments, held close." intro="A living archive for every chapter—from the photographs that begin the story to the memories still waiting to be made." />
        <Tabs defaultValue="pre" className="gallery-tabs" data-reveal>
          <TabsList variant="line" aria-label="Gallery categories">
            <TabsTrigger value="pre">Pre-wedding</TabsTrigger><TabsTrigger value="family">Family</TabsTrigger><TabsTrigger value="engagement">Engagement</TabsTrigger><TabsTrigger value="wedding">Wedding memories</TabsTrigger>
          </TabsList>
          <TabsContent value="pre">
            <div className="gallery-grid">
              <figure className="gallery-wide"><Image src="/couple-hero.png" alt="Ifedayo and Joyce walking together in jewel-teal traditional attire" fill sizes="(max-width: 800px) 100vw, 52vw" /><figcaption><span>01</span>Before forever</figcaption></figure>
              <figure className="gallery-tall"><Image src="/couple-story.png" alt="Ifedayo and Joyce sharing an affectionate portrait" fill sizes="(max-width: 800px) 100vw, 24vw" /><figcaption><span>02</span>Held in grace</figcaption></figure>
              <figure className="gallery-tall"><Image src="/couple-gallery.png" alt="Formal seated portrait of Ifedayo and Joyce" fill sizes="(max-width: 800px) 100vw, 24vw" /><figcaption><span>03</span>Our colour, our joy</figcaption></figure>
            </div>
          </TabsContent>
          <TabsContent value="family"><div className="future-album"><Users /><p>Family portraits will be added here after both families have selected and approved them.</p><code>album.status = "awaiting moments"</code></div></TabsContent>
          <TabsContent value="engagement"><div className="future-album"><Heart /><p>This chapter is reserved for the photographs that tell the engagement story.</p><code>album.status = "coming soon"</code></div></TabsContent>
          <TabsContent value="wedding"><div className="future-album"><CalendarDays /><p>After the celebration, this space will become a shared archive of joy.</p><code>album.status = "future memory"</code></div></TabsContent>
        </Tabs>
      </section>

      <section className="rsvp section" id="rsvp">
        <div className="rsvp-panel" data-reveal>
          <div className="rsvp-copy">
            <p className="eyebrow"><span>06</span> RSVP / GUEST CHECK-IN</p>
            <h2>Will you celebrate with us?</h2>
            <p>Your response is saved privately and used only to help our families plan the celebration.</p>
            <div className="secure-note"><span /><code>secure_connection: active</code></div>
          </div>
          {rsvpState.mode === "success" ? (
            <div className="confirmation" role="status"><span><Check /></span><p>RSVP RECEIVED</p><h3>Connection confirmed.</h3><p>Thank you. Please keep this reference:</p><code>{rsvpState.message}</code><Button variant="outline" onClick={() => setRsvpState({ mode: "idle", message: "" })}>Submit another response</Button></div>
          ) : (
            <form onSubmit={submitRsvp} className="rsvp-form">
              <div className="field"><label htmlFor="guest-name">Guest name</label><Input id="guest-name" name="guestName" required minLength={2} placeholder="Your full name" /></div>
              <div className="field"><label htmlFor="guest-contact">Phone or email</label><Input id="guest-contact" name="contact" required minLength={5} placeholder="How the family can reach you" /></div>
              <fieldset><legend>Will you attend?</legend><RadioGroup value={attendance} onValueChange={setAttendance} className="attendance-options">
                {[['yes', 'Joyfully attending'], ['maybe', 'Not sure yet'], ['no', 'Celebrating from afar']].map(([value, label]) => <label key={value}><RadioGroupItem value={value} />{label}</label>)}
              </RadioGroup></fieldset>
              <div className="field"><label htmlFor="guest-count">Number of guests</label><Input id="guest-count" name="guestCount" type="number" inputMode="numeric" min={1} max={6} defaultValue={1} disabled={attendance !== "yes"} /></div>
              <div className="honeypot" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
              <Button type="submit" size="lg" disabled={rsvpState.mode === "sending"}>{rsvpState.mode === "sending" ? "Saving…" : "Confirm response"}<Send /></Button>
              <p className={rsvpState.mode === "error" ? "form-error" : "form-note"} aria-live="polite">{rsvpState.message || config.rsvpDeadline}</p>
            </form>
          )}
        </div>
      </section>

      <section className="message-wall section" id="messages">
        <SectionHeading index="07" eyebrow="GUESTBOOK / MESSAGE WALL" title="Leave a little love." intro="Share a blessing, a prayer or a memory. Messages are reviewed by the family before appearing here." />
        <div className="message-layout">
          <div className="message-list" data-reveal>
            {messages.length ? messages.map((item) => <blockquote key={item.id}><p>“{item.message}”</p><footer>— {item.guestName}</footer></blockquote>) : <div className="first-message"><Heart /><h3>Be among the first.</h3><p>Approved guest messages will gather here like notes in a keepsake.</p></div>}
          </div>
          <form className="message-form" onSubmit={submitMessage} data-reveal>
            <div className="field"><label htmlFor="message-name">Your name</label><Input id="message-name" name="guestName" required minLength={2} placeholder="Name" /></div>
            <div className="field"><label htmlFor="message-text">Your message</label><Textarea id="message-text" name="message" required minLength={3} maxLength={280} placeholder="Write your congratulations…" /></div>
            <div className="honeypot" aria-hidden="true"><label htmlFor="message-website">Website</label><input id="message-website" name="website" tabIndex={-1} autoComplete="off" /></div>
            <Button type="submit">Send to the couple <Heart /></Button>
            <p className="form-note" aria-live="polite">{messageState || "280 characters maximum · family moderated"}</p>
          </form>
        </div>
      </section>

      <section className="invitation section" id="invitation">
        <SectionHeading index="08" eyebrow="DIGITAL INVITATION / SHARE THE DATE" title="Carry the invitation with you." />
        <div className="invite-shell" data-reveal>
          <div className="invite-image"><Image src="/og-v2.png" alt="Ifedayo and Joyce traditional wedding invitation card in teal, wine and gold" fill sizes="(max-width: 900px) 100vw, 68vw" /></div>
          <div className="invite-actions">
            <Button size="lg" onClick={shareInvitation}><Share2 /> Share invitation</Button>
            <Button size="lg" variant="outline" asChild><a href="/og-v2.png" download="Ifedayo-and-Joyce-Invitation.png"><Download /> Download card</a></Button>
          </div>
        </div>
      </section>

      <section className="gift-section section" id="love-gift">
        <SectionHeading index="09" eyebrow="LOVE GIFT / WITH GRATITUDE" title="Your presence is our greatest gift." intro="If you would still like to bless the beginning of our home, we have made a gentle space for it—with love, never obligation." />
        <div className="gift-card" data-reveal>
          <div className="gift-message">
            <span className="gift-icon"><Gift aria-hidden="true" /></span>
            <p>A prayer, a kind word and your presence already mean the world to us.</p>
            <blockquote>“May every gift return to you as joy, grace and abundance.”</blockquote>
          </div>
          <div className="gift-details" aria-live="polite">
            <p className="eyebrow"><span>TRANSFER DETAILS</span> OPTIONAL LOVE GIFT</p>
            {giftDetails ? (
              <>
                <dl>
                  <div><dt>Bank</dt><dd>{giftDetails.bank}</dd></div>
                  <div><dt>Account name</dt><dd>{giftDetails.accountName}</dd></div>
                  <div className="account-number"><dt>Account number</dt><dd>{giftDetails.accountNumber}</dd></div>
                </dl>
                <Button onClick={copyGiftDetails}><Copy /> Copy account details</Button>
                <p className="gift-status">{giftStatus || "Thank you for celebrating this new chapter with us."}</p>
              </>
            ) : (
              <p className="gift-unavailable">Gift details will appear here once the secure server settings are loaded.</p>
            )}
          </div>
        </div>
      </section>

      <section className="terminal-section section" id="terminal">
        <SectionHeading index="10" eyebrow="A QUIET EASTER EGG / LOVE.EXE" title="For the curious ones." intro="A tiny terminal, because every good build deserves a few harmless secrets." />
        <div className="terminal" data-reveal onClick={() => terminalField.current?.focus()}>
          <div className="terminal-bar"><div><span /><span /><span /></div><p><TerminalIcon /> forever-terminal</p><span>⌘</span></div>
          <div className="terminal-output" aria-live="polite">{terminalLines.map((line, index) => <p key={`${line}-${index}`} className={line.includes("guest@forever") ? "command-line" : ""}>{line}</p>)}</div>
          <form onSubmit={(event) => { event.preventDefault(); runCommand(terminalInput); }} className="terminal-input-row"><label htmlFor="terminal-command">guest@forever:~$</label><input ref={terminalField} id="terminal-command" value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} autoComplete="off" spellCheck={false} /><span className="cursor" /></form>
          <div className="terminal-hints">{Object.keys(terminalResponses).map((command) => <button key={command} onClick={() => runCommand(command)} type="button"><Copy />{command}</button>)}</div>
        </div>
      </section>

      <footer className="finale">
        <div className="finale-mark"><span>I</span><i>&</i><span>J</span></div>
        <p className="eyebrow">THE ADEDEJI × AKORA UNION · NOVEMBER 2026</p>
        <h2>Connection established.<br /><em>Forever loading…</em></h2>
        <div className="loading-line"><span /></div>
        <p className="footer-code"><span>status: committed</span><span>uptime: forever</span><span>version: us.1.0</span></p>
      </footer>
    </main>
  );
}
