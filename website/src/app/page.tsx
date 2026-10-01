import { Barcode } from "@/components/Barcode";
import { CaBox } from "@/components/CaBox";
import { Mascot, mascotSrc } from "@/components/Mascot";
import { OfficialRecord } from "@/components/OfficialRecord";
import { Row, SectionHead, Stamp, Stars, Tag } from "@/components/receipt";
import { BUILT_AT, primaryCta, Shell } from "@/components/Shell";
import { SideMascot } from "@/components/SideMascot";
import { IconArrow, IconExternal, IconWarn, SocialIcon } from "@/components/icons";
import { buildLog, faq, houseRules, lore, roadmap, utility, why } from "@/lib/content";
import { ca, cashtag, formatUtc, isLive, networkPhrase, notAffiliated, platformChecked, project, shortAddress, socials, tradeUrl, walletUrl } from "@/lib/project";
import { PrintCta } from "@/components/PrintCta";

const T = cashtag;
const M = project.mascot;
const t = project.token;

const SECTIONS = [
  { id: "what", n: "01", label: `What is ${project.name}` },
  { id: "story", n: "02", label: "The story" },
  { id: "why", n: "03", label: "Why it exists" },
  { id: "utility", n: "04", label: "Utility" },
  { id: "tokenomics", n: "05", label: "Tokenomics" },
  { id: "transparency", n: "06", label: "Transparency" },
  { id: "buy", n: "07", label: "How to buy" },
  { id: "roadmap", n: "08", label: "Roadmap" },
  { id: "faq", n: "09", label: "FAQ" },
  { id: "log", n: "10", label: "Build log" },
];

const MOODS = [
  { key: "what", say: "it's a meme coin. that's it.", expr: "neutral", pose: "down" },
  { key: "story", say: "it's a long roll.", expr: "wink", pose: "wave" },
  { key: "why", say: "proof > promises", expr: "happy", pose: "up" },
  { key: "utility", say: "only real stuff here", expr: "skeptic", pose: "hip" },
  { key: "tokenomics", say: "numbers at launch. not before.", expr: "skeptic", pose: "point", prop: "magnifier" },
  { key: "transparency", say: "verified or void.", expr: "angry", pose: "point", prop: "stamp" },
  { key: "buy", say: "check the CA. twice.", expr: "shock", pose: "up" },
  { key: "roadmap", say: "no moon talk.", expr: "neutral", pose: "hip" },
  { key: "faq", say: "ask away.", expr: "wink", pose: "wave" },
  { key: "log", say: "still printing.", expr: "happy", pose: "up" },
] as const;

