import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR } from "@/lib/ai/scopeBuilder";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("photos").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "No photos uploaded" }, { status: 400 });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const out = [];
  for (const f of files.slice(0, 10)) {
    if (!ALLOWED.has(f.type)) return NextResponse.json({ error: `Unsupported file type: ${f.type}` }, { status: 400 });
    if (f.size > MAX_BYTES) return NextResponse.json({ error: "Photo too large (max 8 MB)" }, { status: 400 });
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : f.type === "image/gif" ? "gif" : "jpg";
    const row = await prisma.photo.create({ data: { filename: "pending", mimeType: f.type } });
    const filename = `${row.id}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await f.arrayBuffer()));
    await prisma.photo.update({ where: { id: row.id }, data: { filename } });
    out.push({ id: row.id, url: `/api/photos/${row.id}` });
  }
  return NextResponse.json({ photos: out });
}
