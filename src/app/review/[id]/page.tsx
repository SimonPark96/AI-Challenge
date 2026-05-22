import { redirect } from "next/navigation";

/**
 * 03 적정 단가 검토 step 은 제거되어 02 AI 자동 비교 의 종합/일위대가 검토 탭으로 통합됨.
 * 기존 링크/북마크 호환을 위해 /analyze/[id] 로 리다이렉트.
 */
export default async function ReviewByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/analyze/${id}`);
}
