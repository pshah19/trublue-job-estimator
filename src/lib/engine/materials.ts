import { round2, sum } from "./money";
import type { EngineSettings, MaterialInput, MaterialsResult } from "./types";

/**
 * Material Cost          = Quantity × Unit Cost × (1 + Waste Factor)
 * Material Selling Price = Material Cost × (1 + Markup)
 * Customer-supplied materials cost the business nothing (but add risk).
 * Lines with no verified unit cost are flagged — never silently priced.
 */
export function computeMaterials(materials: MaterialInput[], settings: EngineSettings): MaterialsResult {
  const lines = materials.map((m) => {
    const markupPct = m.markupPct ?? settings.materialMarkupPct;
    const priceMissing = !m.customerSupplied && (m.unitCost === null || m.unitCost === undefined);
    const unit = m.customerSupplied ? 0 : (m.unitCost ?? 0);
    const cost = round2(Math.max(0, m.quantity) * unit * (1 + Math.max(0, m.wastePct)));
    const sellingPrice = round2(cost * (1 + markupPct));
    return {
      id: m.id,
      name: m.name,
      quantity: m.quantity,
      unit: m.unit,
      unitCost: m.unitCost,
      wastePct: m.wastePct,
      markupPct,
      cost,
      sellingPrice,
      priceMissing,
      customerSupplied: m.customerSupplied,
      source: m.source,
      priceDate: m.priceDate,
    };
  });
  return {
    lines,
    totalCost: sum(lines.map((l) => l.cost)),
    totalSelling: sum(lines.map((l) => l.sellingPrice)),
    missingPriceCount: lines.filter((l) => l.priceMissing).length,
  };
}
