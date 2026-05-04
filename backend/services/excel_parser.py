"""
엑셀 파일 파서 - 사내 실적 단가 자료 처리
다양한 현장 양식을 자동 인식하여 표준 형식으로 변환
"""
import pandas as pd
import logging
from typing import List, Optional
from io import BytesIO
from models.schemas import PriceDataItem

logger = logging.getLogger(__name__)

# 컬럼명 매핑 (다양한 현장 양식 대응)
COLUMN_ALIASES = {
    "work_type": ["공종", "공종명", "작업종류", "분류", "category"],
    "item": ["품목", "품명", "공종/품목", "품목명", "item", "재료명"],
    "spec": ["규격", "사양", "spec", "specification", "형식"],
    "unit": ["단위", "unit"],
    "unit_price": ["단가", "단위단가", "unit_price", "price", "금액/단위"],
    "project_name": ["현장명", "공사명", "프로젝트", "project", "현장"],
    "region": ["지역", "위치", "region", "location"],
    "period": ["시기", "계약일", "준공일", "날짜", "기간", "연도", "year", "date"],
    "notes": ["비고", "notes", "remarks", "메모"],
}


def _normalize_columns(df: pd.DataFrame) -> dict:
    """컬럼명을 표준 필드명으로 매핑"""
    col_lower = {c.lower().strip(): c for c in df.columns}
    mapping = {}
    for field, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias.lower() in col_lower:
                mapping[field] = col_lower[alias.lower()]
                break
    return mapping


def _safe_str(val) -> str:
    if pd.isna(val):
        return ""
    return str(val).strip()


def _safe_float(val) -> Optional[float]:
    if pd.isna(val):
        return None
    try:
        return float(str(val).replace(",", "").replace("원", "").strip())
    except (ValueError, TypeError):
        return None


def _infer_period(val) -> str:
    s = _safe_str(val)
    if not s:
        return ""
    # YYYY-MM 형식으로 정규화
    import re
    m = re.search(r"(\d{4})[-./년]?\s*(\d{1,2})?", s)
    if m:
        year = m.group(1)
        month = m.group(2) or "01"
        return f"{year}-{int(month):02d}"
    return s[:10]


def parse_excel_file(file_content: bytes, source: str = "내부실적") -> List[PriceDataItem]:
    """엑셀 파일을 파싱하여 단가 데이터 목록 반환"""
    results = []
    try:
        xl = pd.ExcelFile(BytesIO(file_content))
    except Exception as e:
        logger.error(f"엑셀 파일 열기 실패: {e}")
        return []

    for sheet_name in xl.sheet_names:
        try:
            df = xl.parse(sheet_name, header=0)
            df.columns = df.columns.astype(str).str.strip()
            df = df.dropna(how="all")

            col_map = _normalize_columns(df)
            logger.info(f"시트 '{sheet_name}' 컬럼 매핑: {col_map}")

            if "unit_price" not in col_map or "item" not in col_map:
                logger.warning(f"시트 '{sheet_name}': 필수 컬럼(품목, 단가) 없음, 건너뜀")
                continue

            for _, row in df.iterrows():
                unit_price = _safe_float(row.get(col_map.get("unit_price", ""), None))
                if unit_price is None or unit_price <= 0:
                    continue
                item = _safe_str(row.get(col_map.get("item", ""), ""))
                if not item:
                    continue

                pdi = PriceDataItem(
                    work_type=_safe_str(row.get(col_map.get("work_type", ""), item)),
                    item=item,
                    spec=_safe_str(row.get(col_map.get("spec", ""), "")),
                    unit=_safe_str(row.get(col_map.get("unit", ""), "식")) or "식",
                    unit_price=unit_price,
                    project_name=_safe_str(row.get(col_map.get("project_name", ""), "")),
                    region=_safe_str(row.get(col_map.get("region", ""), "")),
                    period=_infer_period(row.get(col_map.get("period", ""), "")) or "2024-01",
                    source=source,
                    notes=_safe_str(row.get(col_map.get("notes", ""), "")),
                )
                results.append(pdi)

        except Exception as e:
            logger.error(f"시트 '{sheet_name}' 파싱 오류: {e}")
            continue

    logger.info(f"엑셀 파싱 완료: {len(results)}건")
    return results


def parse_excel_with_claude(file_content: bytes, source: str = "내부실적") -> List[PriceDataItem]:
    """일위대가 등 비정형 양식: Claude를 통한 시트별 단가 추출 (컬럼 매핑 실패 시 폴백)"""
    from services import claude_service  # 순환참조 방지를 위해 지연 임포트
    from datetime import datetime

    results = []
    try:
        xl = pd.ExcelFile(BytesIO(file_content))
    except Exception as e:
        logger.error(f"엑셀 파일 열기 실패: {e}")
        return []

    for sheet_name in xl.sheet_names:
        try:
            df = xl.parse(sheet_name, header=None)
            sheet_text = df.iloc[:200, :30].fillna("").to_csv(sep="\t", index=False, header=False)
            extracted = claude_service.extract_price_from_excel_text(sheet_text)

            unit_price = extracted.get("unit_price")
            item_name = extracted.get("item")
            if not unit_price or not item_name:
                logger.warning(f"시트 '{sheet_name}': Claude 추출 실패 — 건너뜀")
                continue

            results.append(PriceDataItem(
                work_type=item_name,
                item=item_name,
                spec=extracted.get("spec") or "",
                unit=extracted.get("unit") or "식",
                unit_price=float(unit_price),
                project_name="",
                region="",
                period=datetime.now().strftime("%Y-%m"),
                source=source,
                notes=extracted.get("note") or "",
            ))
            logger.info(f"Claude 추출 완료 [{sheet_name}]: {item_name} @ {unit_price:,}원")
        except Exception as e:
            logger.error(f"시트 '{sheet_name}' Claude 추출 오류: {e}")

    logger.info(f"Claude 엑셀 파싱 완료: {len(results)}건")
    return results


def parse_excel_review_request(file_content: bytes) -> List[dict]:
    """검토 요청용 엑셀 파일 파싱 (업로드 요청 양식)"""
    results = []
    try:
        df = pd.read_excel(BytesIO(file_content))
        df.columns = df.columns.astype(str).str.strip()
        df = df.dropna(how="all")
        col_map = _normalize_columns(df)

        for _, row in df.iterrows():
            item = _safe_str(row.get(col_map.get("item", ""), ""))
            if not item:
                continue
            qty_raw = row.get(col_map.get("unit", "") or "수량", 1)
            try:
                qty = float(str(qty_raw).replace(",", "")) if not pd.isna(qty_raw) else 1.0
            except Exception:
                qty = 1.0

            results.append({
                "work_type": _safe_str(row.get(col_map.get("work_type", ""), item)),
                "item": item,
                "spec": _safe_str(row.get(col_map.get("spec", ""), "")),
                "unit": _safe_str(row.get(col_map.get("unit", ""), "식")) or "식",
                "quantity": qty,
                "project_name": _safe_str(row.get(col_map.get("project_name", ""), "")),
                "region": _safe_str(row.get(col_map.get("region", ""), "서울")),
            })
    except Exception as e:
        logger.error(f"검토 요청 엑셀 파싱 오류: {e}")
    return results
