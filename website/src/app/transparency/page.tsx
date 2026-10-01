import type { Metadata } from "next";
import { CaBox } from "@/components/CaBox";
import { Mascot } from "@/components/Mascot";
import { OfficialRecord } from "@/components/OfficialRecord";
import { SectionHead, Stamp } from "@/components/receipt";
import { Shell } from "@/components/Shell";
import { houseRules } from "@/lib/content";
import { ca, cashtag, isLive, notAffiliated, onlyTheAddress, project, tradeUrl } from "@/lib/project";

export const metadata: Metadata = {
  title: "Transparency",
  description: `How to verify ${project.name} (${cashtag}) yourself: the official contract, wallets, launch facts, house rules and security.`,
  alternates: { canonical: "/transparency" },
};

const T = cashtag;

export default function Transparency() {
  const official = [
    { label: "Website", href: project.links.website },
    { label: "X", href: project.links.x },
    { label: "Telegram channel", href: project.links.telegram },
    { label: "Telegram chat", href: project.links.telegramChat },
    { label: "GitHub (source + history)", href: project.links.github },
    { label: "Trading page", href: tradeUrl },
  ];

  return (
    <Shell>
      <div className="mx-auto max-w-[1280px] px-4 pt-10 sm:px-6 sm:pt-14">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.28em] text-fog uppercase">{T} · transparency</p>
            <h1 className="mt-3 max-w-[16ch] text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-paper [font-stretch:112.5%]">
              Only things you can check.
            </h1>
            <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-paper/80">
              Everything on this page is either verifiable on-chain, verifiable in our public history, or clearly marked as not existing yet.
              If something here doesn&apos;t match what you see elsewhere — trust the chain, not us, and tell us.
            </p>
          </div>
          <Mascot expr="angry" pose="point" prop="stamp" dark className="hidden h-auto w-[170px] lg:block" />
        </div>
        <div className="mt-8 max-w-[640px]">
          <CaBox ca={ca} note={notAffiliated} />
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-[1000px] px-2 pb-20 sm:px-4">
        <article className="paper edge-both px-5 pt-12 pb-16 shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] sm:px-12">
          <section aria-labelledby="record">
            <SectionHead n="01" id="record" title="The official record" kicker="On-chain facts" />
            <OfficialRecord className="reveal" />
          </section>

          <section className="pt-16" aria-labelledby="verify">
            <SectionHead n="02" id="verify" title="Verify it yourself" kicker="5 minutes" />
            <ol className="border-t-2 border-ink">
              {[
                ["Copy the contract address from this site.", "Not from a DM, a reply or a search result."],
                ["Compare it with the pinned post on X and the pinned message in Telegram.", "All three must match character for character."],
                ["Open it on Solscan or Solana Explorer.", "Check the creation time and the creator wallet listed above."],
                ["Open it on RugCheck.", "Mint authority and freeze authority should both be disabled."],
                ["Look at the holders on Bubblemaps.", "You'll see whether supply is clustered in connected wallets."],
              ].map(([h, b], i) => (
                <li key={h} className="reveal grid grid-cols-[44px_1fr] border-b-2 border-dotted border-ink/20 py-4">
                  <span className="font-display text-2xl leading-none font-black">{i + 1}</span>
                  <div>
                    <p className="text-[14.5px] font-bold">{h}</p>
                    <p className="mt-1 text-[13px] text-faded">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
            {!isLive && <p className="reveal mt-4 text-[13px] text-faded">Before launch there is no official contract address to verify. {notAffiliated}</p>}
          </section>

          <section className="pt-16" aria-labelledby="names">
            <SectionHead n="03" id="names" title="Names prove nothing" kicker="Read this twice" />
            <p className="reveal max-w-[62ch] text-[15px] leading-relaxed font-semibold">{onlyTheAddress}</p>
            <p className="reveal mt-3 max-w-[62ch] text-[13.5px] leading-relaxed">
              Other tokens already use the name or ticker {project.name}. They are independent projects, not affiliated with us — not necessarily scams, just
              not ours. Anyone can create a token with any name, so a matching name or logo is never evidence.
            </p>
          </section>

          <section className="pt-16" aria-labelledby="launch">
            <SectionHead n="04" id="launch" title="Launch day, minute by minute" kicker="Plan" />
            <p className="reveal max-w-[62ch] text-[14.5px] leading-relaxed">
              The token is created last. Everything else exists first. At creation, the contract address goes to every official place in the same
              minute — so there is never a window where only one source shows it.
            </p>
            <ol className="mt-6 grid gap-px bg-ink/15 sm:grid-cols-2">
              {[
                ["T+0", "Token created on Pump.fun. CA added to this site (a commit), X bio + pinned post, Telegram pinned message — the same minute."],
                ["T+10 min", "Launch post: visual, name, ticker, the contract address, link to this site."],
                ["T+30 min", "Transparency post: CA, network, platform, supply, creator wallet, explorer links."],
                ["T+24 h", "Honest recap: what shipped, what's next. No price charts, no fake milestones."],
              ].map(([k, v]) => (
                <li key={k} className="reveal bg-paper p-5">
                  <div className="font-display text-2xl font-black">{k}</div>
                  <p className="mt-2 text-[13.5px] leading-relaxed">{v}</p>
                </li>
              ))}
            </ol>
            <p className="reveal mt-4 text-[13px] text-faded">The exact launch date and time will be announced at least 24 hours ahead on X and Telegram.</p>
          </section>

          <section className="pt-16" aria-labelledby="publish">
            <SectionHead n="05" id="publish" title="What we publish at launch" kicker="No hidden lines" />
            <ul className="reveal grid gap-x-8 sm:grid-cols-2">
              {[
                "Contract address + creation transaction and its real cost",
                "Creator wallet address",
                "Whether the creator bought at launch, how much, with the transaction link",
                "Mint authority and freeze authority status",
                "Total supply and decimals as read from the chain",
                "Any other wallet we control that holds the token (none planned)",
              ].map((x) => (
                <li key={x} className="flex gap-3 border-b-2 border-dotted border-ink/20 py-3 text-[14px]">
                  <span aria-hidden className="font-bold">→</span>
                  {x}
                </li>
              ))}
            </ul>
          </section>

          <section className="pt-16" aria-labelledby="rules">
            <SectionHead n="06" id="rules" title="House rules" kicker="Never changes" />
            <ol>
              {houseRules.map((r, i) => (
                <li key={r} className="reveal grid grid-cols-[44px_1fr] border-b-2 border-dotted border-ink/20 py-3 text-[14.5px] leading-snug">
                  <span className="font-display text-xl leading-none font-black">{i + 1}</span>
                  <span>{r}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="pt-16" aria-labelledby="security">
            <SectionHead n="07" id="security" title="Security" kicker="How this site works" />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="reveal border-2 border-ink p-5">
                <Stamp rotate={-3} className="text-sm">No wallet connect</Stamp>
                <p className="mt-4 text-[14px] leading-relaxed">
                  This website will <strong>never</strong> ask you to connect a wallet, sign a message or approve anything. If a page that looks
                  like ours does — it isn&apos;t ours.
                </p>
              </div>
              <div className="reveal border-2 border-ink p-5">
                <Stamp rotate={2} className="text-sm">Static site</Stamp>
                <p className="mt-4 text-[14px] leading-relaxed">
                  The site is plain static HTML: no backend, no database, no admin panel to hack. The contract address comes from one file in
                  the project repository, and changing it means a commit with its own timestamp. The repository goes public before launch.
                </p>
              </div>
              <div className="reveal border-2 border-ink p-5">
                <Stamp rotate={-2} className="text-sm">No keys in code</Stamp>
                <p className="mt-4 text-[14px] leading-relaxed">
                  Seed phrases, private keys and bot tokens never touch the website or the repository. The deploy refuses to ship anything that
                  looks like a key.
                </p>
              </div>
              <div className="reveal border-2 border-ink p-5">
                <Stamp rotate={3} className="text-sm">One source</Stamp>
                <p className="mt-4 text-[14px] leading-relaxed">
                  Every official link on this site is generated from a single config. No page can quietly point somewhere else.
                </p>
              </div>
            </div>
          </section>

          <section className="pt-16" aria-labelledby="links">
            <SectionHead n="08" id="links" title="Official links" kicker="Only these" />
            <ul className="reveal border-t-2 border-ink">
              {official.map((l) => (
                <li key={l.label} className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-dotted border-ink/20 py-3 text-[14px]">
                  <span className="font-bold uppercase tracking-[0.06em]">{l.label}</span>
                  {l.href ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
                      {l.href.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-faded">{l.label === "Trading page" ? "after launch" : "opening soon"}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="reveal mt-5 text-[13px] leading-relaxed">
              Saw an account pretending to be us? Report it in our Telegram chat or reply on X. Never send anyone funds or a seed phrase to “fix”, “verify” or “claim”
              anything.
            </p>
            <a href="/" className="mt-8 inline-block text-[12px] font-bold tracking-[0.16em] uppercase underline underline-offset-4">
              ← Back to the receipt
            </a>
          </section>
        </article>
      </div>
    </Shell>
  );
}
