import type { Metadata } from "next";
import { Mascot } from "@/components/Mascot";
import { ReceiptList, type PublicReceipt } from "@/components/ReceiptList";
import { Row, SectionHead } from "@/components/receipt";
import { Shell } from "@/components/Shell";
import { buildLog, roadmap } from "@/lib/content";
import { cashtag, isLive, project, walletUrl } from "@/lib/project";

export const metadata: Metadata = {
  title: "Receipt Board",
  description: `Every significant action of ${project.name} (${cashtag}) as a numbered receipt — on-chain verified or clearly marked as project-reported.`,
  alternates: { canonical: "/receipts" },
};

// Build-time fallback: build-log entries in chronological order = the same numbering the backend uses.
function staticReceipts(): PublicReceipt[] {
  return [...buildLog]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e, i) => ({
      number: i + 1,
      label: `#${String(i + 1).padStart(4, "0")}`,
      kind: "build",
      title: e.title,
      status: /token created/i.test(e.title) ? "LOGGED" : "SHIPPED",
      verification: "PROJECT REPORTED" as const,
      amount: null,
      currency: null,
      txUrl: null,
      proofUrl: e.proof?.href ?? null,
      proofLabel: e.proof?.label ?? null,
      occurredAt: e.date,
      detail: e.detail ?? null,
    }))
    .reverse();
}

export default function ReceiptBoard() {
  const t = project.token;
  const kept = roadmap.flatMap((p) => p.items.filter((i) => i.s === "done").map((i) => i.t));
  const current = roadmap.flatMap((p) => p.items.filter((i) => i.s === "next" || i.s === "now").map((i) => i.t));
  const pending = isLive ? "—" : "after launch";

  return (
    <Shell>
      <div className="mx-auto max-w-[1280px] px-4 pt-10 sm:px-6 sm:pt-14">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.28em] text-fog uppercase">{cashtag} · receipt board</p>
            <h1 className="mt-3 max-w-[18ch] text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-paper [font-stretch:112.5%]">
              Every action gets a receipt.
            </h1>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-paper/80">
              Two kinds, never mixed. <strong className="text-paper">ON-CHAIN VERIFIED</strong> receipts are read from Solana by our watcher and
              link to the transaction. <strong className="text-paper">PROJECT REPORTED</strong> receipts are things we state, with whatever proof
              exists — a commit, a post, an invoice. A reported receipt is never dressed up as verified.
            </p>
          </div>
          <Mascot expr="skeptic" pose="point" prop="magnifier" dark className="hidden h-auto w-[170px] lg:block" />
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-[1100px] px-2 pb-20 sm:px-4">
        <article className="paper edge-both px-5 pt-12 pb-16 shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] sm:px-12">
          <section aria-labelledby="ledger">
            <SectionHead n="01" id="ledger" title="The ledger" kicker="Money in, money out" />
            <div className="grid gap-8 md:grid-cols-2">
              <div className="border-2 border-ink p-4 sm:p-5">
                <div className="mb-2 text-[10px] font-bold tracking-[0.25em] text-ok uppercase">On-chain verified</div>
                <Row label="Creator fees received" value={pending} muted={!isLive} />
                <Row label="Community rewards paid" value={pending} muted={!isLive} />
                <Row
                  label="Creator wallet"
                  value={t.creatorWallet ? <a className="underline" href={walletUrl(t.creatorWallet)} target="_blank" rel="noopener noreferrer">{t.creatorWallet.slice(0, 4)}…{t.creatorWallet.slice(-4)}</a> : pending}
                  muted={!t.creatorWallet}
                />
                <Row label="Treasury wallet" value={t.treasuryWallet ?? "None"} />
              </div>
              <div className="border-2 border-dashed border-ink/50 p-4 sm:p-5">
                <div className="mb-2 text-[10px] font-bold tracking-[0.25em] text-faded uppercase">Project reported</div>
                <Row label="Project expenses" value="none reported yet" muted />
                <Row label="Development expenses" value="none reported yet" muted />
                <p className="mt-3 text-[12px] leading-relaxed text-faded">
                  Hosting, APIs and other bills are added here as reported receipts, with the invoice when we have one.
                </p>
              </div>
            </div>
          </section>

          <section className="pt-16" aria-labelledby="promises">
            <SectionHead n="02" id="promises" title="Promises" kicker="Kept vs current" />
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-[12px] font-extrabold tracking-[0.16em] uppercase">Kept</h3>
                <ul>
                  {kept.map((k) => (
                    <li key={k} className="border-b-2 border-dotted border-ink/20 py-2 text-[14px] line-through decoration-2">
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-[12px] font-extrabold tracking-[0.16em] uppercase">Current</h3>
                <ul>
                  {current.map((k) => (
                    <li key={k} className="border-b-2 border-dotted border-ink/20 py-2 text-[14px]">
                      {k}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12px] text-faded">From the roadmap. A promise moves to “kept” only with a receipt.</p>
              </div>
            </div>
          </section>

          <section className="pt-16" aria-labelledby="all">
            <SectionHead n="03" id="all" title="All receipts" kicker="Newest first" />
            <ReceiptList initial={staticReceipts()} />
          </section>
        </article>
      </div>
    </Shell>
  );
}
