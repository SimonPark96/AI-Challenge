import { getOpenAIClient } from "./client";

const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100; // OpenAI 배치 한도 안에서 충분히 안전

/**
 * 단일 텍스트 임베딩.
 */
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}

/**
 * 여러 텍스트를 한 번의 API 호출로 임베딩.
 * 배치 자동 분할 (>100건). 빈 텍스트는 대체 placeholder 로 처리.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getOpenAIClient();

  // 빈 문자열은 OpenAI 가 거부하므로 placeholder
  const cleaned = texts.map((t) => (t.trim().length === 0 ? "(empty)" : t));

  const result: number[][] = [];
  for (let i = 0; i < cleaned.length; i += BATCH_SIZE) {
    const slice = cleaned.slice(i, i + BATCH_SIZE);
    const res = await client.embeddings.create({
      model: MODEL,
      input: slice,
    });
    res.data
      .sort((a, b) => a.index - b.index)
      .forEach((d) => result.push(d.embedding));
  }
  return result;
}

/**
 * 매칭용 임베딩 텍스트.
 *
 * 의도적으로 itemName 만 사용. spec 까지 합치면 사이트마다 표기가 달라 cosine 이
 * 크게 흔들렸기 때문 (예: 견적서 spec="커넥팅 프로파일" vs DB spec="T1.0"). spec 은
 * 매처의 deterministic 점수에서 별도로 평가됨.
 *
 * 인자 spec 은 호환성 유지용으로 받기만 하고 사용하지 않음.
 */
export function buildEmbeddingText(
  itemName: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _spec?: string | null
): string {
  return itemName.trim();
}

/**
 * 코사인 유사도. 입력 벡터는 같은 차원이어야 함.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
