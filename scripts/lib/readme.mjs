// README status table is generated from config/project.json so it can never disagree with the site.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./content.mjs";

const START = "<!-- status:start (generated from config/project.json — do not edit by hand) -->";
const END = "<!-- status:end -->";

export function statusTable(p) {
  const live = p.status === "live" && p.token.ca;
  const day = new Date(`${p.publicSince}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  return [
    START,
    "| | |",
    "|---|---|",
    `| **What is ${p.name}** | A meme coin project on ${p.network} with one rule: every claim comes with a receipt. The mascot, ${p.mascot}, is a slip of thermal paper that only prints what it can prove. |`,
    `| **Current status** | **${live ? "LIVE" : "PRE-LAUNCH"}** |`,
    `| **Official website** | ${p.links.website} |`,
    `| **Token** | **${live ? `LAUNCHED on ${p.token.launchPlatform}` : "NOT LAUNCHED"}** |`,
    `| **Contract address (CA)** | ${live ? `\`${p.token.ca}\`` : "**DOES NOT EXIST YET**"} |`,
    `| **Public since** | ${day} (UTC) |`,
    ...(live ? [] : ["", `> The official ${p.name} token has not launched yet. Any token using this name or ticker before our launch is not affiliated with this project.`]),
    END,
  ].join("\n");
}

const file = join(ROOT, "README.md");

export function readmeInSync(p) {
  const s = readFileSync(file, "utf8");
  const a = s.indexOf(START);
  const b = s.indexOf(END);
  return a >= 0 && b > a && s.slice(a, b + END.length) === statusTable(p);
}

export function syncReadme(p) {
  let s = readFileSync(file, "utf8");
  const a = s.indexOf(START);
  const b = s.indexOf(END);
  if (a < 0 || b < a) throw new Error("README has no status markers");
  s = s.slice(0, a) + statusTable(p) + s.slice(b + END.length);
  writeFileSync(file, s);
}
