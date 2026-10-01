import { IconExternal } from "./icons";
import { ca, formatUtc, isLive, project, verifyLinks, walletUrl } from "@/lib/project";

// The verifiable facts, in one place. Used on the home page and /transparency.
export function OfficialRecord({ className = "" }: { className?: string }) {
  const t = project.token;
  const rows: [string, React.ReactNode][] = [
    ["Contract", ca ? <code className="break-all">{ca}</code> : <span className="text-stamp">NOT LAUNCHED YET</span>],
    ["Network", project.network.toUpperCase()],
    ["Created", t.createdAt ? formatUtc(t.createdAt, true) : "—"],
    ["Launch platform", t.launchPlatform.toUpperCase()],
    [
      "Creator wallet",
      t.creatorWallet ? (
        <a className="break-all underline underline-offset-2" href={walletUrl(t.creatorWallet)} target="_blank" rel="noopener noreferrer">
          {t.creatorWallet}
        </a>
      ) : (
        "— (published at launch)"
      ),
    ],
    [
      "Treasury wallet",
      t.treasuryWallet ? (
        <a className="break-all underline underline-offset-2" href={walletUrl(t.treasuryWallet)} target="_blank" rel="noopener noreferrer">
          {t.treasuryWallet}
        </a>
      ) : (
        "None"
      ),
    ],
    ["Mint authority", t.mintAuthority ?? "— (checked at launch)"],
    ["Freeze authority", t.freezeAuthority ?? "— (checked at launch)"],
  ];
  return (
    <div className={`relative bg-ink p-5 text-paper sm:p-7 ${className}`}>
      <div className="text-[10px] font-bold tracking-[0.3em] text-fog uppercase">Official record</div>
      <dl className="mt-4 space-y-3 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_1fr] gap-3 border-b border-paper/15 pb-3 sm:grid-cols-[160px_1fr]">
            <dt className="text-[11px] font-semibold tracking-[0.18em] text-fog uppercase">{k}</dt>
            <dd className="min-w-0 font-semibold tracking-[0.04em]">{v}</dd>
          </div>
        ))}
      </dl>
      {!isLive && (
        <p className="mt-5 text-[12px] leading-relaxed text-fog">
          Links to Solscan, Solana Explorer, RugCheck, DexScreener and Bubblemaps appear here the minute the token exists.
        </p>
      )}
      {ca && (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {verifyLinks(ca).map((l) => (
            <li key={l.name}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between border border-paper/25 px-3 py-2 text-[12px] font-bold tracking-[0.1em] uppercase hover:bg-paper hover:text-ink"
              >
                {l.name} <IconExternal className="size-3.5" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
