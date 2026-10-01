// Consistency audit: every fact has ONE source; this checks that the built site, public docs and post drafts agree with it.
// Sources of truth: config/project.json, content/*.json, files on disk, brand/mascot.mjs, git.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXPRESSIONS, POSES } from "../../brand/mascot.mjs";
import { paths, readJson, ROOT } from "./content.mjs";
import { readmeInSync } from "./readme.mjs";

const OUT = join(ROOT, "website/out");

export function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

const count = (dir, re) => (existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => re.test(f)).length : 0);
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export function facts() {
  const p = readJson(paths.project);
  const x = readJson(paths.x).posts;
  const tg = readJson(paths.tg).posts;
  return {
    p,
    schedule: readJson(paths.schedule),
    history: readJson(paths.history).entries,
    pumpfun: readJson(join(ROOT, "content/pumpfun.json")),
    xPosts: x.length,
    tgPosts: tg.length,
    xQueue: x,
    tgQueue: tg,
    memes: count("content/memes", /\.png$/),
    mascotImages: count("content/mascot", /\.png$/),
    kitMoods: count("website/public/kit", /^chek-.*\.png$/),
    villains: count("website/public/kit", /^villain-.*\.png$/),
    expressions: EXPRESSIONS.length,
    poses: POSES.length,
  };
}

// Current-state texts (historical texts — build log entries and CHANGELOG — are dated statements and only get the phrase rules).
function corpus() {
  const pages = {};
  for (const [name, file] of [["home", "index.html"], ["history", "history.html"], ["transparency", "transparency.html"], ["kit", "kit.html"], ["404", "404.html"]]) {
    const f = join(OUT, file);
    if (existsSync(f)) pages[name] = { raw: readFileSync(f, "utf8"), text: visibleText(readFileSync(f, "utf8")) };
  }
  const docs = {};
  for (const f of readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".md"))) docs[`docs/${f}`] = readFileSync(join(ROOT, "docs", f), "utf8");
  docs["README.md"] = readFileSync(join(ROOT, "README.md"), "utf8");
  const drafts = {};
  for (const [file, kind] of [[paths.x, "x"], [paths.tg, "tg"]]) for (const post of readJson(file).posts) drafts[`${kind}:${post.id}`] = [post.text, ...(post.thread || [])].join("\n");
  drafts["pumpfun:description"] = readJson(join(ROOT, "content/pumpfun.json")).description;
  const historical = { "CHANGELOG.md": readFileSync(join(ROOT, "CHANGELOG.md"), "utf8") };
  for (const e of readJson(paths.history).entries) historical[`history:${e.date}:${e.title}`] = `${e.title}. ${e.detail ?? ""}`;
  return { pages, docs, drafts, historical };
}

