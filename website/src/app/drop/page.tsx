import type { Metadata } from "next";
import { DropCount } from "@/components/DropCount";
import { DropResults } from "@/components/DropResults";
import { Mascot } from "@/components/Mascot";
import { Row, SectionHead, Stamp } from "@/components/receipt";
import { Shell } from "@/components/Shell";
import { XDropForm } from "@/components/XDropForm";
import { cashtag, project } from "@/lib/project";

const d = project.drop!;
const xr = d.x.rounds!;
const tgd = d.telegram.draw!;
const fmt = (n: number) => n.toLocaleString("en-US");

export const metadata: Metadata = {
  title: "Receipt Drop",
  description: `The official ${project.name} Receipt Drop: the main drop on X in ${xr.count} rounds (${xr.winners} × ${fmt(xr.each)} ${cashtag} per round, plus ${fmt(d.x.airdrop.each)} for the first ${d.x.airdrop.wallets} accounts) and a separate Telegram drop. Rules, entry and how winners are picked.`,
  alternates: { canonical: "/drop" },
};

const link = "underline";

export default function DropPage() {
  const tg = (project.links.telegram ?? "").replace("https://", "");
  return (
    <Shell>
      <div className="mx-auto max-w-[1280px] px-4 pt-10 sm:px-6 sm:pt-14">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.28em] text-fog uppercase">{project.name} · receipt drop · official rules</p>
            <h1 className="mt-3 max-w-[18ch] text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-paper [font-stretch:112.5%]">
              The drop has receipts too.
            </h1>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-paper/80">
              {project.name} gives part of the creator&apos;s own launch buy to the community — the main drop on X and a separate one in Telegram. Tokens
              are <strong className="text-paper">sent</strong> to your address. There is no claim site, no wallet connect, no signature and no fee —
              anything asking for that is a scam.
            </p>
            <DropCount />
          </div>
          <Mascot expr="happy" pose="point" dark className="hidden h-auto w-[170px] lg:block" />
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-[900px] px-2 pb-20 sm:px-4">
        <article className="paper edge-both px-5 pt-12 pb-16 shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] sm:px-12">
          <section aria-labelledby="x">
            <SectionHead n="01" id="x" title="The X drop" kicker={d.status === "open" ? "Main · open" : "Closed"} />
            <div className="border-2 border-ink p-4 sm:p-6">
              <Row label={`Rounds — every X drop post (${xr.count})`} value={`${xr.winners} × ${fmt(xr.each)} ${cashtag} from its replies`} />
              <Row label={`Airdrop — first ${d.x.airdrop.wallets} accounts`} value={`${fmt(d.x.airdrop.each)} ${cashtag} each`} />
              <Row label="X drop total" value={`${fmt(d.x.tokens)} ${cashtag}`} strong />
            </div>
            <ol className="mt-6 space-y-3 text-[14.5px] leading-relaxed">
              <li>
                <strong>1.</strong> Follow{" "}
                <a className={link} href={project.links.x ?? "#"} target="_blank" rel="noopener noreferrer">
                  @chekcoinsol
                </a>{" "}
                and repost a drop post.
              </li>
              <li>
                <strong>2.</strong> Reply to that post with your <strong>public</strong> Solana address. Every drop post is its own round — a reply under a new round is a new ticket.
              </li>
              <li>
                <strong>3.</strong> Copy the link to your reply (Share → Copy link) and paste it below.
              </li>
            </ol>
            <XDropForm />
            <DropCount which="x" />
            <p className="mt-3 text-[12px] text-faded">
              Checked automatically from the public post: it is a direct reply to @chekcoinsol, written after the drop opened, with a valid Solana
              address. One entry per account per round; one address per account. Follow and repost are asked, not checked.
            </p>
          </section>

          <section className="pt-14" aria-labelledby="results">
            <SectionHead n="02" id="results" title="X rounds — results" kicker="Live" />
            <p className="mb-5 max-w-[62ch] text-[13.5px] leading-relaxed text-faded">
              Each round closes 24 hours after its post and is drawn right after. Winners are announced here and on X; tokens are sent after{" "}
              {cashtag} launches.
            </p>
            <DropResults />
          </section>

          <section className="pt-14" aria-labelledby="telegram">
            <SectionHead n="03" id="telegram" title="The Telegram drop" kicker="Separate" />
            <div className="border-2 border-ink p-4 sm:p-6">
              <Row label={`Airdrop — first ${d.telegram.airdrop.wallets} valid entries`} value={`${fmt(d.telegram.airdrop.each)} ${cashtag} each`} />
              <Row label={`Draw — ${tgd.winners} random entries`} value={`${fmt(tgd.each)} ${cashtag} each`} />
              <Row label="Telegram drop total" value={`${fmt(d.telegram.tokens)} ${cashtag}`} strong />
            </div>
            <ol className="mt-6 space-y-3 text-[14.5px] leading-relaxed">
              <li>
                <strong>1.</strong> Subscribe to the channel{" "}
                <a className={link} href={project.links.telegram ?? "#"} target="_blank" rel="noopener noreferrer">
                  {tg}
                </a>
                .
              </li>
              <li>
                <strong>2.</strong> Write your <strong>public</strong> Solana address in the comments under the pinned drop post — or send it to{" "}
                <a className={link} href="https://t.me/chekcoinsol_bot" target="_blank" rel="noopener noreferrer">
                  @chekcoinsol_bot
                </a>
                . The bot marks a valid entry with 👍.
              </li>
            </ol>
            <DropCount which="telegram" />
            <p className="mt-3 text-[12px] text-faded">
              One address per Telegram account, channel subscribers only. Separate list and separate draw — you can enter both drops.
            </p>
          </section>

          <section className="pt-14" aria-labelledby="pool">
            <SectionHead n="04" id="pool" title="Where it comes from" kicker="0% team" />
            <div className="border-2 border-ink p-4 sm:p-6">
              <Row label="X drop" value={`${fmt(d.x.tokens)} ${cashtag}`} />
              <Row label="Telegram drop" value={`${fmt(d.telegram.tokens)} ${cashtag}`} />
              <Row label="Total pool" value={`${fmt(d.poolTokens)} ${cashtag} (${d.poolPctSupply} of supply)`} strong />
              <Row label="Source" value="the creator wallet's own launch buy" />
              <Row label="Cost to enter" value="0" />
            </div>
            <p className="mt-3 text-[12px] text-faded">Only if {cashtag} launches. Free team allocation stays 0% — the drop comes out of a normal purchase.</p>
          </section>

          <section className="pt-14" aria-labelledby="draw">
            <SectionHead n="05" id="draw" title="How winners are picked" kicker="Re-checkable" />
            <p className="max-w-[62ch] text-[14.5px] leading-relaxed">
              Each X round closes 24 hours after its post. The Telegram drop closes 24 hours after launch. The seed is the blockhash of the first Solana block
              with a block time at or after the close; every entered address gets the score sha256(blockhash + &quot;:&quot; + address) and the lowest scores win
              (5 per X round). The addresses and the block are published, so anyone can re-run it and get the same winners. The airdrops go to the first valid
              accounts in the order they entered.
            </p>
          </section>

          <section className="pt-14" aria-labelledby="send">
            <SectionHead n="06" id="send" title="How tokens arrive" kicker="Receipts" />
            <p className="max-w-[62ch] text-[14.5px] leading-relaxed">
              The creator wallet sends the tokens after launch — within 48 hours of the launch or of the draw, whichever is later. Every transfer is published on the{" "}
              <a className={link} href="/receipts">
                Receipt Board
              </a>{" "}
              as an on-chain receipt: address, amount, transaction. Never send a seed phrase or private key — nobody needs it to send you tokens.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-5">
              <Stamp rotate={-4} className="text-base">No claim site</Stamp>
              <Stamp rotate={3} className="text-base">No DMs</Stamp>
              <Stamp rotate={-2} className="text-base">No fees</Stamp>
            </div>
          </section>
        </article>
      </div>
    </Shell>
  );
}
