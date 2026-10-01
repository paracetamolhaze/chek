import type { Metadata } from "next";
import Link from "next/link";
import { Barcode } from "@/components/Barcode";
import { Mascot } from "@/components/Mascot";
import { Row, Stars } from "@/components/receipt";
import { Shell } from "@/components/Shell";
import { IconExternal } from "@/components/icons";
import { buildLog } from "@/lib/content";
import { cashtag, formatUtc, project } from "@/lib/project";

export const metadata: Metadata = {
  title: "Build log",
  description: `The real history of ${project.name} (${cashtag}): every step since day one, added the day it happened, each with a receipt.`,
  alternates: { canonical: "/history" },
};

export default function History() {
  const days = new Map<string, typeof buildLog>();
  for (const e of buildLog) {
    const day = e.date.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), e]);
  }
  const first = buildLog.at(-1);
  const repo = project.links.github;

  return (
    <Shell>
      <div className="mx-auto max-w-[860px] px-2 pt-10 pb-20 sm:px-4 sm:pt-14">
        <div className="mb-8 flex items-end justify-between gap-6 px-2 text-paper">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.28em] text-fog uppercase">{cashtag} · build log</p>
            <h1 className="mt-3 text-[clamp(2.2rem,6vw,4rem)] leading-[0.95] font-extrabold tracking-[-0.03em] [font-stretch:112.5%]">
              Still printing.
            </h1>
            <p className="mt-4 max-w-[52ch] text-[14px] leading-relaxed text-paper/80">
              Every line was added the day it happened — never before, never backdated. Times are UTC. Where there&apos;s a receipt (a commit, a
              post, a transaction), it&apos;s linked.
            </p>
          </div>
          <Mascot expr="happy" pose="up" className="hidden h-auto w-[130px] shrink-0 sm:block" />
        </div>

        <article className="paper edge-both px-5 pt-12 pb-16 shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] sm:px-12">
          <header className="text-center">
            <div className="font-display text-5xl leading-none font-black sm:text-6xl">{project.name}</div>
            <p className="mt-3 text-[11px] font-semibold tracking-[0.3em] text-faded uppercase">Build log · Register #4</p>
            <div className="mx-auto mt-5 max-w-[420px] text-left">
              <Row label="Started" value={first ? formatUtc(first.date) : "—"} />
              <Row label="Lines" value={String(buildLog.length)} />
              <Row label="Backdated lines" value="0" strong />
            </div>
            <div className="rule-double mt-6" />
          </header>

          {[...days.entries()].map(([day, entries]) => (
            <section key={day} className="pt-10" aria-labelledby={`d-${day}`}>
              <h2 id={`d-${day}`} className="flex items-center gap-3 text-[12px] font-bold tracking-[0.25em] uppercase">
                <span className="bg-ink px-2 py-1 text-paper">{formatUtc(day + "T00:00:00Z")}</span>
                <span className="rule-dash flex-1" />
              </h2>
              <ol className="mt-2">
                {entries.map((e) => (
                  <li key={e.date + e.title} className="reveal grid grid-cols-[64px_1fr] gap-3 border-b-2 border-dotted border-ink/20 py-4 sm:grid-cols-[80px_1fr]">
                    <time dateTime={e.date} className="pt-0.5 text-[12px] font-bold tracking-[0.08em]">
                      {e.date.slice(11, 16)}
                    </time>
                    <div>
                      <h3 className="text-[15px] font-extrabold">{e.title}</h3>
                      {e.detail && <p className="mt-1 text-[13.5px] leading-relaxed">{e.detail}</p>}
                      {e.proof && (
                        <p className="mt-2 text-[11px] font-semibold tracking-[0.14em] text-faded uppercase">
                          Receipt:{" "}
                          {e.proof.href ? (
                            <a href={e.proof.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink underline underline-offset-2">
                              {e.proof.label} <IconExternal className="size-3" />
                            </a>
                          ) : (
                            <span className="text-ink">{e.proof.label}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <footer className="mt-14 text-center">
            <Stars />
            <p className="mx-auto mt-6 max-w-[48ch] text-[13px] leading-relaxed">
              This log lives in the project repository as <code className="bg-paper-back px-1">content/history.json</code>. Every change to it is a
              commit with its own timestamp{repo ? (
                <>
                  {" "}— <a className="underline" href={`${repo}/commits/main/content/history.json`} target="_blank" rel="noopener noreferrer">check the history of the history</a>
                </>
              ) : (
                <> — the repository goes public before launch</>
              )}
              .
            </p>
            <Barcode value={`${project.ticker}-LOG-${buildLog.length}`} className="mx-auto mt-8 h-14 w-[240px]" />
            <Link href="/" className="mt-8 inline-block text-[12px] font-bold tracking-[0.16em] uppercase underline underline-offset-4">
              ← Back to the receipt
            </Link>
          </footer>
        </article>
      </div>
    </Shell>
  );
}
