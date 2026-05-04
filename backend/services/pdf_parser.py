"""
PDF 단가 자료 파서
한국물가정보, 한국물가협회, 대한건설협회 등 외부 기관 PDF 처리
"""
import pdfplumber
import re
import logging
from typing import List
from io import BytesIO
from models.schemas import PriceDataItem

logger = logging.getLogger(__name__)

# 금액 패턴 (콤마 포함)
PRICE_PATTERN = re.compile(r"[\d,]{4,}")
# 단위 패턴
UNIT_PATTERN = re.compile(r"\b(m3|m2|㎥|㎡|ton|T|kg|KG|개|ea|EA|식|SET|set|본|권|장|매|개소|인)\b", re.IGNORECASE)


def _extract_price(text: str) -> float:
    """텍스트에서 단가 추출"""
    matches = PRICE_PATTERN.findall(text.replace(" ", ""))
    for m in matches:
        val = float(m.replace(",", ""))
        if 100 <= val <= 100_000_000:
            return val
    return 0.0


def _extract_unit(text: str) -> str:
    m = UNIT_PATTERN.search(text)
    return m.group(0) if m else "식"


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def parse_pdf_price_table(
    file_content: bytes, source: str = "한국물가정보", period: str = "2024-01"
) -> List[PriceDataItem]:
    """
    PDF에서 단가 테이블 추출
    - 표(table) 우선 파싱
    - 표 없으면 텍스트 라인 분석
    """
    results = []
    try:
        with pdfplumber.open(BytesIO(file_content)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                # 1) 테이블 파싱
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header = [_clean_text(str(c)) for c in (table[0] or [])]
                    for row in table[1:]:
                        if not row:
                            continue
                        cells = [_clean_text(str(c or "")) for c in row]
                        if len(cells) < 2:
                            continue
                        # 첫 번째 셀을 품목으로 간주
                        item = cells[0]
                        if not item or len(item) < 2:
                            continue
                        # 숫자가 포함된 셀에서 단가 추출
                        unit_price = 0.0
                        spec = ""
                        unit = "식"
                        for j, cell in enumerate(cells[1:], 1):
                            if not unit_price:
                                unit_price = _extract_price(cell)
                            if not spec and j < len(cells) - 1:
                                spec = cell if not _extract_price(cell) else spec
                            if not unit or unit == "식":
                                u = _extract_unit(cell)
                                if u != "식":
                                    unit = u

                        if unit_price > 0 and len(item) >= 2:
                            results.append(PriceDataItem(
                                work_type=item,
                                item=item,
                                spec=spec[:50],
                                unit=unit,
                                unit_price=unit_price,
                                project_name=source,
                                region="",
                                period=period,
                                source=source,
                            ))

                # 2) 텍스트 라인 파싱 (테이블이 없는 경우)
                if not tables:
                    text = page.extract_text() or ""
                    lines = text.split("\n")
                    for line in lines:
                        line = _clean_text(line)
                        if not line or len(line) < 5:
                            continue
                        price = _extract_price(line)
                        if price > 0:
                            # 가격 앞의 텍스트를 품목명으로 추정
                            price_pos = line.find(str(int(price)).replace(",", ""))
                            if price_pos > 2:
                                item = line[:price_pos].strip()[:30]
                                unit = _extract_unit(line) or "식"
                                if len(item) >= 2:
                                    results.append(PriceDataItem(
                                        work_type=item,
                                        item=item,
                                        spec="",
                                        unit=unit,
                                        unit_price=price,
                                        project_name=source,
                                        region="",
                                        period=period,
                                        source=source,
                                    ))

    except Exception as e:
        logger.error(f"PDF 파싱 오류: {e}")

    logger.info(f"PDF 파싱 완료 (출처: {source}): {len(results)}건")
    return results
