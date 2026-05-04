"""
Claude API 기반 단가 분석 서비스
- RAG 기반 적정 단가 산정
- AI 분석 인사이트 생성
- 검토 의견 초안 작성
"""
import anthropic
import base64
import json
import logging
from typing import List, Optional
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from models.schemas import SimilarCase

logger = logging.getLogger(__name__)

_API_KEY_VALID = bool(ANTHROPIC_API_KEY and len(ANTHROPIC_API_KEY) > 20)
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if _API_KEY_VALID else None

if not _API_KEY_VALID:
    logger.warning("ANTHROPIC_API_KEY 미설정 — Claude 기능 비활성화, DB 기반 폴백 모드로 동작")

SYSTEM_PROMPT = """당신은 건설 공사 단가 산정 전문가입니다.
사내 실적 자료와 외부 물가 자료를 바탕으로 적정 단가를 산정하고,
그 근거를 명확하고 전문적으로 제시해야 합니다.
한국 건설 시장의 특성과 물가 변동 추이를 반영하여 분석하십시오."""


def _format_similar_cases(cases: List[SimilarCase]) -> str:
    if not cases:
        return "참조 가능한 유사 사례가 없습니다."
    lines = []
    for i, c in enumerate(cases, 1):
        lines.append(
            f"{i}. [{c.source}] {c.item} ({c.spec}) | "
            f"단가: {c.unit_price:,.0f}원 | "
            f"현장: {c.project_name} | 시기: {c.period} | 유사도: {c.similarity:.0%}"
        )
    return "\n".join(lines)


def _fallback_analysis(item: str, spec: str, similar_cases: List[SimilarCase]) -> dict:
    """API 키 없을 때 유사 사례 통계 기반 폴백 결과"""
    prices = [c.unit_price for c in similar_cases if c.unit_price > 0]
    if prices:
        avg = round(sum(prices) / len(prices))
        mn, mx = round(min(prices)), round(max(prices))
        conf = min(80, 40 + len(prices) * 8)
        insight = (f"DB 내 유사 사례 {len(prices)}건 평균값 기준 산정 "
                   f"(최소 {mn:,}원 ~ 최대 {mx:,}원). "
                   f"Claude AI 연동 시 더 정밀한 분석이 가능합니다.")
        trend = f"유사 사례 {len(prices)}건 평균 기준 (AI 분석 비활성)"
    else:
        avg = mn = mx = 0
        conf = 10
        insight = "DB에 유사 사례가 없습니다. 단가 데이터를 먼저 업로드하세요."
        trend = "참조 데이터 없음 (AI 분석 비활성)"
    return {
        "proposed_price": avg,
        "price_min": mn,
        "price_max": mx,
        "confidence": conf,
        "price_trend": trend,
        "ai_insight": insight,
    }


def analyze_price(
    item: str,
    spec: str,
    work_type: str,
    region: str,
    quantity: float,
    similar_cases: List[SimilarCase],
) -> dict:
    """RAG 기반 적정 단가 분석 — API 키 없으면 DB 통계 폴백"""
    prices = [c.unit_price for c in similar_cases if c.unit_price > 0]

    if not _API_KEY_VALID or client is None:
        logger.info("API 키 없음 — DB 폴백 분석 사용")
        return _fallback_analysis(item, spec, similar_cases)

    cases_text = _format_similar_cases(similar_cases)
    price_hint = ""
    if prices:
        avg = sum(prices) / len(prices)
        mn, mx = min(prices), max(prices)
        price_hint = f"\n참조 단가 범위: {mn:,.0f}원 ~ {mx:,.0f}원 (평균 {avg:,.0f}원)"

    prompt = f"""다음 공사 내역에 대해 적정 단가를 산정해주세요.

## 검토 대상
- 공종: {work_type}
- 품목: {item}
- 규격: {spec}
- 수량: {quantity:,.1f}
- 지역: {region}
{price_hint}

## 유사 실적 자료 ({len(similar_cases)}건)
{cases_text}

## 요청 사항
아래 JSON 형식으로만 응답하세요:
{{
  "proposed_price": <적정 단가(숫자)>,
  "price_min": <최소 단가(숫자)>,
  "price_max": <최대 단가(숫자)>,
  "confidence": <신뢰도 0-100(숫자)>,
  "price_trend": "<물가변동 반영 여부 및 설명(50자 이내)>",
  "ai_insight": "<단가 산출 근거 및 시장 분석 (150자 이내, 전문적 어투)>"
}}

참고: 유사 사례가 없으면 일반적인 건설 시장 단가를 기준으로 산정하되 confidence를 낮게 설정하세요."""

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        text = next((b.text for b in response.content if b.type == "text"), "")
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise ValueError("JSON not found in response")
    except Exception as e:
        logger.warning(f"Claude API 호출 실패, DB 폴백 사용: {e}")
        return _fallback_analysis(item, spec, similar_cases)


