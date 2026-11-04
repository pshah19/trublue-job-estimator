import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/ai/scopeBuilder";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.photo.findUnique({ where: { id } });
  if (!p) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, path.basename(p.filename)));
    return new Response(new Uint8Array(data), { headers: { "Content-Type": p.mimeType, "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
