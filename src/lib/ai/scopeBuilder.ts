import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db";
import type { HistoryStat, PriceEntry, TemplateRecord } from "../scope";
import { AI_MODEL, describeAiError, getClient, isAiAvailable } from "./client";
import { aiScopeToDraft } from "./convert";
import { ruleBasedScope } from "./fallback";
import { SCOPE_SYSTEM } from "./prompts";
import { AiScopeSchema, type AiScope } from "./schemas";
import type { ScopeDraft } from "./types";

export interface ScopeRequest {
  description: string;
  structured?: Record<string, string>;
  answers?: { question: string; answer: string }[];
  photoIds?: string[];
  property?: { propertyType?: string; ageBand?: string; occupied?: boolean; zip?: string };
  customerType?: string;
  estimateId?: string | null;
}

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function catalogText(templates: TemplateRecord[], priceBook: PriceEntry[], history: HistoryStat[]): string {
  const h = new Map(history.map((x) => [x.templateKey, x]));
  const t = templates
    .filter((x) => x.serviceLineId === "ON_DEMAND" || x.serviceLineId === "SENIOR")
    .map((x) => {
      const hs = h.get(x.key);
      return `${x.key} | ${x.name} | unit: ${x.unit} | ${x.typicalHoursPerUnit} hrs/unit typical (assumption) | crew ${x.crew.join("+")}${x.tradeFlags.length ? ` | trades: ${x.tradeFlags.join(",")}` : ""}${hs ? ` | history: ${hs.completedJobs} jobs, actual ${Math.round(hs.ratio * 100)}% of est` : ""}`;
    })
    .join("\n");
  const p = priceBook.map((x) => `${x.key} | ${x.name} | per ${x.unit}`).join("\n");
  return `JOB TEMPLATE CATALOG (key | name | unit | hours | crew):\n${t}\n\nPRICE BOOK MATERIALS (key | name | unit) — prices are held by the app, not shown to you:\n${p}`;
}

function userText(req: ScopeRequest, photoCount: number): string {
  const parts = [`Job description from the estimator:\n"""${req.description.trim() || "(none)"}"""`];
  const s = Object.entries(req.structured ?? {}).filter(([, v]) => v && v.trim());
  if (s.length) parts.push(`Structured details:\n${s.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`);
  const a = (req.answers ?? []).filter((x) => x.answer.trim());
  if (a.length) parts.push(`Answers to earlier follow-up questions:\n${a.map((x) => `Q: ${x.question}\nA: ${x.answer}`).join("\n")}`);
  const p = req.property ?? {};
  parts.push(
    `Property: type ${p.propertyType ?? "unknown"}, age band ${p.ageBand ?? "unknown"}, ${p.occupied === false ? "vacant" : "occupied"}. Customer type: ${req.customerType ?? "unknown"}.`,
  );
  parts.push(photoCount ? `${photoCount} job-site photo(s) attached above, indexed from 0 in order.` : "No photos supplied.");
  return parts.join("\n\n");
}

async function loadPhotos(ids: string[]): Promise<Anthropic.Beta.BetaImageBlockParam[]> {
  if (!ids.length) return [];
  const rows = await prisma.photo.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: Anthropic.Beta.BetaImageBlockParam[] = [];
  for (const id of ids.slice(0, 6)) {
    const r = byId.get(id);
    if (!r) continue;
    try {
      const data = await fs.readFile(path.join(UPLOAD_DIR, path.basename(r.filename)));
      out.push({
        type: "image",
        source: { type: "base64", media_type: r.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: data.toString("base64") },
      });
    } catch {
      /* missing file — skip */
    }
  }
  return out;
}

export async function buildScope(
  req: ScopeRequest,
  ctx: { templates: TemplateRecord[]; priceBook: PriceEntry[]; history: HistoryStat[] },
): Promise<ScopeDraft> {
  const photoIds = req.photoIds ?? [];
  let ai: AiScope | null = null;
  let engine = "rule-based";
  let notice = "";

  if (isAiAvailable()) {
    try {
      const images = await loadPhotos(photoIds);
      const msg = await getClient().beta.messages.parse({
        model: AI_MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: betaZodOutputFormat(AiScopeSchema) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          { type: "text", text: SCOPE_SYSTEM },
          { type: "text", text: catalogText(ctx.templates, ctx.priceBook, ctx.history), cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: [...images, { type: "text", text: userText(req, images.length) }] }],
      });
      if (msg.stop_reason === "refusal") notice = "Claude declined this request; used the rule-based template matcher instead.";
      else if (!msg.parsed_output) notice = "Claude's response couldn't be parsed; used the rule-based template matcher instead.";
      else {
        ai = msg.parsed_output;
        engine = msg.model ?? AI_MODEL;
      }
    } catch (e) {
      notice = `${describeAiError(e)} Used the rule-based template matcher instead.`;
    }
  } else {
    notice = "AI is not configured (no ANTHROPIC_API_KEY) — scope built with the rule-based template matcher. Photos were not analyzed.";
  }

  if (!ai) {
    const extra = [
      ...Object.values(req.structured ?? {}),
      ...(req.answers ?? []).map((a) => a.answer),
    ].join(". ");
    ai = ruleBasedScope(`${req.description}. ${extra}`, ctx.templates, photoIds.length);
  }

  const draft = aiScopeToDraft({
    ai,
    engine,
    notice,
    templates: ctx.templates,
    priceBook: ctx.priceBook,
    history: ctx.history,
    property: req.property,
    photoIds,
  });

  const run = await prisma.aiRun.create({
    data: {
      kind: "SCOPE",
      engine,
      estimateId: req.estimateId ?? null,
      inputJson: JSON.stringify({ ...req, photoCount: photoIds.length }),
      outputJson: JSON.stringify(ai),
      notice,
    },
  });
  draft.aiRunId = run.id;
  return draft;
}