def generate_insight(item: str, spec: str, similar_cases: List[SimilarCase]) -> str:
    """품목별 시장 동향 분석 인사이트 생성"""
    if not _API_KEY_VALID or client is None:
        prices = [c.unit_price for c in similar_cases if c.unit_price > 0]
        if prices:
            return (f"{item} ({spec}) — DB 유사 사례 {len(prices)}건 기준 평균 {round(sum(prices)/len(prices)):,}원. "
                    "Claude API 연동 후 시장 동향 분석이 제공됩니다.")
        return f"{item} ({spec}) — DB에 유사 사례가 없습니다. 단가 데이터를 먼저 업로드하세요."

    cases_summary = _format_similar_cases(similar_cases[:3]) if similar_cases else "참조 자료 없음"
    prompt = f"""건설 자재/공종인 '{item} ({spec})'에 대해 현재 건설 시장의 원자재가 추이와
인건비 변동을 고려한 단가 검토 로직을 전문적인 말투로 3문장 이내로 생성해주세요.

참조 단가 사례:
{cases_summary}

간결하고 전문적으로 작성하세요."""

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL, max_tokens=300, system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return next((b.text.strip() for b in response.content if b.type == "text"), "")
    except Exception as e:
        logger.warning(f"generate_insight 실패: {e}")
        return f"{item} 인사이트 생성 실패 (API 오류)."


def generate_review_comment(
    item: str, spec: str, final_price: float, similar_cases: List[SimilarCase]
) -> str:
    """검토 의견 초안 자동 생성"""
    if not _API_KEY_VALID or client is None:
        return (f"{item} ({spec}) 단가 {final_price:,.0f}원은 DB 유사 사례 기반으로 산정되었으며 "
                "현장 여건을 종합적으로 검토하여 적정 단가로 확정함.")

    cases_ref = _format_similar_cases(similar_cases[:2]) if similar_cases else "참조 자료 없음"
    prompt = f"""다음 단가 검토 결과에 대해 결재권자가 납득할 만한 전문적인 검토 의견 초안을 2문장으로 작성해주세요.

- 품목: {item} ({spec})
- 확정 단가: {final_price:,.0f}원
- 참조 사례:
{cases_ref}

전문 건설사 견적 담당자 관점에서 간결하고 설득력 있게 작성하세요."""

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL, max_tokens=300, system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return next((b.text.strip() for b in response.content if b.type == "text"),
                    "AI 산정 결과를 검토하여 현장 여건에 적합한 단가로 확정함.")
    except Exception as e:
        logger.warning(f"generate_review_comment 실패: {e}")
        return "AI 산정 결과를 검토하여 현장 여건에 적합한 단가로 확정함."


def generate_work_order_text(
    project_name: str, item: str, spec: str, unit: str,
    quantity: float, unit_price: float, comment: str
) -> str:
    """작업지시서 특기사항 자동 생성"""
    if not _API_KEY_VALID or client is None:
        total = quantity * unit_price
        return (f"본 작업지시서는 DB 유사 사례 기반 단가({unit_price:,.0f}원/{unit}) 기준으로 작성되었습니다. "
                f"총 금액 {total:,.0f}원. 관련 법령 및 시방서에 준하여 시공 바람.")

    total = quantity * unit_price
    prompt = f"""다음 정보를 바탕으로 작업지시서의 '특기사항' 항목에 들어갈 내용을 2~3문장으로 작성해주세요.

- 공사명: {project_name}
- 품목: {item} ({spec})
- 수량: {quantity:,.1f} {unit}
- 단가: {unit_price:,.0f}원
- 금액합계: {total:,.0f}원
- 검토의견: {comment}

공식 문서 양식에 맞게 간결하고 명확하게 작성하세요."""

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL, max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return next((b.text.strip() for b in response.content if b.type == "text"),
                    "AI 검토 완료 후 단가 확정. 관련 법령 및 시방서에 준하여 시공 바람.")
    except Exception as e:
        logger.warning(f"generate_work_order_text 실패: {e}")
        return "AI 검토 완료 후 단가 확정. 관련 법령 및 시방서에 준하여 시공 바람."


# ── 협력사 견적서 단가 추출 ────────────────────────────

