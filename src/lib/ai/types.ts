// Client-safe types returned by the AI endpoints.
import type {
  MaterialInput,
  OtherCostInput,
  ScopeClarity,
  SubcontractorInput,
  TaskInput,
} from "../engine/types";

export interface PhotoFinding {
  photoIndex: number;
  photoId?: string;
  observed: string[];
  inferred: string[];
  unknown: string[];
}

export interface FollowUpQuestion {
  question: string;
  whyItMatters: string;
  priceImpact: "HIGH" | "MEDIUM" | "LOW";
}

export interface ScopeDraft {
  engine: string; // model id or "rule-based"
  notice: string; // e.g. why the fallback was used
  aiRunId?: string;
  jobTitle: string;
  summary: string;
  scopeClarity: ScopeClarity;
  needsClarification: boolean;
  tasks: TaskInput[];
  materials: MaterialInput[];
  otherCosts: OtherCostInput[];
  subcontractors: SubcontractorInput[];
  riskFactors: { key: string; note?: string }[];
  photoFindings: PhotoFinding[];
  questions: FollowUpQuestion[];
  assumptions: string[];
  exclusions: string[];
  dimensionsKnown: boolean;
  explanation: string[];
}

export interface ReviewCheck {
  question: string;
  status: "OK" | "CHECK" | "MISSING";
  note: string;
}

export interface ReviewResult {
  engine: string;
  notice: string;
  health: "GREEN" | "YELLOW" | "RED";
  confidence: "High" | "Medium" | "Low";
  confidenceScore: number;
  headline: string;
  potentialMissingCosts: string[];
  mainRisks: string[];
  recommendedChanges: { change: string; reason: string; suggestedHoursDelta: number | null }[];
  checklist: ReviewCheck[];
}
