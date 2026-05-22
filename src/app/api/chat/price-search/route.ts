import { getOpenAIClient } from "@/lib/openai/client";
import { buildPriceSearchContext } from "@/lib/quote/price-search-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  messages?: ChatMsg[];
}

const MAX_HISTORY = 30;
const MAX_HINT_TURNS = 4; // prefetch hint 에 합쳐 쓸 최근 user 메시지 수

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const cleaned = messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== ""
    )
    .slice(-MAX_HISTORY);

  if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== "user") {
    return new Response("messages must end with a user message", {
      status: 400,
    });
  }

  // 검색 힌트 = 최근 user 메시지들을 합친 문자열 (후속 답변 "2호" 만 와도 직전 컨텍스트 살림)
  const recentUserMessages = cleaned
    .filter((m) => m.role === "user")
    .slice(-MAX_HINT_TURNS)
    .map((m) => m.content);
  const hint = recentUserMessages.join(" ");

  const ctx = await buildPriceSearchContext(hint);

  const client = getOpenAIClient();
  const stream = await client.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    temperature: 0.2,
    messages: [
      { role: "system", content: ctx.systemPrompt },
      ...cleaned.map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const t = chunk.choices[0]?.delta?.content;
          if (t) controller.enqueue(encoder.encode(t));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[ERROR] ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
