"use client";

import { useId, useState } from "react";

type Result = { ok?: boolean; n?: number; handle?: string; wallet?: string; round?: number | null; error?: string };

const short = (a?: string) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");

const ERRORS: Record<string, string> = {
  closed: "The X drop is closed.",
  bad_link: "That isn't a link to a post on X. Open your reply, tap Share → Copy link, and paste it here.",
  slow_down: "Too many tries from here. Wait ten minutes and try again.",
  not_found: "Can't open that post. It has to be public — protected accounts and deleted posts can't be checked.",
  ours: "That's one of our posts. Paste the link to your reply under it.",
  not_reply: "That post isn't a direct reply to @chekcoinsol. Reply under one of our drop posts and paste that link.",
  too_early: "That reply was written before the drop opened. Post a new reply under a drop post.",
  no_address: "No Solana address in that reply. Reply again with your public SOL address (never a seed phrase or private key).",
  taken: "This address is already entered by another X account.",
};

// X drop entry: the public link of your reply to @chekcoinsol. The server reads the public post and checks it.
export function XDropForm() {
  const uid = useId();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Result | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!link.trim() || busy) return;
    setBusy(true);
    setR(null);
    try {
      const res = await fetch("/api/public?op=x_drop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ link: link.trim() }),
      });
      setR(await res.json());
    } catch {
      setR({ error: "network" });
    } finally {
      setBusy(false);
    }
  }

  const msg = !r
    ? null
    : r.ok
      ? `✅ You're in${r.round ? ` round ${r.round}` : ""} — @${r.handle}, address ${short(r.wallet)}. Account #${r.n} in the X drop.`
      : r.error === "already"
        ? `👌 @${r.handle} is already in ${r.round ? `round ${r.round}` : "this round"}. Reply under the next drop post for the next round.`
        : r.error === "other_wallet"
          ? `@${r.handle} entered with ${short(r.wallet)} before — reply with that same address in every round.`
        : (ERRORS[r.error ?? ""] ?? "Something went wrong. Try again in a minute.");

  return (
    <form onSubmit={submit} className="mt-6 border-2 border-ink p-4 sm:p-6">
      <label htmlFor={`${uid}-link`} className="block text-[11px] font-bold tracking-[0.2em] uppercase">
        Link to your reply on X
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={`${uid}-link`}
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="https://x.com/you/status/…"
          aria-describedby={`${uid}-help`}
          className="block w-full min-w-0 flex-1 border-2 border-ink bg-paper px-3 py-2.5 text-[16px] placeholder:text-faded/70"
        />
        <button
          type="submit"
          disabled={busy || !link.trim()}
          className="inline-flex items-center justify-center gap-2 bg-ink px-5 py-3 text-xs font-bold tracking-[0.16em] text-paper uppercase disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Checking…" : "Check my entry"}
        </button>
      </div>
      <p id={`${uid}-help`} className={`mt-3 min-h-5 text-[13px] leading-snug ${r && !r.ok && r.error !== "already" ? "text-stamp" : "text-faded"}`} aria-live="polite">
        {msg ?? "We read only the public post: who wrote it, that it replies to @chekcoinsol, and the address in it. Nothing to sign, nothing to connect."}
      </p>
    </form>
  );
}
