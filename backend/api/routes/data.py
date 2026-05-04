"""
데이터 관리 API
- 내부 실적 엑셀 업로드
- 외부 물가 PDF 업로드
- DB 통계
- 샘플 데이터 삽입
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import logging
from services import vector_db, excel_parser, pdf_parser, claude_service
from datetime import datetime
from models.schemas import PriceDataItem

router = APIRouter(prefix="/api/data", tags=["data"])
logger = logging.getLogger(__name__)


@router.post("/upload/excel")
async def upload_internal_excel(
    file: UploadFile = File(...),
    source: str = Form(default="내부실적"),
):
    """사내 실적 엑셀 파일 업로드 → 벡터 DB 저장"""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.")
    try:
        content = await file.read()
        items = excel_parser.parse_excel_file(content, source=source)
        if not items:
            # 컬럼 매핑 실패(일위대가 등 비정형) → Claude 추출로 폴백
            logger.info(f"컬럼 매핑 실패, Claude 추출 시도: {file.filename}")
            items = excel_parser.parse_excel_with_claude(content, source=source)
        if not items:
            return JSONResponse({"success": False, "message": "파싱된 데이터가 없습니다. 컬럼명을 확인해주세요.", "count": 0})
        count = vector_db.add_internal_prices(items)
        return {"success": True, "message": f"{count}건이 DB에 저장되었습니다.", "count": count}
    except Exception as e:
        logger.error(f"엑셀 업로드 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload/pdf")
async def upload_external_pdf(
    file: UploadFile = File(...),
    source: str = Form(default="한국물가정보"),
    period: str = Form(default="2024-01"),
):
    """외부 물가 PDF 업로드 → 벡터 DB 저장"""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")
    try:
        content = await file.read()
        items = pdf_parser.parse_pdf_price_table(content, source=source, period=period)
        if not items:
            # pdfplumber 실패(일위대가 등 복잡한 표) → Claude PDF 추출로 폴백
            logger.info(f"pdfplumber 추출 실패, Claude 추출 시도: {file.filename}")
            extracted = claude_service.extract_price_from_pdf(content)
            unit_price = extracted.get("unit_price")
            item_name = extracted.get("item")
            if unit_price and item_name:
                items = [PriceDataItem(
                    work_type=item_name,
                    item=item_name,
                    spec=extracted.get("spec") or "",
                    unit=extracted.get("unit") or "식",
                    unit_price=float(unit_price),
                    project_name=source,
                    region="",
                    period=period,
                    source=source,
                    notes=extracted.get("note") or "",
                )]
        if not items:
            return JSONResponse({"success": False, "message": "PDF에서 단가 데이터를 추출하지 못했습니다.", "count": 0})
        count = vector_db.add_external_prices(items)
        return {"success": True, "message": f"{count}건이 DB에 저장되었습니다.", "count": count}
    except Exception as e:
        logger.error(f"PDF 업로드 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_db_stats():
    """벡터 DB 통계 반환"""
    stats = vector_db.get_stats()
    return stats


@router.delete("/clear")
async def clear_all_data():
    """벡터 DB 전체 초기화"""
    try:
        result = vector_db.clear_all()
        return {
            "success": True,
            "message": f"DB 초기화 완료 (내부 {result['deleted_internal']}건, 외부 {result['deleted_external']}건 삭제)",
            **result,
        }
    except Exception as e:
        logger.error(f"DB 초기화 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))
