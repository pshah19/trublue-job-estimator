# TruBlue Job Estimator — V1

An AI-assisted estimating copilot for on-demand handyman jobs. You describe a job, it builds the scope, and a deterministic engine prices it. You get three margin-based prices, live guardrails, a customer PDF, and estimate-vs-actual tracking.

Everyone runs the app **on their own computer**. Estimates are shared through this GitHub repo: pull before you start, push after you're done.

---

## 1. One-time setup

**You need:**
- [Node.js 20 or newer](https://nodejs.org) (check with `node -v`)
- [Git](https://git-scm.com/downloads)
- Access to this GitHub repo (ask the owner to add you as a collaborator)

**Then run:**

```bash
git clone https://github.com/pshah19/trublue-job-estimator.git
cd trublue-job-estimator
npm run setup
```

`npm run setup` installs the dependencies and creates your local `.env` file and database. It loads the job templates, the price book and some demo data, then imports every estimate already shared in the repo.

**Optional: turn on Claude.** Open `.env` and set `ANTHROPIC_API_KEY=sk-ant-...`. Claude then builds scopes, reads photos and reviews estimates. Without a key, the app uses a rule-based template matcher instead, and the screen says so. Every number is calculated the same way either way.

---

## 2. Every time you use it

### Start: pull the latest, then open the app

```bash
npm run dev
```

Before the app starts, `npm run dev` automatically:
1. **pulls the latest copy from GitHub**, so you see any estimates your teammates added,
2. updates your database if the code changed, and
3. imports all shared estimates.

Then open **http://localhost:3123**. The app uses port 3123 so it doesn't clash with other apps on port 3000.

If you're offline, or the pull fails, you'll see a yellow warning and the app starts with your local data.

### Finish: share your estimates

```bash
npm run sync
```

This pulls again, then commits your new and changed estimates and pushes them to GitHub, so your teammates get them the next time they run `npm run dev`.

> **Rule of thumb:** `npm run dev` when you sit down, `npm run sync` when you're done.

You can run `npm run sync` at any time, including while the app is running in another terminal.

---

## 3. What is and isn't shared

| Shared through GitHub | Stays on your computer |
|---|---|
| Estimates you create: every version, status (Sent/Won/Lost), customer and property details, recorded actuals | Business settings, labor rates, overhead |
| Photos attached to a saved estimate | Template and price-book edits |
| | AI audit log, your `.env` / API key |
| | Demo data (everyone already has the same demo data) |

Each estimate is saved as one file, `data/estimates/<id>.json`, and the app writes it automatically every time you save. Your local SQLite database (`prisma/dev.db`) is just a working copy. It is never committed and can be rebuilt from those files at any time.

**If two people save the same next estimate number** (for example both create TB-2026-0008 offline), the sync keeps the earlier one and renumbers the later one to the next free number. It prints a notice when it does this.

**If two people edit the *same* estimate before syncing**, the pull stops with a conflict warning, and your local data is left untouched. Fix it with `git pull` and choose which version to keep. Re-saving the estimate in the app afterwards refreshes the file.

> ⚠️ Because the repo holds customer names and addresses, keep it **private**.

---

## 4. Commands

| Command | What it does |
|---|---|
| `npm run setup` | First-time install, plus database and shared estimates |
| `npm run dev` | Pull latest and import, then start the app at http://localhost:3123 |
| `npm run sync` | Pull and import, then commit and push your estimates |
| `npm run dev:offline` | Start the app without pulling |
| `npm test` | Unit tests for the pricing engine and the rule-based matcher |
| `npm run db:reset` | Wipe the local database, re-seed it, and re-import the shared estimates. No shared estimates are lost. |
| `npm run build` / `npm start` | Production build (`npm start` also pulls first) |

### Troubleshooting
- **"Port 3123 is in use"**: the app is already running in another terminal. Use that one, or stop it with Ctrl+C.
- **"Could not pull"**: check your internet connection and GitHub access (`git pull` shows the full error).
- **Something looks wrong locally**: run `npm run db:reset`. Shared estimates come back from `data/estimates/`.

---

## 5. How it works

```
Customer → Service line → Describe (text / dictation / photos / templates)
        → AI or rule-based scope → editable tasks, materials, costs, risk
        → deterministic engine → 3 prices + guardrails → save (versioned)
        → customer estimate (HTML/PDF) → won/lost → record actuals → variance
```

| Module | Responsibility |
|---|---|
| `src/lib/engine/` | **All money math** (pure, unit-tested): loaded labor, materials (waste and markup), direct costs, overhead allocation (4 methods), risk/contingency, margin pricing, min-service floor, bundling, confidence score, variance |
| `src/lib/ai/` | Claude scope builder and reviewer (structured outputs, no dollar amounts), rule-based fallback, conversion into engine inputs |
| `src/lib/sharedData.ts` | Export and import of estimates as JSON files for sharing through git |
| `scripts/sync.ts` | The pull, import, commit and push steps behind `npm run dev` and `npm run sync` |
| `src/lib/scope.ts` | Template → task/material builders shared by the AI, the fallback, the UI and the seed |
| `src/data/` | Seed template library (68 templates) and demo price book. **All values are placeholders.** |
| `prisma/schema.prisma` | Full data model, including Senior/Recurring, change orders and acceptance tables for later phases |

### Pricing model
- `Price = Cost ÷ (1 − margin)`. This is margin, not markup.
- The margin targets apply to **risk-adjusted direct cost** (direct cost + contingency), so riskier jobs carry their contingency into the price.
- Each price shows three numbers:
  - **gross margin**: (price − direct cost) / price
  - **margin if the contingency is used**
  - **net contribution**: after allocated overhead and contingency
- Guardrails: Loss (below fully loaded cost), Margin warning (below minimum), Below target, On target, Premium.
- Floors: minimum service charge, and a minimum net margin after overhead.

### AI rules enforced in code
- The AI returns tasks, quantities, crew, risk keys and questions. It never returns prices. Template or history hours and price-book costs override AI suggestions. Unmatched hours are labeled "AI assumption".
- A material not in the price book is added as **Price needed**. Generating a customer estimate is blocked until it has a price.
- Photo findings are split into observed, inferred and unknown.
- Every save is an immutable version holding the inputs, the result, a settings snapshot and the AI reasoning.
- The server recomputes all numbers on save. It never trusts totals sent by the client.

### Roles (no login in V1)
The header switcher filters the view only; it is not security:
- **Owner**: sees everything and can edit settings and templates.
- **Estimator**: sees pricing and margin, but not labor burden.
- **Technician**: sees scope, hours and materials. No money is shown.

## Data caveats
All seeded labor times are marked **"Initial assumption — validate with actual TruBlue job history."** Demo prices are synthetic and labeled as demo. Demo customers and estimates are flagged and shown as **Synthetic demo data**.

## Not in V1
Senior and Recurring workflows (the data model is ready), change orders, vendor price integrations, advanced analytics, and automatic learning.
