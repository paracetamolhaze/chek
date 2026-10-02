# Hash lookup (before → after the one-time sanitization)

See [repository-sanitization.md](repository-sanitization.md) for what was removed and why. Messages and moments are unchanged; this is a lookup, not evidence.

| Author time (UTC) | Before | Published | Commit |
|---|---|---|---|
| 2026-10-01T19:24:32Z | `39bcca1` | `c3b23b1` | initial project concept: CHEK ($CHEK) — the receipt that only prints what it can prove |
| 2026-10-01T19:24:36Z | `1c2ce13` | `8a36ac0` | website v0: static receipt site, build log page, Vercel deploy |
| 2026-10-01T19:36:42Z | `cb610de` | `69c7719` | add brand system: logo mark, villains, avatars, X header, token image, OG card, meme kit |
| 2026-10-01T19:36:44Z | `b30a175` | `70cdd40` | website v1: transparency page, meme kit, 404, manifest, sitemap |
| 2026-10-01T19:45:29Z | `f1f21c5` | `b468f1a` | performance: mascots as cached SVG files, no font-swap layout shift; pump.fun facts |
| 2026-10-01T19:54:22Z | `6e1ca55` | `a6a5feb` | content bank + launch dashboard |
| 2026-10-01T20:03:21Z | `c8564bb` | `c2c8748` | dashboard: fix commit/build steps on Windows (found in launch rehearsal) |
| 2026-10-01T20:10:31Z | `6270576` | `25446e6` | docs + pre-launch check: brand guide, tokenomics draft, launch plan, pump.fun facts, security, lore, checklist, owner runbook |
| 2026-10-01T20:12:18Z | `c3f3462` | `469fef4` | build log: content bank, rehearsal, checklist |
| 2026-10-01T21:24:44Z | `614c511` | `ba7ebc2` | audit pass: look-alike tokens are 'not affiliated', not 'fake'; consistency audit; public-repo prep |
| 2026-10-01T21:25:29Z | `b07632f` | `c1aaa41` | public-scan: rule description no longer matches its own pattern |
| 2026-10-01T21:26:01Z | `48fbf66` | `aaf885c` | public-scan: rule description no longer matches its own pattern |
| 2026-10-01T21:27:19Z | `d7aaa1b` | `ae287b7` | prepare-public-repo: optional --utc (same instants, hides local offset); verify by epoch time |
| 2026-10-01T21:28:01Z | `3a8df07` | `3c31626` | prepare-public-repo: mapping commit also in UTC with --utc |
| 2026-10-01T21:31:46Z | `db6a0ab` | `e5a58be` | build log: audit pass (check results from content/checks.json) |
| 2026-10-01T21:32:01Z | `4cbb491` | `b7cd39c` | changelog: don't quote the retired wording |
| 2026-10-01T22:00:05Z | `0ecb61d` | `547550c` | backend foundation: receipts, content queue, publisher, guards, agents, Telegram/X adapters, cron |
| 2026-10-01T22:12:51Z | `7e2c242` | `3dc1fa5` | site + command center: value proposition, Receipt Board, creator receipt, phased utility; mint calculator + preview |
| 2026-10-01T22:15:49Z | `ea7c98d` | `2db0695` | receipt image renderer (resvg, static OFL fonts) + /api/image |
| 2026-10-01T22:21:24Z | `af9b8dc` | `16682fc` | telegram turns itself on when the bot gets admin rights; backend rows in the pre-launch check |
| 2026-10-01T22:21:51Z | `398e6bb` | `609c50e` | build log: autopilot foundation, Receipt Board, receipt images, pre-launch check |
| 2026-10-01T23:45:35Z | `623c06c` | `ef9e3eb` | $CHEKD, @chekcoinsol, Receipt Generator, dry-run autopilot, launch-minute automation |
| 2026-10-01T23:48:41Z | `4645da7` | `c111168` | telegram owner claim valid 72 h; admin CLI |
| 2026-10-01T23:54:37Z | `13bf18d` | `cdb8d94` | build log: ticker decision, accounts, Receipt Generator, dry run; dashboard: creator wallet, launch arming, Pump.fun form card; token image + banner served for the phone |
| 2026-10-01T23:57:44Z | `7caeb00` | `1571ccc` | site: restore the $ in the token cashtag (lost in a text replacement) |
| 2026-10-02T00:00:41Z | `d92842a` | `f496b61` | dry-run report script; Telegram webhook health in the admin status |
| 2026-10-02T00:04:18Z | `fc265ec` | `5e60105` | pre-launch check: scheduler, webhook, owner link, PC agent, live gate rows; launch-sequence ids |
| 2026-10-02T00:04:56Z | `1ed7fcf` | `eb7d752` | X bio ≤ 160 chars |
| 2026-10-02T00:20:04Z | `46022c7` | `d9dedae` | PC agent uses the local Claude bridge (waits when busy); bot owner-link fix; owner ping; site URL read from config everywhere |
| 2026-10-02T00:20:22Z | `f04f28d` | `db69ffc` | domain: canonical website → https://www.chekcoinsol.xyz |
| 2026-10-02T00:27:14Z | `8212d3c` | `50a358f` | pre-launch engine: 3–5 X posts a day in total, exists → builds → used → launches; launch X fallback to the owner's Telegram; X status documented |
| 2026-10-02T00:29:48Z | `8ca1bce` | `be81161` | pre-launch check after the domain switch: 45 ok, 6 waiting on the owner, 0 failed |
| 2026-10-02T00:44:20Z | `92fab3e` | `ac47c91` | in-page links land the section heading right under the header; X via the owner's Telegram (one tap per post, threads part by part, 3 h expiry) |
| 2026-10-02T00:47:04Z | `6292185` | `68c038b` | public-repo disclosure wording: file contents changed only where personal data was removed |
