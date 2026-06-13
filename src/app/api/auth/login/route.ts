import { handleError, parseBody } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { login } from "@/services/auth";

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, loginSchema);
    if (error) return error;

    const user = await login(data);
    return Response.json({ user });
  } catch (err) {
    return handleError(err, "POST /api/auth/login");
  }
}
