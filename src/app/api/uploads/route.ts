import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { badRequest, serverError } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Accepts a multipart form with a single "file" field, stores it under
// public/uploads, and returns its public URL. Phase 1 used URL-only inputs;
// this replaces that with real local uploads.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("No file provided");
    if (file.size > MAX_BYTES) return badRequest("File exceeds 5 MB limit");

    const ext = EXT[file.type];
    if (!ext) return badRequest("Unsupported image type");

    const bytes = Buffer.from(await file.arrayBuffer());
    const filename = `${randomUUID()}.${ext}`;
    const dest = path.join(process.cwd(), "public", "uploads", filename);
    await writeFile(dest, bytes);

    return Response.json({ url: `/uploads/${filename}` }, { status: 201 });
  } catch (err) {
    console.error("POST /api/uploads", err);
    return serverError();
  }
}
