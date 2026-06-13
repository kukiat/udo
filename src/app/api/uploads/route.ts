import { handleError } from "@/lib/api";
import { uploadImage } from "@/services/uploads";

// Accepts a multipart form with a single "file" field, uploads it to the
// Supabase Storage "restaurant" bucket, and returns its public URL.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const result = await uploadImage(form.get("file"));
    return Response.json(result, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/uploads");
  }
}
