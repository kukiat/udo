import { randomUUID } from "node:crypto";

import { ServiceError } from "@/services/errors";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "restaurant";

export class UploadService {
  /**
   * Upload an image to the Supabase Storage bucket and return its public URL.
   * Throws BAD_REQUEST for an invalid file; a generic error (→ 500) when storage
   * is misconfigured or the upload fails.
   */
  async upload(file: unknown): Promise<{ url: string }> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    if (!(file instanceof File)) {
      throw new ServiceError("BAD_REQUEST", "No file provided", 400);
    }
    if (file.size > MAX_BYTES) {
      throw new ServiceError("BAD_REQUEST", "File exceeds 5 MB limit", 400);
    }

    const ext = EXT[file.type];
    if (!ext) throw new ServiceError("BAD_REQUEST", "Unsupported image type", 400);

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
      throw new Error(`Supabase upload failed ${uploadRes.status}: ${detail}`);
    }

    return {
      url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`,
    };
  }
}

export const uploadService = new UploadService();
