"""
단가 검토 API
- 요청 접수 / 분석 / 승인 / 반려 / 작업지시서
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import sqlite3
import json
import uuid
import logging
from datetime import datetime
from pathlib import Path
from io import BytesIO
from services import vector_db, claude_service, excel_parser
from models.schemas import (
    ReviewRequest, ApprovalRequest, ReviewStatus, AnalysisResult, SimilarCase
)
try:
    import pandas as pd
    _PANDAS_OK = True
except ImportError:
    _PANDAS_OK = False

router = APIRouter(prefix="/api/review", tags=["review"])
logger = logging.getLogger(__name__)

DB_PATH = Path("./data/db/reviews.db")


# ─── DB 초기화 ──────────────────────────────────────
def _get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            project_name TEXT,
            work_type TEXT,
            item TEXT,
            spec TEXT,
            unit TEXT,
            quantity REAL,
            region TEXT,
            requester TEXT,
            status TEXT,
            proposed_price REAL DEFAULT 0,
            final_price REAL DEFAULT 0,
            confidence INTEGER DEFAULT 0,
            price_min REAL DEFAULT 0,
            price_max REAL DEFAULT 0,
            ai_insight TEXT DEFAULT '',
            price_trend TEXT DEFAULT '',
            similar_cases TEXT DEFAULT '[]',
            reviewer_comment TEXT DEFAULT '',
            created_at TEXT,
            updated_at TEXT
        )
    """)
    conn.commit()
    return conn


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["similar_cases"] = json.loads(d.get("similar_cases", "[]"))
    return d


# ─── 엔드포인트 ──────────────────────────────────────

@router.get("/list")
async def list_reviews():
    """검토 요청 목록 반환"""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM reviews ORDER BY created_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