EXTRACT_PROMPT = """이 문서는 건설 공사 관련 단가 문서입니다. 일위대가표 또는 견적서/내역서일 수 있습니다.

## 일위대가표 구조 (이 형식이면 아래 규칙 적용)
일위대가표는 다음 구조를 가집니다:
- 상단 헤더: 공종명(품명), 규격, 단위 정보
- 내역 행들: 재료비 / 노무비 / 경비 구성 항목 (각 항목별 수량 × 단가 = 금액)
- 소계 행: 재료비 소계, 노무비 소계, 경비 소계
- 합계 행 (최하단): 재료비합계 + 노무비합계 + 경비합계 = 최종 단가

⚠️ 핵심: 내역 행 개별 단가(재료·노무·경비 구성 항목의 단가)가 아닌,
         최하단 합계행의 값을 unit_price로 추출하세요.
⚠️ item / spec / unit 은 상단 헤더에서 추출하세요 (내역 행의 재료명이 아님).

## 견적서 / 내역서인 경우
여러 품목이 있으면 가장 대표적인 품목의 단위 단가를 추출하세요.
단가(unit_price)는 반드시 단위 단가이어야 합니다 (합계금액 아님).

## 공통 규칙
- 숫자는 콤마 없이 정수로
- 추출 불가 항목은 null

응답 형식 (JSON만, 설명 없이):
{
  "unit_price": <단가 숫자 또는 null>,
  "item": "<공종명 또는 품목명>",
  "spec": "<규격>",
  "quantity": <수량 숫자 또는 null>,
  "unit": "<단위 (ton/m3/m2/개 등)>",
  "total_amount": <합계금액 숫자 또는 null>,
  "confidence": <추출 신뢰도 0-100>,
  "note": "<추출 근거 한 줄 — 일위대가/견적서 구분 및 합계행 위치 명시>"
}"""


_NO_API_EXTRACT = {"unit_price": None, "confidence": 0,
                   "note": "Claude API 키가 설정되지 않아 자동 추출이 불가합니다."}


def extract_price_from_excel_text(sheet_text: str) -> dict:
    """엑셀을 텍스트로 변환한 내용을 Claude로 분석"""
    if not _API_KEY_VALID or client is None:
        return _NO_API_EXTRACT
    try:
        response = client.messages.create(
            model=CLAUDE_MODEL, max_tokens=512,
            messages=[{"role": "user",
                        "content": f"{EXTRACT_PROMPT}\n\n--- 엑셀 내용 ---\n{sheet_text}"}]
        )
        return _parse_extract_response(response)
    except Exception as e:
        logger.warning(f"extract_price_from_excel_text 실패: {e}")
        return {"unit_price": None, "confidence": 0, "note": str(e)}


def extract_price_from_pdf(pdf_bytes: bytes) -> dict:
    """PDF를 Claude Documents API로 직접 분석"""
    if not _API_KEY_VALID or client is None:
        return _NO_API_EXTRACT
    try:
        pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")
        response = client.messages.create(
            model=CLAUDE_MODEL, max_tokens=512,
            messages=[{"role": "user", "content": [
                {"type": "document",
                 "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64}},
                {"type": "text", "text": EXTRACT_PROMPT},
            ]}]
        )
        return _parse_extract_response(response)
    except Exception as e:
        logger.warning(f"extract_price_from_pdf 실패: {e}")
        return {"unit_price": None, "confidence": 0, "note": str(e)}


def extract_price_from_image(image_bytes: bytes, media_type: str) -> dict:
    """이미지(JPG/PNG)를 Claude Vision으로 분석"""
    if not _API_KEY_VALID or client is None:
        return _NO_API_EXTRACT
    try:
        img_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
        response = client.messages.create(
            model=CLAUDE_MODEL, max_tokens=512,
            messages=[{"role": "user", "content": [
                {"type": "image",
                 "source": {"type": "base64", "media_type": media_type, "data": img_b64}},
                {"type": "text", "text": EXTRACT_PROMPT},
            ]}]
        )
        return _parse_extract_response(response)
    except Exception as e:
        logger.warning(f"extract_price_from_image 실패: {e}")
        return {"unit_price": None, "confidence": 0, "note": str(e)}


def _parse_extract_response(response) -> dict:
    """Claude 응답에서 JSON 추출"""
    text = ""
    for block in response.content:
        if block.type == "text":
            text = block.text
            break
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except (json.JSONDecodeError, ValueError):
        pass
    return {"unit_price": None, "confidence": 0, "note": "파싱 실패"}
