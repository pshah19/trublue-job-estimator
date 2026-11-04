/* eslint-disable no-console */
// Keeps a local copy of the estimator in sync with the shared GitHub repo.
//
//   tsx scripts/sync.ts pull    → git pull, update DB schema, import shared estimates   (runs before `npm run dev`)
//   tsx scripts/sync.ts share   → pull + import, then commit & push your estimate files (`npm run sync`)
//
// Never fails hard on git problems (offline, no remote, conflicts): it warns and lets the app start.
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importSharedEstimates, sharedPhotoPaths } from "../src/lib/sharedData";

const mode = process.argv[2] === "share" ? "share" : "pull";
const root = process.cwd();
const DB_FILE = path.join(root, "prisma", "dev.db");

const c = { dim: "\x1b[2m", yellow: "\x1b[33m", green: "\x1b[32m", red: "\x1b[31m", bold: "\x1b[1m", reset: "\x1b[0m" };
const say = (msg: string) => console.log(`${c.bold}[sync]${c.reset} ${msg}`);
const warn = (msg: string) => console.log(`${c.bold}[sync]${c.reset} ${c.yellow}${msg}${c.reset}`);

function git(args: string[], opts: { quiet?: boolean } = {}) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 60_000 });
  if (!opts.quiet && r.stdout?.trim()) console.log(c.dim + r.stdout.trim() + c.reset);
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

function run(cmd: string) {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function pullLatest(): boolean {
  if (!git(["rev-parse", "--is-inside-work-tree"], { quiet: true }).ok) {
    warn("Not a git repository — skipping pull.");
    return false;
  }
  const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { quiet: true });
  if (!upstream.ok) {
    warn("This branch has no upstream on GitHub — skipping pull.");
    return false;
  }
  say(`Pulling latest from ${upstream.out} …`);
  const r = git(["pull", "--rebase", "--autostash"]);
  if (r.ok) return true;
  if (fs.existsSync(path.join(root, ".git", "rebase-merge")) || fs.existsSync(path.join(root, ".git", "rebase-apply"))) {
    git(["rebase", "--abort"], { quiet: true });
    warn("Pull hit a conflict (probably the same estimate edited on two machines). Your local copy was left unchanged.");
    warn("Resolve it with `git pull` manually, or ask for help. Starting with your local data.");
  } else {
    warn(`Could not pull (offline?): ${r.err.split("\n")[0] || "unknown error"}. Starting with your local data.`);
  }
  return false;
}

function ensureEnvFile() {
  const env = path.join(root, ".env");
  if (!fs.existsSync(env)) {
    fs.copyFileSync(path.join(root, ".env.example"), env);
    say("Created .env from .env.example (add ANTHROPIC_API_KEY there to turn on Claude).");
  }
}

function ensureDatabase() {
  ensureEnvFile();
  const fresh = !fs.existsSync(DB_FILE);
  say(fresh ? "No local database yet — creating it …" : "Checking database schema …");
  try {
    execSync("npx prisma db push --skip-generate", { cwd: root, stdio: fresh ? "inherit" : "pipe" });
    execSync("npx prisma generate", { cwd: root, stdio: "pipe" });
  } catch (err) {
    warn("Database schema update failed. Run `npm run db:push` to see the error.");
    throw err;
  }
  if (fresh) {
    say("Loading job templates, price book and demo data …");
    run("npx tsx prisma/seed.ts");
  }
}

async function importEstimates() {
  const db = new PrismaClient();
  try {
    const r = await importSharedEstimates(db);
    const changes = r.imported + r.removed;
    say(
      `${c.green}Shared estimates: ${r.total} in repo` +
        (changes ? ` · ${r.imported} updated · ${r.removed} removed` : " · already up to date") +
        c.reset,
    );
    for (const n of r.renumbered) warn(`Renumbered duplicate estimate number: ${n}`);
    if (r.skipped) warn(`${r.skipped} estimate file(s) could not be imported — see messages above.`);
    return r;
  } finally {
    await db.$disconnect();
  }
}

function shareEstimates() {
  const paths = ["data/estimates", ...sharedPhotoPaths()];
  fs.mkdirSync(path.join(root, "data", "estimates"), { recursive: true });
  git(["add", "-A", "--", "data/estimates"], { quiet: true });
  const photos = paths.slice(1);
  if (photos.length) git(["add", "-f", "--", ...photos], { quiet: true });
  const staged = git(["diff", "--cached", "--name-only", "--", ...paths], { quiet: true }).out;
  if (staged) {
    const who = git(["config", "user.name"], { quiet: true }).out || "unknown";
    const count = staged.split("\n").filter((f) => f.startsWith("data/estimates/")).length;
    const msg = `Update ${count} estimate file(s) — synced by ${who}`;
    const commit = git(["commit", "-m", msg, "--", ...paths]);
    if (!commit.ok) {
      warn(`Commit failed: ${commit.err.split("\n")[0]}`);
      return;
    }
    say(`Committed: ${msg}`);
  } else {
    say("No new estimate changes to commit.");
  }
  const ahead = git(["rev-list", "--count", "@{u}..HEAD"], { quiet: true });
  if (ahead.ok && ahead.out === "0") {
    say(`${c.green}Everything is already on GitHub.${c.reset}`);
    return;
  }
  say("Pushing to GitHub …");
  const push = git(["push"]);
  if (push.ok) say(`${c.green}Pushed. Your estimates are now available to everyone on the repo.${c.reset}`);
  else warn(`Push failed: ${push.err.split("\n")[0]}. Run \`npm run sync\` again once you're online.`);
}

async function main() {
  const pulled = pullLatest();
  ensureDatabase();
  await importEstimates();
  if (mode === "share") {
    if (!pulled) {
      const upstream = git(["rev-parse", "--abbrev-ref", "@{u}"], { quiet: true }).ok;
      if (!upstream) return warn("No GitHub remote configured — nothing to push.");
    }
    shareEstimates();
  }
}

main().catch((err) => {
  console.error(`${c.red}[sync] ${(err as Error).message}${c.reset}`);
  // Never block the app from starting because of a sync problem.
  process.exit(mode === "share" ? 1 : 0);
});
