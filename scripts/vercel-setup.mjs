// One-time: create the Vercel project (static site, no functions, no env vars) and link it locally.
//   VERCEL_TOKEN_FILE=… node scripts/vercel-setup.mjs chekcoin
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TEAM, vercel } from "./vercel.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const NAME = process.argv[2] || "chekcoin";

let project = await vercel(`/v9/projects/${NAME}`);
if (project.status === 404) {
  project = await vercel("/v11/projects", {
    method: "POST",
    body: JSON.stringify({ name: NAME, framework: null, buildCommand: null, installCommand: null, outputDirectory: null }),
  });
  if (project.status >= 300) throw new Error(`create: ${project.status} ${JSON.stringify(project.body).slice(0, 300)}`);
  console.log("created project", NAME, project.body.id);
} else if (project.status < 300) {
  console.log("project exists", NAME, project.body.id);
} else {
  throw new Error(`lookup: ${project.status} ${JSON.stringify(project.body).slice(0, 300)}`);
}

mkdirSync(join(ROOT, ".vercel"), { recursive: true });
writeFileSync(join(ROOT, ".vercel", "project.json"), JSON.stringify({ orgId: TEAM, projectId: project.body.id, projectName: NAME }, null, 2));
console.log("linked → .vercel/project.json");
