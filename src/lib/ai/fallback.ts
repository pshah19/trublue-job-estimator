// Rule-based scope builder used when no ANTHROPIC_API_KEY is configured (or the API fails).
// It matches the description against job-template keywords. It never guesses prices,
// and it tells the estimator exactly what it could not determine.
import type { TemplateRecord } from "../scope";
import type { AiScope } from "./schemas";

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, two: 2, pair: 2, couple: 2, three: 3, few: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};

const DEFAULT_QTY_BY_UNIT: Record<string, number> = { "linear ft": 16, "sq ft": 50, ft: 10 };

const RISK_HINTS: { re: RegExp; key: string; reason: string }[] = [
  { re: /\btil(e|ed|ing)\b/, key: "TILE_WORK", reason: "Description mentions tile." },
  { re: /\b(leak|water damage|moisture|wet)\b/, key: "WATER_DAMAGE", reason: "Description mentions water/leak." },
  { re: /\b(rot|rotted|rotten|soft)\b/, key: "DETERIORATION", reason: "Description mentions rot/softness." },
  { re: /\b(behind the wall|inside the wall|in-wall|in wall)\b/, key: "HIDDEN_BEHIND_WALLS", reason: "Work inside walls." },
  { re: /\b(ladder|second story|2nd story|roof|two-story|high ceiling)\b/, key: "WORKING_AT_HEIGHT", reason: "Work at height mentioned." },
  { re: /\b(customer (has|bought|supplies|supplied|provides)|they (bought|have) the|customer-supplied)\b/, key: "CUSTOMER_SUPPLIED", reason: "Customer is supplying materials." },
  { re: /\b(crawl ?space|attic|tight space)\b/, key: "DIFFICULT_ACCESS", reason: "Tight/difficult access mentioned." },
  { re: /\b(not sure|unsure|maybe|something|figure out|look at)\b/, key: "UNCLEAR_SCOPE", reason: "Request is not specific." },
  { re: /\b(demo|demolish|tear out|gut)\b/, key: "COMPLEX_DEMOLITION", reason: "Demolition mentioned." },
];

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findQuantity(clause: string): number | null {
  const digit = clause.match(/\b(\d+(?:\.\d+)?)\b/);
  if (digit) return parseFloat(digit[1]);
  for (const w of clause.split(/\s+/)) {
    const n = NUMBER_WORDS[w.replace(/[^a-z]/g, "")];
    if (n && w !== "a" && w !== "an") return n;
  }
  if (/\b(a|an)\b/.test(clause)) return 1;
  return null;
}

export function ruleBasedScope(description: string, templates: TemplateRecord[], photoCount: number): AiScope {
  const text = description.toLowerCase().replace(/\s+/g, " ").trim();
  const clauses = text
    .split(/[.;\n]|,|\band also\b|\balso\b|\bplus\b|\bthen\b|\band\b/)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);

  const tasks: AiScope["tasks"] = [];
  const questions: AiScope["questions"] = [];
  const assumptions: string[] = [];
  const unmatched: string[] = [];

  for (const clause of clauses) {
    let best: { t: TemplateRecord; score: number } | null = null;
    for (const t of templates) {
      for (const kw of t.keywords) {
        if (new RegExp(`\\b${escapeRe(kw)}`).test(clause)) {
          const score = kw.length + (t.serviceLineId === "ON_DEMAND" ? 0.5 : 0);
          if (!best || score > best.score) best = { t, score };
        }
      }
    }
    if (!best) {
      if (clause.split(" ").length >= 2) unmatched.push(clause);
      continue;
    }
    const t = best.t;
    let qty = findQuantity(clause);
    if (qty == null) {
      qty = DEFAULT_QTY_BY_UNIT[t.unit] ?? 1;
      assumptions.push(`Assumed ${qty} ${t.unit} for "${t.name}" — quantity not stated.`);
      questions.push({ question: `How many ${t.unit}${qty === 1 ? "s" : ""} for "${t.name}"?`, whyItMatters: "Labor and materials scale with quantity.", priceImpact: "HIGH" });
    }
    tasks.push({
      name: t.name,
      description: clause.charAt(0).toUpperCase() + clause.slice(1),
      templateKey: t.key,
      quantity: qty,
      unit: t.unit,
      hoursPerUnitLow: t.lowHoursPerUnit,
      hoursPerUnitTypical: t.typicalHoursPerUnit,
      hoursPerUnitHigh: t.highHoursPerUnit,
      setupHours: t.setupHours,
      cleanupHours: t.cleanupHours,
      crew: t.crew,
      skill: t.skillLevel,
      tradeFlags: t.tradeFlags,
      complications: t.complications,
      dependsOn: [],
      hoursRationale: `Rule-based keyword match on "${clause}".`,
    });
    for (const q of t.questions.slice(0, 2))
      if (!questions.some((x) => x.question === q)) questions.push({ question: q, whyItMatters: `Affects the "${t.name}" estimate.`, priceImpact: "MEDIUM" });
  }

  for (const u of unmatched)
    questions.unshift({ question: `Couldn't match "${u}" to a job template — what exactly needs to be done?`, whyItMatters: "Unmatched work isn't estimated yet.", priceImpact: "HIGH" });

  const risks = RISK_HINTS.filter((h) => h.re.test(text)).map((h) => ({ key: h.key, reason: h.reason }));
  const clarity: AiScope["scopeClarity"] =
    tasks.length === 0 ? "UNCLEAR" : unmatched.length === 0 && questions.every((q) => q.priceImpact !== "HIGH") ? "CLEAR" : "SOMEWHAT_CLEAR";

  return {
    jobTitle: tasks.length === 1 ? tasks[0].name : tasks.length ? `${tasks.length}-item handyman visit` : "New job",
    summary: description.trim().slice(0, 300),
    scopeClarity: clarity,
    needsClarification: questions.some((q) => q.priceImpact === "HIGH") || tasks.length === 0,
    tasks,
    materials: [],
    otherCosts: [],
    subcontractors: [],
    riskFactors: risks,
    photoFindings: Array.from({ length: photoCount }, (_, i) => ({
      photoIndex: i,
      observed: [],
      inferred: [],
      unknown: ["Photo not analyzed — AI photo analysis requires an ANTHROPIC_API_KEY. Review the photo manually."],
    })),
    questions: questions.slice(0, 8),
    assumptions,
    exclusions: [],
  };
}
