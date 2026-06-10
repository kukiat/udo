import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getCurrentUser, canAccess } from "@/lib/auth";
import { errorResponse, parseBody } from "@/lib/api";

// Chat-with-your-report agent. Receives the report the dashboard is currently
// showing plus the conversation so far, and streams back a plain-text answer.
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const bodySchema = z.object({
  branchName: z.string().optional(),
  range: z.object({ from: z.string(), to: z.string() }).optional(),
  // The SalesReport JSON the page already fetched — passed as grounding context.
  report: z.unknown().optional(),
  messages: z.array(messageSchema).min(1).max(40),
});

const MODEL = "claude-opus-4-8";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);
  if (!canAccess("reports", user.role)) {
    return errorResponse("FORBIDDEN", "No access to reports", 403);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return errorResponse(
      "AGENT_NOT_CONFIGURED",
      "The reports agent is not configured. Set ANTHROPIC_API_KEY in the server environment.",
      503,
    );
  }

  const { data, error } = await parseBody(req, bodySchema);
  if (error) return error;

  const systemText = [
    "You are the sales-reporting assistant embedded in a restaurant management dashboard.",
    "Answer questions about the sales report data the user is currently viewing.",
    "Be concise and direct. Use the figures in the JSON below — do not invent numbers.",
    "When you cite money, keep the currency/format the data uses. If the data can't",
    "answer a question, say so plainly and suggest what range or view would help.",
    "Format with short paragraphs or compact bullet lists; avoid LaTeX.",
    "",
    data.branchName ? `Branch: ${data.branchName}` : "",
    data.range ? `Date range: ${data.range.from} to ${data.range.to}` : "",
    "",
    "Current report data (JSON):",
    "```json",
    JSON.stringify(data.report ?? null),
    "```",
  ]
    .filter(Boolean)
    .join("\n");

  // The system prompt (instructions + the full report JSON) is byte-identical
  // across every follow-up question about the same report, so cache it: the
  // first question pays the ~1.25x write, every later one reads it at ~0.1x.
  // Render order is system -> messages, so this breakpoint covers the whole prefix.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
  ];

  // Multi-turn: also cache the conversation prefix. Marking the last message
  // writes [system + history + new question] to cache; on the next turn that
  // whole prefix is read back and only the newest question is billed in full.
  const messages: Anthropic.MessageParam[] = data.messages.map((m, i) => {
    if (i === data.messages.length - 1) {
      return {
        role: m.role,
        content: [
          {
            type: "text",
            text: m.content,
            cache_control: { type: "ephemeral" },
          },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        stream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });
        const final = await stream.finalMessage();
        // Verify caching: cache_read should be > 0 on every turn after the first.
        // If it stays 0, a silent invalidator changed the prefix (e.g. the report
        // JSON serialized in a different key order between requests).
        const u = final.usage;
        console.log(
          `[reports/agent] tokens input=${u.input_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0} output=${u.output_tokens}`,
        );
        controller.close();
      } catch (err) {
        console.error("POST /api/reports/agent stream", err);
        controller.enqueue(
          encoder.encode("\n\n[The agent hit an error. Please try again.]"),
        );
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