export function audit() {
  const F = facts();
  const { p } = F;
  const C = corpus();
  const prelaunch = p.status !== "live";
  const results = [];
  const rule = (id, title, problems) => results.push({ id, title, ok: problems.length === 0, problems });
  const all = { ...Object.fromEntries(Object.entries(C.pages).map(([k, v]) => [`site:${k}`, v.text])), ...C.docs, ...C.drafts };

  if (!Object.keys(C.pages).length) {
    rule("build", "Built site present", ["website/out missing — run npm run build"]);
    return { results, facts: F };
  }

  // 1. Phrases that must never appear (wrong claims about other tokens, over-claiming proof)
  const BANNED = [
    [/\b(?:anything|anyone|any token|any \$?[A-Z]{3,6})\b[^.\n]{0,80}\b(?:is|are|be|selling)\b[^.\n]{0,30}\b(?:fake|scam)\b/i, "calls other same-name tokens fake/scam"],
    [/\bproves? it\b|\bgit history proves\b/i, "claims git history proves something"],
    [/nothing to buy/i, "says there is nothing to buy (other same-name tokens exist)"],
    [/claims without proof/i, "unverifiable counter"],
    [/links to something you can check/i, "claims every claim is linked (commit links are not public yet)"],
    [/neither does any/i, "implies all same-name tokens are fake"],
  ];
  const phraseProblems = [];
  for (const [where, text] of Object.entries({ ...all, ...C.historical })) for (const [re, why] of BANNED) if (re.test(text)) phraseProblems.push(`${where}: ${why} — “${text.match(re)[0]}”`);
  rule("phrases", "No false or over-claiming phrases", phraseProblems);

  // 2. Social + repo status: one value everywhere
  const home = C.pages.home.text;
  const soc = [];
  for (const [label, link, host] of [["X", p.links.x, "x.com/"], ["Telegram", p.links.telegram, "t.me/"], ["GitHub", p.links.github, "github.com/"]]) {
    const soon = new RegExp(`${label} · soon`).test(home);
    if (!link && !soon) soc.push(`${label}: not linked in config but home doesn't say “${label} · soon”`);
    if (link && soon) soc.push(`${label}: linked in config but home still says “soon”`);
    if (!link) for (const [k, v] of Object.entries(C.pages)) if (v.raw.includes(`href="https://${host}`)) soc.push(`${label}: not linked in config but site:${k} links to ${host}`);
  }
  const community = Boolean(p.links.x && p.links.telegram);
  const road = home.match(/X \+ Telegram accounts (done|next|now|later)/i)?.[1]?.toLowerCase();
  if (road !== (community ? "done" : "next")) soc.push(`roadmap “X + Telegram accounts” is “${road ?? "missing"}”, expected “${community ? "done" : "next"}”`);
  const join = home.match(/Join the community .{0,200}?(Opens before launch)?/i);
  if (!p.links.x && !p.links.telegram && !/Opens before launch/.test(home)) soc.push("utility “Join the community” should be PLANNED (opens before launch)");
  if (!p.links.github && !/goes public before launch/.test(C.pages.history?.text ?? "")) soc.push("history page should say the repository goes public before launch");
  void join;
  rule("socials", "X / Telegram / GitHub status identical everywhere", soc);

  // 3. Token + launch status
  const tok = [];
  if (prelaunch) {
    for (const k of ["home", "transparency"]) if (!/Not launched yet/i.test(C.pages[k].text)) tok.push(`site:${k} must show NOT LAUNCHED YET`);
    if (!/Status Pre-launch/i.test(home)) tok.push("home receipt header must show Status: Pre-launch");
    for (const [k, v] of Object.entries(C.pages)) {
      const m = v.text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g)?.filter((s) => /[0-9]/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s));
      if (m?.length) tok.push(`site:${k} shows an address-like string before launch: ${m[0]}`);
    }
    if (/View token/i.test(home)) tok.push("home shows VIEW TOKEN before launch");
    if (!/Launch platform Pump\.fun \(planned\)/i.test(home)) tok.push("tokenomics must say Launch platform: Pump.fun (planned)");
    if (!/PUMP\.FUN \(PLANNED\)/.test(C.pages.transparency.text)) tok.push("official record must say PUMP.FUN (PLANNED)");
    if (!/Total supply Published at launch/i.test(home)) tok.push("tokenomics Total supply must be “Published at launch”");
  } else {
    for (const k of ["home", "transparency"]) if (!C.pages[k].text.includes(p.token.ca)) tok.push(`site:${k} doesn't show the CA`);
  }
  if (!readmeInSync(p)) tok.push("README status block is out of sync with config (run syncReadme)");
  rule("token", "Token / launch status identical everywhere", tok);

  // 4. Name ≠ proof, stated where people look
  const np = [];
  if (!/not affiliated with this project/i.test(home)) np.push("home: missing the not-affiliated sentence");
  if (!/name or ticker (?:is not proof|proves nothing)/i.test(C.pages.transparency.text)) np.push("transparency: missing “a name or ticker is not proof”");
  if (!/names? prove nothing|name or ticker is not proof/i.test(C.drafts["x:x-018"])) np.push("x-018 launch post: missing names-prove-nothing line");
  if (!/name or ticker is not proof/i.test(C.drafts["tg:tg-007"])) np.push("tg-007 CA pin: missing name-or-ticker line");
  if (!/name or ticker is never proof/i.test(C.docs["README.md"])) np.push("README: missing name-or-ticker line");
  rule("names", "“A name or ticker is not proof” is stated on site, pins and README", np);

  // 5. Creator fee + platform values carry a date
  const fee = [];
  const feeRe = /(\d+\.\d+)%\s*(?:of (?:bonding-)?curve|to the coin creator|creator\b)/gi;
  for (const [where, text] of Object.entries(all)) for (const m of text.matchAll(feeRe)) if (`${m[1]}%` !== p.platform.creatorFee) fee.push(`${where}: “${m[0]}” ≠ ${p.platform.creatorFee}`);
  const checked = fmtDay(p.platform.checkedAt);
  if (!new RegExp(`as checked ${checked}`, "i").test(home)) fee.push(`home tokenomics: creator fee without “as checked ${checked}”`);
  for (const [where, text] of Object.entries(C.drafts)) if (/\d+\.\d+%/.test(text)) fee.push(`${where}: hard-coded percentage — use {{CREATOR_FEE}} (as checked {{FEE_CHECKED}})`);
  rule("fee", `Creator fee = ${p.platform.creatorFee} everywhere, dated`, fee);

  // 6. Supply wording
  const sup = [];
  for (const [k, v] of Object.entries(C.pages)) for (const m of v.text.matchAll(/[^.]*1,000,000,000[^.]*\./g)) if (prelaunch && !/standard|expected/i.test(m[0])) sup.push(`site:${k}: supply stated as fact before launch — “${m[0].trim().slice(0, 90)}”`);
  rule("supply", "Supply is only described as the expected Pump.fun standard before launch", sup);

  // 7. Counters
  const cnt = [];
  const want = [
    [/(?<![\w-])(\d+) X posts/g, F.xPosts, "X posts"],
    [/(?<![\w-])(\d+) Telegram posts/g, F.tgPosts, "Telegram posts"],
    [/(?<![\w-])(\d+) memes/g, F.memes, "memes"],
    [/(?<![\w-])(\d+) mascot images/g, F.mascotImages, "mascot images"],
    [/(?<![\w-])(\d+) (?:ready-made )?moods/g, F.kitMoods, "kit moods"],
    [/(?<![\w-])(\d+) (?:facial )?expressions/g, F.expressions, "expressions"],
    [/(?<![\w-])(\d+) (?:body )?poses/g, F.poses, "body poses"],
    [/(?<![\w-])(\d+) villains/g, F.villains, "villains"],
  ];
  for (const [where, text] of Object.entries({ ...all, ...C.historical })) for (const [re, n, what] of want) for (const m of text.matchAll(re)) if (Number(m[1]) !== n) cnt.push(`${where}: “${m[0]}” but there are ${n} ${what}`);
  // dated build-log text shown on the site is a historical record, not a current claim
  const histStrings = F.history.flatMap((e) => [e.title, e.detail, e.correction?.note].filter(Boolean).map((s) => visibleText(s)));
  const current = (text) => histStrings.reduce((t, s) => t.split(s).join(" "), text);
  for (const [where, text] of Object.entries(all)) if (/\b\d+ (?:automatic|automated) checks\b/i.test(current(text))) cnt.push(`${where}: hard-coded check count — the only source is content/checks.json`);
  const kitImgs = (C.pages.kit?.raw.match(/src="\/kit\/chek-[a-z]+\.png"/g) ?? []).length;
  if (kitImgs !== F.kitMoods) cnt.push(`kit page shows ${kitImgs} moods, files: ${F.kitMoods}`);
  rule("counts", "Counters match the files", cnt);

  // 8. Dates
  const dt = [];
  const since = fmtDay(p.publicSince).toUpperCase();
  if (!home.toUpperCase().includes(`PUBLIC SINCE ${since}`)) dt.push(`home must show Public since ${since}`);
  const first = F.history[0];
  if (first && !C.pages.history.text.toUpperCase().includes(`STARTED ${fmtDay(first.date.slice(0, 10)).toUpperCase()}`)) dt.push("history page Started ≠ first build-log entry");
  const now = Date.now();
  let prev = "";
  for (const e of F.history) {
    if (Date.parse(e.date) > now) dt.push(`build log entry in the future: ${e.date} ${e.title}`);
    if (e.date < prev) dt.push(`build log not append-only/chronological at ${e.date}`);
    if (e.date.slice(0, 10) < p.publicSince) dt.push(`build log entry before public start: ${e.date}`);
    prev = e.date;
  }
  const proposed = new Date(F.schedule.proposedLaunchAt).toISOString().slice(0, 16).replace("T", " ");
  for (const [where, text] of Object.entries(C.docs)) for (const m of text.matchAll(/(2026-\d{2}-\d{2}) (\d{2}:\d{2}) UTC/g)) if (/propos|launch D6/i.test(text.slice(Math.max(0, m.index - 60), m.index)) && `${m[1]} ${m[2]}` !== proposed) dt.push(`${where}: proposed launch ${m[1]} ${m[2]} ≠ schedule ${proposed}`);
  rule("dates", "Dates and timestamps agree", dt);

  // 9. Receipts exist: every commit hash named in the build log is in git
  const rc = [];
  for (const e of F.history) {
    const h = e.proof?.label?.match(/commit ([0-9a-f]{7,40})/)?.[1];
    if (!h) continue;
    try {
      execFileSync("git", ["cat-file", "-e", `${h}^{commit}`], { cwd: ROOT, stdio: "ignore" });
    } catch {
      rc.push(`build log “${e.title}” names commit ${h}, which is not in this repository`);
    }
  }
  rule("receipts", "Every commit named in the build log exists", rc);

  // 10. Pump.fun form data = config
  const pf = [];
  if (F.pumpfun.name !== p.name) pf.push(`pumpfun.json name ${F.pumpfun.name} ≠ ${p.name}`);
  if (F.pumpfun.ticker !== p.ticker) pf.push(`pumpfun.json ticker ${F.pumpfun.ticker} ≠ ${p.ticker}`);
  if (F.pumpfun.description.length >= 2000) pf.push("description ≥ 2000 chars");
  if (!F.pumpfun.description.includes((p.links.website || "").replace(/^https?:\/\//, ""))) pf.push("description doesn't name the official website");
  if (F.pumpfun.mayhemMode !== false) pf.push("Mayhem mode must be OFF");
  rule("pumpfun", "Pump.fun form data matches config", pf);

  return { results, facts: F };
}
