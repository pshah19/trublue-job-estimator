import { TemplateLibrary } from "@/components/TemplateLibrary";
import { loadHistoryStats, loadTemplates } from "@/lib/data";
import { can } from "@/lib/role";
import { getRole } from "@/lib/serverRole";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const [role, templates, history] = await Promise.all([getRole(), loadTemplates(), loadHistoryStats()]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Job template library</h1>
        <p className="text-sm text-muted">Labor-hour knowledge base. Completed-job history is shown next to each template; changes always require owner approval.</p>
      </div>
      <TemplateLibrary templates={templates} history={history} editable={can(role).editSettings} />
    </div>
  );
}
