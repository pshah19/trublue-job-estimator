import { round2, sum } from "./money";
import type {
  EngineSettings,
  LaborProfile,
  LaborRateBreakdown,
  LaborResult,
  Role,
  TaskInput,
  TaskResult,
  TravelInput,
} from "./types";
import { ROLES } from "./types";

/**
 * Loaded Labor Cost per hour = Wage + Payroll taxes + Workers comp + Other burden + Benefits.
 * This is what an hour of the employee COSTS the business — never confuse it with billingRate.
 */
export function loadedRate(p: LaborProfile): LaborRateBreakdown {
  const payrollTax = round2(p.hourlyWage * p.payrollTaxPct);
  const workersComp = round2(p.hourlyWage * p.workersCompPct);
  const otherBurden = round2(p.hourlyWage * p.otherBurdenPct);
  const benefits = round2(p.benefitsPerHour);
  return {
    role: p.role,
    name: p.name,
    wage: round2(p.hourlyWage),
    payrollTax,
    workersComp,
    benefits,
    otherBurden,
    loadedCost: round2(p.hourlyWage + payrollTax + workersComp + otherBurden + benefits),
    billingRate: round2(p.billingRate),
  };
}

export function rateTable(settings: EngineSettings): Record<Role, LaborRateBreakdown> {
  const out = {} as Record<Role, LaborRateBreakdown>;
  for (const role of ROLES) {
    const p = settings.laborProfiles.find((l) => l.role === role);
    out[role] = p
      ? loadedRate(p)
      : loadedRate({
          role,
          name: role,
          hourlyWage: 0,
          payrollTaxPct: 0,
          workersCompPct: 0,
          benefitsPerHour: 0,
          otherBurdenPct: 0,
          billingRate: 0,
        });
  }
  return out;
}

export function hoursPerUnit(t: TaskInput): number {
  switch (t.hoursBasis) {
    case "LOW":
      return t.hoursLow;
    case "HIGH":
      return t.hoursHigh;
    case "CUSTOM":
      return t.customHoursPerUnit ?? t.hoursTypical;
    default:
      return t.hoursTypical;
  }
}

function emptyRoles(): Record<Role, number> {
  return { LEAD: 0, TECH: 0, HELPER: 0 };
}

/** Tech hours = setup + quantity × productive hours/unit + cleanup (per crew member). */
export function computeTask(t: TaskInput, rates: Record<Role, LaborRateBreakdown>): TaskResult {
  const hpu = hoursPerUnit(t);
  const techHours = round2(Math.max(0, t.setupHours) + Math.max(0, t.quantity) * hpu + Math.max(0, t.cleanupHours));
  const crew = t.crew.length ? t.crew : (["LEAD"] as Role[]);
  const byRole = emptyRoles();
  let laborCost = 0;
  let billable = 0;
  for (const role of crew) {
    byRole[role] = round2(byRole[role] + techHours);
    laborCost += techHours * rates[role].loadedCost;
    billable += techHours * rates[role].billingRate;
  }
  return {
    id: t.id,
    name: t.name,
    hoursPerUnit: hpu,
    techHours,
    crewHours: round2(techHours * crew.length),
    laborCost: round2(laborCost),
    billableValue: round2(billable),
    byRole,
  };
}

export function computeLabor(
  tasks: TaskInput[],
  procurementHours: number,
  travel: TravelInput,
  settings: EngineSettings,
): LaborResult {
  const rates = rateTable(settings);
  const taskResults = tasks.map((t) => computeTask(t, rates));

  const hoursByRole = emptyRoles();
  for (const tr of taskResults) for (const r of ROLES) hoursByRole[r] = round2(hoursByRole[r] + tr.byRole[r]);

  // Procurement: lead tech time to source/pick up materials.
  const procHours = round2(Math.max(0, procurementHours));
  const procCost = round2(procHours * rates.LEAD.loadedCost);
  hoursByRole.LEAD = round2(hoursByRole.LEAD + procHours);

  // Travel labor: every distinct role on the job travels each visit.
  const crewRoles = new Set<Role>();
  tasks.forEach((t) => (t.crew.length ? t.crew : ["LEAD" as Role]).forEach((r) => crewRoles.add(r)));
  if (crewRoles.size === 0) crewRoles.add("LEAD");
  // Count crew members (max of each role across tasks) to avoid double-counting.
  const crewCount = emptyRoles();
  for (const t of tasks) {
    const c = emptyRoles();
    (t.crew.length ? t.crew : ["LEAD" as Role]).forEach((r) => (c[r] += 1));
    for (const r of ROLES) crewCount[r] = Math.max(crewCount[r], c[r]);
  }
  if (tasks.length === 0) crewCount.LEAD = 1;
  let travelCrewHours = 0;
  let travelCost = 0;
  if (travel.includeTravelLabor) {
    const perMember = Math.max(0, travel.travelHoursPerVisit) * Math.max(0, travel.visits);
    for (const r of ROLES) {
      if (crewCount[r] > 0) {
        const h = perMember * crewCount[r];
        travelCrewHours += h;
        travelCost += h * rates[r].loadedCost;
        hoursByRole[r] = round2(hoursByRole[r] + h);
      }
    }
  }

  const onSiteCrewHours = sum(taskResults.map((t) => t.crewHours));
  const onSiteDurationHours = sum(taskResults.map((t) => t.techHours));
  const totalCost = sum([...taskResults.map((t) => t.laborCost), procCost, round2(travelCost)]);
  const billableValue = sum(taskResults.map((t) => t.billableValue));

  return {
    rates,
    tasks: taskResults,
    procurement: { hours: procHours, cost: procCost },
    travel: { crewHours: round2(travelCrewHours), cost: round2(travelCost) },
    hoursByRole,
    onSiteCrewHours,
    onSiteDurationHours,
    totalCrewHours: round2(onSiteCrewHours + procHours + travelCrewHours),
    totalCost,
    billableValue,
  };
}