export default function Home() {
  const cta = primaryCta();
  const moods = MOODS.map((m) => ({
    key: m.key,
    say: m.say,
    src: mascotSrc({ expr: m.expr, pose: m.pose, prop: "prop" in m ? m.prop : undefined, dark: true }),
  }));
  const pending = "Published at launch";

  return (
    <Shell>
      {/* ───────────── HERO ───────────── */}
      <section className="relative overflow-hidden" aria-labelledby="hero-title">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 bottom-6 hidden font-display text-[clamp(9rem,19vw,17rem)] leading-[0.8] font-black text-paper/[0.035] select-none lg:block"
        >
          {project.name}
        </div>
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-[1fr_auto] gap-x-4 gap-y-6 px-4 pt-8 pb-14 sm:px-6 sm:pt-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-x-10 lg:pt-16 lg:pb-24">
          <div className="col-span-1 self-center">
            <p className="text-[11px] font-semibold tracking-[0.28em] text-fog uppercase">
              Meme coin · {isLive ? project.network : `Launching on ${project.network}`} · <span className="text-paper">{T}</span>
            </p>
            <h1
              id="hero-title"
              className="mt-4 text-[clamp(2.1rem,7.4vw,5.4rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-paper [font-stretch:112.5%]"
            >
              Receipts or it didn&apos;t happen.
            </h1>
          </div>

          <div className="relative row-span-1 w-[34vw] max-w-[150px] self-end sm:max-w-[190px] lg:row-span-2 lg:w-auto lg:max-w-none lg:self-center">
            <div className="absolute -top-2 left-[44%] z-10 hidden -rotate-3 bg-paper px-4 py-2 text-lg font-bold text-ink shadow-[4px_4px_0_0_#000] lg:block">
              receipt?
              <span className="absolute -bottom-2 left-5 size-4 rotate-45 bg-paper" />
            </div>
            <Mascot expr="skeptic" pose="hip" dark priority label={`${M}, the ${project.name} mascot: a thermal paper receipt with one eyebrow raised`} className="mx-auto h-auto w-full lg:max-w-[420px]" />
          </div>

          <div className="col-span-2 lg:col-span-1">
            <p className="max-w-[560px] text-[15px] leading-relaxed text-paper/85 sm:text-base">
              <strong className="text-paper">{project.name}</strong> is a meme coin {networkPhrase} with one rule: every claim comes with a receipt.
              Token: <strong className="text-paper">{T}</strong>. No promises. No fake partners. Just memes, lore and proof.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={cta.href}
                {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="btn-hard inline-flex items-center gap-2 bg-paper px-5 py-3.5 text-[12px] font-bold tracking-[0.16em] text-ink uppercase shadow-[4px_4px_0_0_var(--color-marker)] hover:bg-marker"
              >
                {cta.label} <IconArrow className="size-4" />
              </a>
              {isLive && tradeUrl ? (
                <a
                  href={tradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border-2 border-paper px-5 py-3 text-[12px] font-bold tracking-[0.16em] text-paper uppercase hover:bg-paper hover:text-ink"
                >
                  View token <IconExternal className="size-4" />
                </a>
              ) : (
                <a
                  href="/history"
                  className="inline-flex items-center gap-2 border-2 border-paper/40 px-5 py-3 text-[12px] font-bold tracking-[0.16em] text-paper uppercase hover:border-paper"
                >
                  {cta.href === "/history" ? "How it works" : "Read the build log"}
                </a>
              )}
            </div>
            <div className="mt-7 max-w-[560px]">
              <CaBox ca={ca} note={notAffiliated} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold tracking-[0.18em] text-fog uppercase">
              {socials
                .filter((s) => s.href)
                .map((s) => (
                  <a key={s.key} href={s.href!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-paper">
                    <SocialIcon k={s.key} className="size-4" /> {s.label}
                    {s.key === "x" || s.key === "telegram" ? <span className="text-fog/70 normal-case tracking-normal">@{s.href!.split("/").pop()}</span> : null}
                  </a>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── PRINTER SLOT ───────────── */}
      <div className="mx-auto max-w-[1000px] px-2 sm:px-4" aria-hidden>
        <div className="relative h-12 rounded-t-2xl border border-paper/10 bg-[#0d0c0b] shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
          <span className="absolute top-3 left-5 flex items-center gap-2 text-[9px] tracking-[0.3em] text-fog/60 uppercase">
            <span className="size-1.5 rounded-full bg-ok shadow-[0_0_8px_2px_rgba(47,125,79,.6)]" /> Register #4
          </span>
          <span className="absolute inset-x-3 bottom-2 h-2.5 rounded-full bg-black shadow-[inset_0_2px_3px_rgba(0,0,0,.9)] sm:inset-x-6" />
        </div>
      </div>

      {/* ───────────── THE RECEIPT ───────────── */}
      <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 xl:grid-cols-[1fr_minmax(0,920px)_1fr]">
        <aside className="hidden xl:block" aria-label="Sections">
          <nav className="sticky top-28 ml-auto w-[180px] pr-8">
            <ol className="space-y-1.5 text-[11px] tracking-[0.12em] text-fog uppercase">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-3 py-0.5 hover:text-paper">
                    <span className="font-display font-black text-paper/60">{s.n}</span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="paper edge-bottom relative mx-2 -mt-3 px-5 pt-10 pb-20 shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] sm:mx-4 sm:px-10 md:px-14 xl:mx-0">
          {/* receipt header */}
          <header className="text-center">
            <div className="font-display text-[clamp(3rem,11vw,6.5rem)] leading-[0.85] font-black tracking-[0.02em]">{project.name}</div>
            <p className="mt-4 text-[11px] font-semibold tracking-[0.3em] text-faded uppercase">Register #4 · Open 24/7 · {project.network}</p>
            <div className="mx-auto mt-5 max-w-[420px] space-y-0.5 text-left">
              <Row label="Order" value={T} />
              <Row label="Public since" value={formatUtc(`${project.publicSince}T00:00:00Z`)} />
              <Row label="Printed" value={formatUtc(BUILT_AT, true)} />
              <Row label="Status" value={isLive ? <span className="text-ok">Live</span> : <span className="text-stamp">Pre-launch</span>} strong />
            </div>
            <div className="rule-double mt-6" />
          </header>

          {/* 01 WHAT */}
          <section id="what" data-mood="what" className="scroll-mt-24 pt-14" aria-labelledby="what-title">
            <SectionHead n="01" id="what-title" title={`What is ${project.name}?`} kicker="10-second version" />
            <div className="grid gap-10 md:grid-cols-[1.25fr_1fr]">
              <div className="reveal space-y-4 text-[15px] leading-relaxed">
                <p>
                  <span className="marker font-bold">A meme coin.</span> We say it plainly because most projects won&apos;t.
                </p>
                <p>
                  {project.name} has no app, no yield and no secret tech. It&apos;s a character — <strong>{M}</strong>, a slip of thermal paper that only prints
                  what it can prove — and a community that makes memes, runs challenges and keeps every claim checkable.
                </p>
                <p className="text-[13px] leading-relaxed text-faded">
                  Why “{project.name}”? <em>Чек</em> is Russian for receipt. The check is the bill. And checking is what you should do before you
                  trust anything — including us.
                </p>
              </div>
              <div className="reveal self-start border-2 border-ink p-4 sm:p-5">
                <Row label="Meme coin" value="Yes" />
                <Row label="Promised returns" value="None" />
                <Row label="Presale / whitelist" value="None" />
                <Row label="Fake partners" value="None" />
                <div className="rule-dash my-2" />
                <Row label="Receipts" value="Always" strong />
              </div>
            </div>
            <div className="reveal mt-10 grid gap-px bg-ink sm:grid-cols-3">
              {[
                ["The meme", "is the product."],
                ["The receipts", "are the system."],
                [project.name, "is the access layer."],
              ].map(([a, b]) => (
                <div key={a} className="bg-paper p-5">
                  <div className="font-display text-3xl leading-none font-black sm:text-4xl">{a}</div>
                  <div className="mt-2 text-[13px] font-extrabold tracking-[0.08em] uppercase">{b}</div>
                </div>
              ))}
            </div>
            <p className="reveal mt-4 max-w-[64ch] text-[13.5px] leading-relaxed">
              {project.name} is a meme about proof. Holding {T} is how you&apos;ll take part — holder votes, holder templates, a Verified Holder
              receipt (planned, see below). No ownership, no dividends, no promises.
            </p>
          </section>

          {/* 02 STORY */}
          <section id="story" data-mood="story" className="scroll-mt-24 pt-20" aria-labelledby="story-title">
            <SectionHead n="02" id="story-title" title="The story" kicker="Lore · ongoing" />
            <ol className="space-y-2">
              {lore.map((c) => (
                <li key={c.ch} className="reveal grid grid-cols-[72px_1fr] gap-4 border-b-2 border-dotted border-ink/20 py-5 sm:grid-cols-[110px_1fr] sm:gap-7">
                  <div className="relative">
                    <Mascot expr={c.expr} pose={c.pose} prop={c.prop} className="h-auto w-full" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold tracking-[0.25em] text-faded uppercase">Chapter {c.ch}</div>
                    <h3 className="mt-1 text-xl font-extrabold tracking-[-0.01em] [font-stretch:112.5%] sm:text-2xl">{c.title}</h3>
                    <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed sm:text-[15px]">{c.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="reveal mt-6 text-[13px] text-faded">New chapters drop on X first. Villains get their own receipts.</p>
          </section>

          {/* 03 WHY */}
          <section id="why" data-mood="why" className="scroll-mt-24 pt-20" aria-labelledby="why-title">
            <SectionHead n="03" id="why-title" title="Why does this exist?" kicker="Honest answer" />
            <p className="reveal max-w-[60ch] text-lg leading-snug font-bold [font-stretch:100%] sm:text-xl">
              Because most meme coins ask you to trust them. We&apos;d rather show receipts.
            </p>
            <div className="mt-8 grid gap-px bg-ink/15 sm:grid-cols-2">
              {why.map((w, i) => (
                <div key={w.k} className="reveal bg-paper p-5 sm:p-6">
                  <div className="font-display text-4xl leading-none font-black">{String(i + 1).padStart(2, "0")}</div>
                  <h3 className="mt-3 text-sm font-extrabold tracking-[0.12em] uppercase">{w.k}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed">{w.v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 04 UTILITY */}
          <section id="utility" data-mood="utility" className="scroll-mt-24 pt-20" aria-labelledby="utility-title">
            <SectionHead n="04" id="utility-title" title="What can you do with it?" kicker="Live vs planned" />
            <p className="reveal max-w-[62ch] text-[15px] leading-relaxed">
              {T} is a membership badge for a meme community. Here&apos;s what exists today and what comes next — labelled honestly. Nothing
              marked <Tag kind="planned" /> exists yet.
            </p>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              {(["live", "planned"] as const).map((group) => (
                <div key={group}>
                  <div className="mb-3 flex items-center gap-3">
                    <Tag kind={group} />
                    <span className="rule-dash flex-1" />
                  </div>
                  <ul>
                    {utility
                      .filter((u) => u.status === group)
                      .map((u) => (
                        <li key={u.title} className="reveal border-b-2 border-dotted border-ink/20 py-4">
                          <h3 className="text-[15px] font-extrabold">
                            {u.href ? (
                              <a href={u.href} className="underline decoration-2 underline-offset-4 hover:bg-marker">
                                {u.title}
                              </a>
                            ) : (
                              u.title
                            )}
                          </h3>
                          <p className="mt-1 text-[13.5px] leading-relaxed">{u.body}</p>
                          {u.note && <p className="mt-1.5 text-[11px] tracking-[0.12em] text-faded uppercase">{u.note}</p>}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <div className="pt-14">
            <PrintCta />
          </div>

          {/* 05 TOKENOMICS */}
          <section id="tokenomics" data-mood="tokenomics" className="scroll-mt-24 pt-20" aria-labelledby="tokenomics-title">
            <SectionHead n="05" id="tokenomics-title" title="Tokenomics" kicker="Itemized" />
            {!isLive && (
              <div className="reveal mb-6 flex flex-wrap items-center gap-4">
                <Stamp rotate={-4} className="text-base">Final data at launch</Stamp>
                <p className="max-w-[48ch] text-[13.5px] leading-relaxed">
                  Final token data will be published at launch. Nothing below is filled in until it exists on-chain.
                </p>
              </div>
            )}
            <div className="reveal border-2 border-ink p-4 sm:p-6">
              <Row label="Network" value={project.network} />
              <Row label="Ticker" value={T} />
              <Row label="Total supply" value={t.totalSupply ?? pending} muted={!t.totalSupply} />
              <Row label="Contract address" value={ca ? shortAddress(ca) : <span className="text-stamp">Not launched yet</span>} />
              <Row label="Launch platform" value={isLive ? t.launchPlatform : `${t.launchPlatform} (planned)`} />
              <div className="rule-dash my-2" />
              <Row label="Presale / team mint" value="None" />
              <Row
                label="Creator wallet"
                value={t.creatorWallet ? <a className="underline" href={walletUrl(t.creatorWallet)} target="_blank" rel="noopener noreferrer">{shortAddress(t.creatorWallet)}</a> : pending}
                muted={!t.creatorWallet}
              />
              <Row label="Free allocation to the creator" value="0%" />
              <Row
                label="Creator buy at creation"
                value={t.creatorBuy ?? `Planned ≈ $${project.token.creatorBuyTargetUsd ?? 200} — exact SOL, ${T} and % from the chain`}
                muted={!t.creatorBuy}
              />
              <Row
                label="Treasury wallet"
                value={t.treasuryWallet ? <a className="underline" href={walletUrl(t.treasuryWallet)} target="_blank" rel="noopener noreferrer">{shortAddress(t.treasuryWallet)}</a> : "None"}
              />
              <Row label="Other allocations" value={t.otherAllocations === "none" ? "None" : t.otherAllocations} />
              <Row label="Token tax" value="None" />
              <Row label={`Creator fee (platform, as checked ${platformChecked})`} value={`${project.platform.creatorFee} of curve trades`} />
              <div className="rule-double my-3" />
              <Row label="Hidden allocations" value="None" strong />
            </div>
            <p className="reveal mt-3 text-[12px] leading-relaxed text-faded">
              Trading fees are set by {t.launchPlatform}, not by us — including the creator fee the platform pays to the creator wallet (
              {project.platform.creatorFee} of {project.platform.creatorFeeScope}, as checked {platformChecked}; platform values can change and get re-checked on launch day).
              We list it because it&apos;s real income for the creator. For reference, a standard {t.launchPlatform} coin (as checked {platformChecked}) has
              1,000,000,000 supply and mint/freeze authority disabled at creation — this table will show our coin&apos;s actual on-chain values, not the
              expected ones.
            </p>
          </section>

          {/* 06 TRANSPARENCY */}
          <section id="transparency" data-mood="transparency" className="scroll-mt-24 pt-20" aria-labelledby="transparency-title">
            <SectionHead n="06" id="transparency-title" title="Transparency" kicker="Only what you can check" />
            <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
              <OfficialRecord className="reveal" />
              <div className="reveal">
                <h3 className="text-sm font-extrabold tracking-[0.16em] uppercase">House rules</h3>
                <ol className="mt-3">
                  {houseRules.map((r, i) => (
                    <li key={r} className="grid grid-cols-[34px_1fr] border-b-2 border-dotted border-ink/20 py-3 text-[14px] leading-snug">
                      <span className="font-display text-lg leading-none font-black">{i + 1}</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ol>
                <a href="/transparency" className="mt-5 inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] uppercase underline decoration-2 underline-offset-4 hover:bg-marker">
                  Full transparency page <IconArrow className="size-4" />
                </a>
              </div>
            </div>
          </section>

          {/* 07 HOW TO BUY */}
          <section id="buy" data-mood="buy" className="scroll-mt-24 pt-20" aria-labelledby="buy-title">
            <SectionHead n="07" id="buy-title" title="How to buy" kicker="5 steps" />
            {!isLive && (
              <div className="reveal mb-6 flex flex-wrap items-center gap-4 border-2 border-stamp/60 bg-stamp/[0.06] p-4">
                <Stamp rotate={-3}>Not launched yet</Stamp>
                <p className="max-w-[60ch] text-[13.5px] leading-relaxed">{notAffiliated}</p>
              </div>
            )}
            <ol className="border-t-2 border-ink">
              {[
                ["Get a Solana wallet", "Phantom, Solflare or Backpack. Download it only from the official site."],
                ["Get SOL", "Buy SOL on an exchange and send it to your wallet."],
                ["Verify the contract", "Copy the address from this site. Check it matches our pinned posts on X and Telegram. The name and ticker prove nothing — only the address does."],
                ["Open the official link", isLive ? "Use the trading link on this page — nowhere else." : "The trading link appears here at launch."],
                ["Swap", "Swap SOL for the token. Start small. Only use money you can afford to lose."],
              ].map(([h, b], i) => (
                <li key={h} className="reveal grid grid-cols-[44px_1fr] gap-x-3 border-b-2 border-dotted border-ink/20 py-4 sm:grid-cols-[56px_230px_1fr] sm:items-baseline">
                  <div className="row-span-2 font-display text-3xl leading-none font-black sm:row-span-1">{i + 1}</div>
                  <h3 className="text-[13px] font-extrabold tracking-[0.1em] uppercase">{h}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed sm:mt-0">{b}</p>
                </li>
              ))}
            </ol>
            <div className="reveal mt-5 flex items-start gap-3 bg-ink p-4 text-paper sm:items-center">
              <IconWarn className="size-6 shrink-0 text-marker" />
              <p className="text-[13.5px] leading-relaxed font-semibold">
                Always verify the Contract Address. Other tokens may use the same name or ticker.
              </p>
            </div>
            {isLive && tradeUrl && (
              <div className="reveal mt-5 flex flex-wrap gap-3">
                <a href={tradeUrl} target="_blank" rel="noopener noreferrer" className="btn-hard inline-flex items-center gap-2 bg-ink px-5 py-3.5 text-[12px] font-bold tracking-[0.16em] text-paper uppercase">
                  Open on {t.launchPlatform} <IconExternal className="size-4" />
                </a>
              </div>
            )}
          </section>

          {/* 08 ROADMAP */}
          <section id="roadmap" data-mood="roadmap" className="scroll-mt-24 pt-20" aria-labelledby="roadmap-title">
            <SectionHead n="08" id="roadmap-title" title="Roadmap" kicker="No moons. No lambos." />
            <p className="reveal max-w-[60ch] text-[15px] leading-relaxed">Only things we can actually do. Items get a receipt in the build log when they ship.</p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {roadmap.map((p) => (
                <div key={p.phase} className="reveal border-t-4 border-ink pt-4">
                  <div className="text-[11px] font-bold tracking-[0.25em] text-faded uppercase">Phase {p.phase}</div>
                  <h3 className="mt-1 text-xl font-extrabold [font-stretch:112.5%]">{p.title}</h3>
                  <ul className="mt-4 space-y-3">
                    {p.items.map((it) => (
                      <li key={it.t} className="flex items-start justify-between gap-3 text-[13.5px] leading-snug">
                        <span className={it.s === "done" ? "line-through decoration-2" : ""}>{it.t}</span>
                        <Tag kind={it.s} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 09 FAQ */}
          <section id="faq" data-mood="faq" className="scroll-mt-24 pt-20" aria-labelledby="faq-title">
            <SectionHead n="09" id="faq-title" title="FAQ" kicker="Straight answers" />
            <div className="border-t-2 border-ink">
              {faq.map((f) => (
                <details key={f.q} className="reveal group border-b-2 border-dotted border-ink/25">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-[15px] font-bold">
                    {f.q}
                    <span className="font-display text-2xl font-black transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="max-w-[68ch] pb-5 text-[14px] leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* 10 BUILD LOG */}
          <section id="log" data-mood="log" className="scroll-mt-24 pt-20" aria-labelledby="log-title">
            <SectionHead n="10" id="log-title" title="Build log" kicker="Real dates · UTC" />
            <ol>
              {buildLog.slice(0, 5).map((e) => (
                <li key={e.date + e.title} className="reveal grid gap-1 border-b-2 border-dotted border-ink/20 py-4 sm:grid-cols-[170px_1fr] sm:gap-6">
                  <time dateTime={e.date} className="text-[12px] font-bold tracking-[0.12em] uppercase">
                    {formatUtc(e.date)}
                  </time>
                  <div>
                    <div className="text-[15px] font-extrabold">{e.title}</div>
                    {e.detail && <p className="mt-1 text-[13.5px] leading-relaxed">{e.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
            <a href="/history" className="reveal mt-5 inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] uppercase underline decoration-2 underline-offset-4 hover:bg-marker">
              Full build log <IconArrow className="size-4" />
            </a>
          </section>

          {/* receipt footer */}
          <footer className="mt-20 text-center">
            <div className="rule-double" />
            <div className="mx-auto mt-6 max-w-[420px] text-left">
              <Row label="Lines printed" value={String(buildLog.length)} />
              <Row label="Public since" value={formatUtc(`${project.publicSince}T00:00:00Z`)} />
              <Row label="Total" value="Receipts" strong />
            </div>
            <Stars className="mt-8" />
            <p className="mt-6 text-lg font-extrabold tracking-[0.06em] uppercase [font-stretch:112.5%]">Thank you for not trusting us.</p>
            <p className="mt-1 text-[12px] tracking-[0.2em] text-faded uppercase">Verify everything · keep this receipt</p>
            <Barcode value={project.links.website?.replace(/^https?:\/\//, "") ?? T} className="mx-auto mt-8 h-16 w-[260px] text-ink" />
          </footer>
        </article>

        <aside className="hidden pl-8 xl:block">
          <SideMascot moods={moods} />
        </aside>
      </div>
      <div className="h-16" />
    </Shell>
  );
}
