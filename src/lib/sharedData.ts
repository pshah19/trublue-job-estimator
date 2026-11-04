// Shared estimate store: every real (non-demo) estimate is mirrored to data/estimates/<id>.json so it
// can be shared through git. SQLite stays the working database; these files are the source of truth
// between machines. `npm run sync` / `npm run dev` pull the repo and import these files.
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { EstimateInput, EstimateResult } from "./engine/types";
import { versionChildren } from "./estimates";

export const SHARED_DIR = path.join(process.cwd(), "data", "estimates");
export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const FORMAT = 1;

const fileFor = (id: string) => path.join(SHARED_DIR, `${id}.json`);
const iso = (d: Date) => d.toISOString();
const parse = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
};

type Snapshot = {
  format: number;
  estimate: { id: string; number: string; title: string; serviceLineId: string; status: string; currentVersion: number | null; createdAt: string; updatedAt: string };
  customer: { id: string; name: string; email: string; phone: string; customerType: string; existing: boolean; isDemo: boolean; createdAt: string };
  property: { id: string; address: string; zip: string; propertyType: string; ageBand: string; occupied: boolean; notes: string };
  versions: {
    id: string;
    version: number;
    note: string;
    selectedScenario: string;
    quotedPrice: number;
    priceOverridden: boolean;
    createdAt: string;
    input: EstimateInput;
    result: EstimateResult;
    settings: unknown;
    aiReasoning: unknown;
  }[];
  completedJob: null | {
    id: string;
    version: number | null;
    completedAt: string;
    actualMaterialCost: number;
    actualSubCost: number;
    actualOtherCost: number;
    finalRevenue: number;
    changeOrderRevenue: number;
    varianceReason: string;
    notes: string;
    result: unknown;
    createdAt: string;
    labor: { role: string; hours: number; employeeName: string }[];
    materials: { name: string; cost: number }[];
  };
  photos: { id: string; filename: string; mimeType: string; caption: string; findings: unknown; createdAt: string }[];
};

/** Write (or refresh) the shared JSON file for one estimate. Demo estimates are never exported. */
export async function exportEstimate(db: PrismaClient, id: string): Promise<void> {
  const e = await db.estimate.findUnique({
    where: { id },
    include: {
      customer: true,
      property: true,
      versions: { orderBy: { version: "asc" } },
      completedJob: { include: { labor: true, materials: true } },
      photos: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!e) return removeEstimateFile(id);
  if (e.isDemo) return;
  const versionNo = (vid: string | null | undefined) => e.versions.find((v) => v.id === vid)?.version ?? null;
  const cj = e.completedJob;
  const snap: Snapshot = {
    format: FORMAT,
    estimate: {
      id: e.id,
      number: e.number,
      title: e.title,
      serviceLineId: e.serviceLineId,
      status: e.status,
      currentVersion: versionNo(e.currentVersionId),
      createdAt: iso(e.createdAt),
      updatedAt: iso(e.updatedAt),
    },
    customer: {
      id: e.customer.id,
      name: e.customer.name,
      email: e.customer.email,
      phone: e.customer.phone,
      customerType: e.customer.customerType,
      existing: e.customer.existing,
      isDemo: e.customer.isDemo,
      createdAt: iso(e.customer.createdAt),
    },
    property: {
      id: e.property.id,
      address: e.property.address,
      zip: e.property.zip,
      propertyType: e.property.propertyType,
      ageBand: e.property.ageBand,
      occupied: e.property.occupied,
      notes: e.property.notes,
    },
    versions: e.versions.map((v) => ({
      id: v.id,
      version: v.version,
      note: v.note,
      selectedScenario: v.selectedScenario,
      quotedPrice: v.quotedPrice,
      priceOverridden: v.priceOverridden,
      createdAt: iso(v.createdAt),
      input: parse(v.inputJson),
      result: parse(v.resultJson),
      settings: parse(v.settingsJson),
      aiReasoning: parse(v.aiReasoningJson),
    })),
    completedJob: cj
      ? {
          id: cj.id,
          version: versionNo(cj.versionId),
          completedAt: iso(cj.completedAt),
          actualMaterialCost: cj.actualMaterialCost,
          actualSubCost: cj.actualSubCost,
          actualOtherCost: cj.actualOtherCost,
          finalRevenue: cj.finalRevenue,
          changeOrderRevenue: cj.changeOrderRevenue,
          varianceReason: cj.varianceReason,
          notes: cj.notes,
          result: parse(cj.resultJson),
          createdAt: iso(cj.createdAt),
          labor: cj.labor.map((l) => ({ role: l.role, hours: l.hours, employeeName: l.employeeName })),
          materials: cj.materials.map((m) => ({ name: m.name, cost: m.cost })),
        }
      : null,
    photos: e.photos.map((p) => ({ id: p.id, filename: p.filename, mimeType: p.mimeType, caption: p.caption, findings: parse(p.findingsJson), createdAt: iso(p.createdAt) })),
  };
  fs.mkdirSync(SHARED_DIR, { recursive: true });
  const next = JSON.stringify(snap, null, 2) + "\n";
  const file = fileFor(id);
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === next) return;
  fs.writeFileSync(file, next);
}

export function removeEstimateFile(id: string): void {
  fs.rmSync(fileFor(id), { force: true });
}

/** Export without failing the API request; problems are logged. */
export async function exportEstimateSafe(db: PrismaClient, id: string): Promise<void> {
  try {
    await exportEstimate(db, id);
  } catch (err) {
    console.error(`[shared-data] Could not write data/estimates/${id}.json:`, err);
  }
}

function readSnapshots(): { file: string; snap: Snapshot }[] {
  if (!fs.existsSync(SHARED_DIR)) return [];
  const out: { file: string; snap: Snapshot }[] = [];
  for (const name of fs.readdirSync(SHARED_DIR).sort()) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(SHARED_DIR, name);
    try {
      const snap = JSON.parse(fs.readFileSync(file, "utf8")) as Snapshot;
      if (snap?.format !== FORMAT || !snap.estimate?.id) throw new Error("unrecognized format");
      out.push({ file, snap });
    } catch (err) {
      console.warn(`[shared-data] Skipping ${name}: ${(err as Error).message}`);
    }
  }
  return out;
}

