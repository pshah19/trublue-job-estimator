import { Wizard } from "@/components/estimate/Wizard";
import { isAiAvailable } from "@/lib/ai/client";
import { loadEngineSettings, loadHistoryStats, loadPriceBook, loadTemplates } from "@/lib/data";
import { loadCustomerOptions } from "@/lib/pageData";
import { getRole } from "@/lib/serverRole";

export const dynamic = "force-dynamic";

export default async function NewEstimatePage() {
  const [role, settings, templates, priceBook, history, customers] = await Promise.all([
    getRole(),
    loadEngineSettings(),
    loadTemplates(),
    loadPriceBook(),
    loadHistoryStats(),
    loadCustomerOptions(),
  ]);
  return <Wizard role={role} settings={settings} templates={templates} priceBook={priceBook} history={history} customers={customers} aiAvailable={isAiAvailable()} />;
}
