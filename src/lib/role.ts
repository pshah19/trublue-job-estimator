export type AppRole = "OWNER" | "ESTIMATOR" | "TECHNICIAN";
export const ROLE_COOKIE = "tb_role";
export const ROLE_LABEL: Record<AppRole, string> = { OWNER: "Owner / Manager", ESTIMATOR: "Estimator", TECHNICIAN: "Technician" };

/** What each role may see. V1 has no login — this is a view filter, not security. */
export function can(role: AppRole) {
  return {
    seePricing: role !== "TECHNICIAN", // prices, margins, guardrails
    seeCosts: role !== "TECHNICIAN", // labor/material cost
    seeLaborBurden: role === "OWNER", // wages, burden, overhead config
    editSettings: role === "OWNER",
  };
}

export function parseRole(v: string | undefined): AppRole {
  return v === "ESTIMATOR" || v === "TECHNICIAN" ? v : "OWNER";
}