async function writeSnapshot(db: PrismaClient, s: Snapshot, number: string) {
  const e = s.estimate;
  await db.$transaction(async (tx) => {
    // Replace this estimate, and free its number if another (not-yet-reimported) estimate holds it.
    await tx.estimate.deleteMany({ where: { OR: [{ id: e.id }, { number, isDemo: false }] } }); // cascades versions, line items, actuals
    const c = s.customer;
    const customerData = { name: c.name, email: c.email, phone: c.phone, customerType: c.customerType, existing: c.existing, isDemo: c.isDemo };
    await tx.customer.upsert({ where: { id: c.id }, update: customerData, create: { id: c.id, ...customerData, createdAt: new Date(c.createdAt) } });
    const p = s.property;
    const propData = { address: p.address, zip: p.zip, propertyType: p.propertyType, ageBand: p.ageBand, occupied: p.occupied, notes: p.notes };
    await tx.property.upsert({ where: { id: p.id }, update: propData, create: { id: p.id, customerId: c.id, ...propData } });

    await tx.estimate.create({
      data: {
        id: e.id,
        number,
        title: e.title,
        serviceLineId: e.serviceLineId,
        status: e.status,
        customerId: c.id,
        propertyId: p.id,
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
      },
    });
    let currentVersionId: string | null = null;
    const idByVersion = new Map<number, string>();
    for (const v of s.versions) {
      await tx.estimateVersion.create({
        data: {
          id: v.id,
          estimateId: e.id,
          version: v.version,
          inputJson: JSON.stringify(v.input),
          resultJson: JSON.stringify(v.result),
          settingsJson: JSON.stringify(v.settings),
          aiReasoningJson: JSON.stringify(v.aiReasoning ?? {}),
          selectedScenario: v.selectedScenario,
          quotedPrice: v.quotedPrice,
          priceOverridden: v.priceOverridden,
          note: v.note,
          createdAt: new Date(v.createdAt),
          ...versionChildren(v.input, v.result),
        },
      });
      idByVersion.set(v.version, v.id);
      if (v.version === e.currentVersion) currentVersionId = v.id;
    }
    currentVersionId ??= s.versions.at(-1)?.id ?? null;
    await tx.estimate.update({ where: { id: e.id }, data: { currentVersionId, updatedAt: new Date(e.updatedAt) } });

    const cj = s.completedJob;
    if (cj) {
      await tx.completedJob.create({
        data: {
          id: cj.id,
          estimateId: e.id,
          versionId: (cj.version != null && idByVersion.get(cj.version)) || currentVersionId || "",
          completedAt: new Date(cj.completedAt),
          actualMaterialCost: cj.actualMaterialCost,
          actualSubCost: cj.actualSubCost,
          actualOtherCost: cj.actualOtherCost,
          finalRevenue: cj.finalRevenue,
          changeOrderRevenue: cj.changeOrderRevenue,
          varianceReason: cj.varianceReason,
          notes: cj.notes,
          resultJson: JSON.stringify(cj.result),
          createdAt: new Date(cj.createdAt),
          labor: { create: cj.labor },
          materials: { create: cj.materials },
        },
      });
    }
    for (const ph of s.photos) {
      const data = { estimateId: e.id, filename: ph.filename, mimeType: ph.mimeType, caption: ph.caption, findingsJson: JSON.stringify(ph.findings ?? {}) };
      await tx.photo.upsert({ where: { id: ph.id }, update: data, create: { id: ph.id, ...data, createdAt: new Date(ph.createdAt) } });
    }
  });
}

