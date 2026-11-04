import { loadCustomerDoc } from "@/lib/customerDoc";
import { renderEstimatePdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await loadCustomerDoc(id);
  if (!doc) return new Response("Not found", { status: 404 });
  const pdf = await renderEstimatePdf(doc);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.number}.pdf"`,
    },
  });
}
