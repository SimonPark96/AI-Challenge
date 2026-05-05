import OpenAI from "openai";

let cached: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY 가 설정되지 않았습니다. .env.local 에 추가하세요."
    );
  }
  if (!cached) cached = new OpenAI();
  return cached;
}