@router.post("/request")
async def submit_review_request(req: ReviewRequest):
    """단가 검토 요청 접수"""
    review_id = f"CR-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    now = datetime.now().isoformat()
    conn = _get_conn()
    conn.execute("""
        INSERT INTO reviews
        (id, project_name, work_type, item, spec, unit, quantity, region,
         requester, status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, (review_id, req.project_name, req.work_type, req.item, req.spec,
          req.unit, req.quantity, req.region, req.requester,
          ReviewStatus.PENDING, now, now))
    conn.commit()
    conn.close()
    return {"review_id": review_id, "status": ReviewStatus.PENDING, "message": "검토 요청이 접수되었습니다."}


@router.post("/request/excel")
async def submit_review_from_excel(file: UploadFile = File(...)):
    """엑셀 파일로 검토 요청 일괄 접수"""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="엑셀 파일만 가능합니다.")
    content = await file.read()
    rows = excel_parser.parse_excel_review_request(content)
    if not rows:
        raise HTTPException(status_code=400, detail="파싱 가능한 항목이 없습니다.")
    now = datetime.now().isoformat()
    review_ids = []
    conn = _get_conn()
    for r in rows:
        rid = f"CR-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
        conn.execute("""
            INSERT INTO reviews
            (id, project_name, work_type, item, spec, unit, quantity, region,
             requester, status, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (rid, r.get("project_name", ""), r.get("work_type", r["item"]),
              r["item"], r.get("spec", ""), r.get("unit", "식"), r.get("quantity", 1),
              r.get("region", "서울"), "", ReviewStatus.PENDING, now, now))
        review_ids.append(rid)
    conn.commit()
    conn.close()
    return {"count": len(review_ids), "review_ids": review_ids,
            "message": f"{len(review_ids)}건 검토 요청이 접수되었습니다."}


@router.post("/analyze/{review_id}")
async def analyze_review(review_id: str):
    """RAG + Claude 기반 적정 단가 분석"""
    import traceback as _tb

    def _case_dict(s):
        return s.model_dump() if hasattr(s, "model_dump") else s.dict()

    conn = None
    try:
        conn = _get_conn()
        row = conn.execute("SELECT * FROM reviews WHERE id=?", (review_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="검토 요청을 찾을 수 없습니다.")
        review = _row_to_dict(row)

        conn.execute("UPDATE reviews SET status=?, updated_at=? WHERE id=?",
                     ("AI 분석 중", datetime.now().isoformat(), review_id))
        conn.commit()

        similar = vector_db.search_similar_prices(
            item=review["item"], spec=review["spec"],
            work_type=review["work_type"], region=review["region"], n_results=5,
        )

        result = claude_service.analyze_price(
            item=review["item"], spec=review["spec"],
            work_type=review["work_type"], region=review["region"],
            quantity=float(review["quantity"]), similar_cases=similar,
        )

        similar_json = json.dumps([_case_dict(s) for s in similar], ensure_ascii=False)

        proposed = float(result.get("proposed_price") or 0)
        price_min = float(result.get("price_min") or 0)
        price_max = float(result.get("price_max") or 0)
        confidence = int(result.get("confidence") or 0)
        ai_insight = str(result.get("ai_insight") or "")
        price_trend = str(result.get("price_trend") or "")

        conn.execute("""
            UPDATE reviews
            SET status=?, proposed_price=?, price_min=?, price_max=?,
                confidence=?, ai_insight=?, price_trend=?,
                similar_cases=?, updated_at=?
            WHERE id=?
        """, ("AI 분석 완료", proposed, price_min, price_max,
              confidence, ai_insight, price_trend,
              similar_json, datetime.now().isoformat(), review_id))
        conn.commit()

        return {
            "review_id": review_id,
            "status": "AI 분석 완료",
            "proposed_price": proposed,
            "price_min": price_min,
            "price_max": price_max,
            "confidence": confidence,
            "ai_insight": ai_insight,
            "price_trend": price_trend,
            "similar_cases": [_case_dict(s) for s in similar],
        }

    except HTTPException:
        raise
    except BaseException as e:
        tb = _tb.format_exc()
        # Write to file so we can see the error regardless of log encoding
        try:
            with open("./data/analyze_error.txt", "w", encoding="utf-8") as _f:
                _f.write(tb)
        except Exception:
            pass
        logger.error("analyze_review error: %s", repr(tb))
        try:
            if conn:
                conn.execute("UPDATE reviews SET status=?, updated_at=? WHERE id=?",
                             ("분석 오류", datetime.now().isoformat(), review_id))
                conn.commit()
        except BaseException:
            pass
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {repr(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/{review_id}")
async def get_review(review_id: str):
    conn = _get_conn()
    row = conn.execute("SELECT * FROM reviews WHERE id=?", (review_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="검토 요청을 찾을 수 없습니다.")
    return _row_to_dict(row)


@router.post("/insight")
async def get_insight(body: dict):
    """품목별 AI 인사이트 단독 생성"""
    item = body.get("item", "")
    spec = body.get("spec", "")
    similar = vector_db.search_similar_prices(item=item, spec=spec, n_results=3)
    insight = claude_service.generate_insight(item=item, spec=spec, similar_cases=similar)
    return {"insight": insight}


@router.post("/comment")
async def get_review_comment(body: dict):
    """검토 의견 초안 AI 생성"""
    item = body.get("item", "")
    spec = body.get("spec", "")
    final_price = float(body.get("final_price", 0))
    similar = vector_db.search_similar_prices(item=item, spec=spec, n_results=2)
    comment = claude_service.generate_review_comment(
        item=item, spec=spec, final_price=final_price, similar_cases=similar
    )
    return {"comment": comment}


@router.post("/approve/{review_id}")
async def approve_review(review_id: str, req: ApprovalRequest):
    """검토 결과 승인 / 반려"""
    conn = _get_conn()
    row = conn.execute("SELECT * FROM reviews WHERE id=?", (review_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="검토 요청을 찾을 수 없습니다.")

    status = ReviewStatus.APPROVED if req.approved else ReviewStatus.REJECTED
    conn.execute("""
        UPDATE reviews
        SET status=?, final_price=?, reviewer_comment=?, updated_at=?
        WHERE id=?
    """, (status, req.final_price, req.reviewer_comment,
          datetime.now().isoformat(), review_id))
    conn.commit()
    conn.close()

    return {"review_id": review_id, "status": status,
            "message": "승인 완료" if req.approved else "반려 처리"}


@router.get("/work-order/{review_id}")
async def get_work_order(review_id: str):
    """작업지시서 데이터 반환"""
    conn = _get_conn()
    row = conn.execute("SELECT * FROM reviews WHERE id=?", (review_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="검토 요청을 찾을 수 없습니다.")
    review = _row_to_dict(row)

    if review["status"] != ReviewStatus.APPROVED:
        raise HTTPException(status_code=400, detail="승인 완료된 항목만 작업지시서를 발행할 수 있습니다.")

    final_price = review["final_price"] or review["proposed_price"]
    quantity = review["quantity"]
    total = final_price * quantity

    notes = claude_service.generate_work_order_text(
        project_name=review["project_name"],
        item=review["item"],
        spec=review["spec"],
        unit=review["unit"],
        quantity=quantity,
        unit_price=final_price,
        comment=review["reviewer_comment"],
    )

    work_order_no = f"WO-{datetime.now().strftime('%Y-%m-%d')}-{review_id[-4:]}"
    return {
        "work_order_no": work_order_no,
        "project_name": review["project_name"],
        "item": f"{review['item']} ({review['spec']})",
        "unit": review["unit"],
        "quantity": quantity,
        "unit_price": final_price,
        "total_amount": total,
        "reviewer_comment": review["reviewer_comment"],
        "notes": notes,
        "created_at": datetime.now().strftime("%Y년 %m월 %d일"),
        "status": "승인완료",
    }


# ── Excel 규칙 기반 단가 추출 (API 키 없을 때 폴백) ────────
def _heuristic_excel_extract(df) -> dict:
    """합계행 키워드 기반 단가 추출 — Claude 없이 동작"""
    TOTAL_KW = {"합계", "합 계", "소계", "총계", "total", "계"}

    def to_num(v):
        s = str(v).replace(",", "").replace("원", "").replace(" ", "").strip()
        try:
            f = float(s)
            return f if f > 0 else None
        except Exception:
            return None

    found_total = None
    all_nums = []

    for ri in range(min(200, len(df))):
        row = df.iloc[ri]
        row_strs = [str(v).strip() for v in row]
        is_total_row = any(any(kw in s.lower() for kw in TOTAL_KW) for s in row_strs)

        nums_in_row = [(ci, to_num(v)) for ci, v in enumerate(row) if to_num(v) and to_num(v) > 100]

        if is_total_row and nums_in_row:
            # 합계행에서 가장 큰 값 = 최종 단가(일위대가) 또는 합계
            found_total = max(nums_in_row, key=lambda x: x[1])[1]

        for _, n in nums_in_row:
            all_nums.append(n)

    # 헤더 정보 추출 (첫 5행에서 텍스트 셀)
    header_texts = []
    for ri in range(min(5, len(df))):
        for v in df.iloc[ri]:
            s = str(v).strip()
            if s and s not in ("nan", "0", "") and not s.replace(".", "").replace(",", "").isdigit():
                header_texts.append(s)

    item = header_texts[0] if header_texts else None
    spec = header_texts[1] if len(header_texts) > 1 else None

    if found_total:
        return {
            "unit_price": int(found_total), "total_amount": int(found_total),
            "item": item, "spec": spec, "quantity": None, "unit": None,
            "confidence": 40,
            "note": "합계행 자동 추출 (AI 미연동) — 값을 반드시 확인하세요",
        }
    if all_nums:
        return {
            "unit_price": int(max(all_nums)), "total_amount": None,
            "item": item, "spec": spec, "quantity": None, "unit": None,
            "confidence": 15,
            "note": "최대값 기반 추정 (AI 미연동) — 값을 반드시 확인하세요",
        }
    return {
        "unit_price": None, "confidence": 0,
        "note": "엑셀에서 숫자를 찾을 수 없습니다. 단가를 직접 입력해주세요.",
    }


# ── 협력사 견적서 단가 추출 ──────────────────────────────
@router.post("/extract-vendor-price")
async def extract_vendor_price(file: UploadFile = File(...)):
    """
    협력사 견적서(PDF·이미지·엑셀)에서 단가를 추출.
    API 키 있으면 Claude Vision, 없으면 규칙 기반(Excel만).
    반환: { unit_price, item, spec, quantity, unit, total_amount, confidence, note }
    """
    content = await file.read()
    fname = (file.filename or "").lower()
    ct = file.content_type or ""

    try:
        # ── Excel ──────────────────────────────────────────
        if fname.endswith((".xlsx", ".xls")):
            if not _PANDAS_OK:
                raise HTTPException(status_code=500, detail="pandas 미설치")
            engine = "xlrd" if fname.endswith(".xls") else "openpyxl"
            df = pd.read_excel(BytesIO(content), header=None, engine=engine)
            sheet_text = df.iloc[:200, :30].fillna("").to_csv(sep="\t", index=False, header=False)
            result = claude_service.extract_price_from_excel_text(sheet_text)
            # Claude API 없으면 규칙 기반 폴백
            if not result.get("unit_price"):
                result = _heuristic_excel_extract(df.iloc[:200, :30].fillna(""))

        # ── PDF ────────────────────────────────────────────
        elif fname.endswith(".pdf") or "pdf" in ct:
            result = claude_service.extract_price_from_pdf(content)
            if not result.get("unit_price") and not claude_service._API_KEY_VALID:
                result = {"unit_price": None, "confidence": 0,
                          "note": "PDF 추출은 Claude API 키가 필요합니다. 단가를 직접 입력해주세요."}

        # ── 이미지 ──────────────────────────────────────────
        elif fname.endswith((".jpg", ".jpeg")) or "jpeg" in ct:
            result = claude_service.extract_price_from_image(content, "image/jpeg")
            if not result.get("unit_price") and not claude_service._API_KEY_VALID:
                result = {"unit_price": None, "confidence": 0,
                          "note": "이미지 추출은 Claude API 키가 필요합니다. 단가를 직접 입력해주세요."}
        elif fname.endswith(".png") or "png" in ct:
            result = claude_service.extract_price_from_image(content, "image/png")
            if not result.get("unit_price") and not claude_service._API_KEY_VALID:
                result = {"unit_price": None, "confidence": 0,
                          "note": "이미지 추출은 Claude API 키가 필요합니다. 단가를 직접 입력해주세요."}
        elif fname.endswith(".webp") or "webp" in ct:
            result = claude_service.extract_price_from_image(content, "image/webp")
            if not result.get("unit_price") and not claude_service._API_KEY_VALID:
                result = {"unit_price": None, "confidence": 0,
                          "note": "이미지 추출은 Claude API 키가 필요합니다. 단가를 직접 입력해주세요."}

        else:
            raise HTTPException(status_code=415, detail=f"지원하지 않는 파일 형식: {fname}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"견적서 단가 추출 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return result
