import { randomUUID } from "node:crypto";

import { badRequest, serverError } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "restaurant";

// Accepts a multipart form with a single "file" field, uploads it to the
// Supabase Storage "restaurant" bucket, and returns its public URL.
export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error("POST /api/uploads: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return serverError();
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("No file provided");
    if (file.size > MAX_BYTES) return badRequest("File exceeds 5 MB limit");

    const ext = EXT[file.type];
    if (!ext) return badRequest("Unsupported image type");

    const objectPath = `${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/${BUCKET}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": file.type,
          "Cache-Control": "3600",
        },
        body: bytes,
      },
    );

    if (!uploadRes.ok) {
      const detail = await uploadRes.text();
      console.error("POST /api/uploads: Supabase upload failed", uploadRes.status, detail);
      return serverError();
    }

    const url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    return Response.json({ url }, { status: 201 });
  } catch (err) {
    console.error("POST /api/uploads", err);
    return serverError();
  }
}