function bumpNumber(taken: Set<string>, year: string): string {
  let max = 0;
  for (const n of taken) {
    const m = n.match(/^TB-(\d{4})-(\d+)$/);
    if (m && m[1] === year) max = Math.max(max, Number(m[2]));
  }
  return `TB-${year}-${String(max + 1).padStart(4, "0")}`;
}

export type ImportReport = { imported: number; removed: number; renumbered: string[]; skipped: number; total: number };

/**
 * Bring the local database in line with data/estimates/*.json:
 *  - every file is (re)loaded,
 *  - non-demo estimates with no file are removed (they were deleted on another machine),
 *  - estimate-number clashes (two people created the same next number) are resolved by
 *    renumbering the later-created estimate and rewriting its file.
 */
export async function importSharedEstimates(db: PrismaClient): Promise<ImportReport> {
  const files = readSnapshots();
  const report: ImportReport = { imported: 0, removed: 0, renumbered: [], skipped: 0, total: files.length };
  const ids = new Set(files.map((f) => f.snap.estimate.id));

  const stale = await db.estimate.findMany({ where: { isDemo: false, id: { notIn: [...ids] } }, select: { id: true } });
  if (stale.length) {
    await db.estimate.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    report.removed = stale.length;
  }

  // Oldest first, so the earliest estimate keeps a contested number.
  files.sort((a, b) => a.snap.estimate.createdAt.localeCompare(b.snap.estimate.createdAt));
  const demoNumbers = (await db.estimate.findMany({ where: { isDemo: true }, select: { number: true } })).map((r) => r.number);
  const taken = new Set<string>(demoNumbers);
  for (const { snap } of files) {
    let number = snap.estimate.number;
    if (taken.has(number)) {
      const year = number.match(/^TB-(\d{4})-/)?.[1] ?? String(new Date(snap.estimate.createdAt).getFullYear());
      const fresh = bumpNumber(new Set([...taken, ...files.map((f) => f.snap.estimate.number)]), year);
      report.renumbered.push(`${number} → ${fresh} (${snap.estimate.title})`);
      number = fresh;
    }
    taken.add(number);
    try {
      const existing = await db.estimate.findUnique({ where: { id: snap.estimate.id }, select: { number: true, updatedAt: true, _count: { select: { versions: true } } } });
      const unchanged =
        existing &&
        existing.number === number &&
        existing.updatedAt.toISOString() === snap.estimate.updatedAt &&
        existing._count.versions === snap.versions.length;
      if (unchanged) continue;
      await writeSnapshot(db, snap, number);
      if (number !== snap.estimate.number) await exportEstimate(db, snap.estimate.id);
      report.imported += 1;
    } catch (err) {
      report.skipped += 1;
      console.warn(`[shared-data] Could not import ${snap.estimate.number}: ${(err as Error).message}`);
    }
  }
  return report;
}

/** Photo files referenced by shared estimates (relative to the repo root), for `git add`. */
export function sharedPhotoPaths(): string[] {
  return readSnapshots()
    .flatMap(({ snap }) => snap.photos.map((p) => path.join("data", "uploads", p.filename)))
    .filter((p) => fs.existsSync(path.join(process.cwd(), p)));
}
