"""
결재선 API
- 결재선 초기화 (승인 후 자동 호출)
- 결재자 정보 수정
- 결재 요청 발송
- 결재 완료 / 반려
- 결재선 현황 조회
"""
from fastapi import APIRouter, HTTPException
import sqlite3
import uuid
import logging
from datetime import datetime
from pathlib import Path
from models.schemas import (
    ApprovalSetupRequest, ApprovalUpdateRequest,
    ApprovalSignRequest, ApprovalRecord, ApprovalStatus,
)

router = APIRouter(prefix="/api/review", tags=["approvals"])
logger = logging.getLogger(__name__)

DB_PATH = Path("./data/db/reviews.db")


# ─── 공통 DB 헬퍼 ─────────────────────────────────────
def _get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS approvals (
            id          TEXT PRIMARY KEY,
            review_id   TEXT NOT NULL,
            role        TEXT NOT NULL,
            order_seq   INTEGER NOT NULL,
            name        TEXT DEFAULT '',
            department  TEXT DEFAULT '',
            status      TEXT DEFAULT 'pending',
            signed_at   TEXT,
            created_at  TEXT NOT NULL,
            FOREIGN KEY (review_id) REFERENCES reviews(id)
        )
    """)
    conn.commit()
    return conn


def _row_to_record(row) -> ApprovalRecord:
    d = dict(row)
    return ApprovalRecord(
        id=d["id"],
        review_id=d["review_id"],
        role=d["role"],
        order_seq=d["order_seq"],
        name=d.get("name", ""),
        department=d.get("department", ""),
        status=ApprovalStatus(d["status"]),
        signed_at=d.get("signed_at"),
        created_at=d["created_at"],
    )


def _check_review_exists(conn, review_id: str):
    row = conn.execute("SELECT id FROM reviews WHERE id=?", (review_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="검토 요청을 찾을 수 없습니다.")


def _now() -> str:
    return datetime.now().isoformat()


def _now_display() -> str:
    n = datetime.now()
    return f"{n.year}.{n.month:02d}.{n.day:02d} {n.hour:02d}:{n.minute:02d}"


# ─── 엔드포인트 ───────────────────────────────────────

@router.post("/{review_id}/approvals/setup", response_model=list[ApprovalRecord])
async def setup_approvals(review_id: str, req: ApprovalSetupRequest):
    """
    결재선 초기화.
    - 기존 결재선이 있으면 삭제 후 재생성
    - 첫 번째 결재자(작성자)는 즉시 signed 처리
    """
    if not req.approvers:
        raise HTTPException(status_code=400, detail="결재자 목록이 비어있습니다.")

    conn = _get_conn()
    try:
        _check_review_exists(conn, review_id)

        # 기존 결재선 삭제
        conn.execute("DELETE FROM approvals WHERE review_id=?", (review_id,))

        records = []
        now = _now()
        for seq, approver in enumerate(req.approvers):
            aid = str(uuid.uuid4())
            # 작성자(seq=0)는 자동 서명
            status = ApprovalStatus.SIGNED if seq == 0 else ApprovalStatus.PENDING
            signed_at = _now_display() + " 자동서명" if seq == 0 else None

            conn.execute("""
                INSERT INTO approvals
                (id, review_id, role, order_seq, name, department, status, signed_at, created_at)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (aid, review_id, approver.role, seq,
                  approver.name, approver.department,
                  status, signed_at, now))
            records.append(ApprovalRecord(
                id=aid, review_id=review_id, role=approver.role,
                order_seq=seq, name=approver.name, department=approver.department,
                status=status, signed_at=signed_at, created_at=now,
            ))

        conn.commit()
        return records
    finally:
        conn.close()


@router.get("/{review_id}/approvals", response_model=list[ApprovalRecord])
async def get_approvals(review_id: str):
    """결재선 현황 조회 (순서대로 반환)"""
    conn = _get_conn()
    try:
        _check_review_exists(conn, review_id)
        rows = conn.execute(
            "SELECT * FROM approvals WHERE review_id=? ORDER BY order_seq ASC",
            (review_id,)
        ).fetchall()
        return [_row_to_record(r) for r in rows]
    finally:
        conn.close()


@router.put("/{review_id}/approvals/{approval_id}", response_model=ApprovalRecord)
async def update_approver(review_id: str, approval_id: str, req: ApprovalUpdateRequest):
    """결재자 이름·부서 수정"""
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM approvals WHERE id=? AND review_id=?",
            (approval_id, review_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="결재 레코드를 찾을 수 없습니다.")

        updates, params = [], []
        if req.name is not None:
            updates.append("name=?"); params.append(req.name)
        if req.department is not None:
            updates.append("department=?"); params.append(req.department)

        if updates:
            params += [approval_id, review_id]
            conn.execute(
                f"UPDATE approvals SET {', '.join(updates)} WHERE id=? AND review_id=?",
                params
            )
            conn.commit()

        row = conn.execute(
            "SELECT * FROM approvals WHERE id=?", (approval_id,)
        ).fetchone()
        return _row_to_record(row)
    finally:
        conn.close()


@router.post("/{review_id}/approvals/{approval_id}/request", response_model=ApprovalRecord)
async def request_approval(review_id: str, approval_id: str):
    """
    결재 요청 발송 (pending → requested).
    - 이전 순서 결재자가 signed 상태여야 함
    """
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM approvals WHERE id=? AND review_id=?",
            (approval_id, review_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="결재 레코드를 찾을 수 없습니다.")

        record = dict(row)
        if record["status"] == ApprovalStatus.SIGNED:
            raise HTTPException(status_code=400, detail="이미 결재 완료된 항목입니다.")
        if record["status"] == ApprovalStatus.REQUESTED:
            raise HTTPException(status_code=400, detail="이미 결재 요청된 항목입니다.")

        # 순서 체크: 이전 결재자가 완료됐는지 확인
        seq = record["order_seq"]
        if seq > 0:
            prev = conn.execute(
                "SELECT status FROM approvals WHERE review_id=? AND order_seq=?",
                (review_id, seq - 1)
            ).fetchone()
            if not prev or prev["status"] != ApprovalStatus.SIGNED:
                raise HTTPException(status_code=400, detail="이전 결재자의 결재가 완료되지 않았습니다.")

        conn.execute(
            "UPDATE approvals SET status=? WHERE id=?",
            (ApprovalStatus.REQUESTED, approval_id)
        )
        conn.commit()

        # TODO: 실제 이메일/알림 발송 로직 (ERP/메일 연동 시 여기에 추가)
        logger.info(f"결재 요청 발송: approval_id={approval_id}, 수신자={record['name']}")

        row = conn.execute("SELECT * FROM approvals WHERE id=?", (approval_id,)).fetchone()
        return _row_to_record(row)
    finally:
        conn.close()


@router.post("/{review_id}/approvals/{approval_id}/sign", response_model=ApprovalRecord)
async def sign_approval(review_id: str, approval_id: str, req: ApprovalSignRequest):
    """
    결재 완료 처리 (pending/requested → signed).
    - 이름·부서를 마지막으로 갱신 가능
    - 이전 순서 결재자가 signed 상태여야 함
    """
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM approvals WHERE id=? AND review_id=?",
            (approval_id, review_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="결재 레코드를 찾을 수 없습니다.")

        record = dict(row)
        if record["status"] == ApprovalStatus.SIGNED:
            raise HTTPException(status_code=400, detail="이미 결재 완료된 항목입니다.")
        if record["status"] == ApprovalStatus.REJECTED:
            raise HTTPException(status_code=400, detail="반려된 항목은 결재할 수 없습니다.")

        seq = record["order_seq"]
        if seq > 0:
            prev = conn.execute(
                "SELECT status FROM approvals WHERE review_id=? AND order_seq=?",
                (review_id, seq - 1)
            ).fetchone()
            if not prev or prev["status"] != ApprovalStatus.SIGNED:
                raise HTTPException(status_code=400, detail="이전 결재자의 결재가 완료되지 않았습니다.")

        signed_at = _now_display()
        name = req.name if req.name is not None else record["name"]
        dept = req.department if req.department is not None else record["department"]

        conn.execute("""
            UPDATE approvals
            SET status=?, signed_at=?, name=?, department=?
            WHERE id=?
        """, (ApprovalStatus.SIGNED, signed_at, name, dept, approval_id))
        conn.commit()

        # 모든 결재 완료 시 reviews 테이블 상태 갱신 (선택적)
        all_rows = conn.execute(
            "SELECT status FROM approvals WHERE review_id=?", (review_id,)
        ).fetchall()
        if all(r["status"] == ApprovalStatus.SIGNED for r in all_rows):
            conn.execute(
                "UPDATE reviews SET updated_at=? WHERE id=?",
                (_now(), review_id)
            )
            conn.commit()
            logger.info(f"모든 결재 완료: review_id={review_id}")

        row = conn.execute("SELECT * FROM approvals WHERE id=?", (approval_id,)).fetchone()
        return _row_to_record(row)
    finally:
        conn.close()


@router.post("/{review_id}/approvals/{approval_id}/reject", response_model=ApprovalRecord)
async def reject_approval(review_id: str, approval_id: str, body: dict = {}):
    """
    결재 반려 처리.
    - 이후 순서 결재자는 모두 pending으로 초기화
    """
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM approvals WHERE id=? AND review_id=?",
            (approval_id, review_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="결재 레코드를 찾을 수 없습니다.")

        record = dict(row)
        if record["status"] == ApprovalStatus.SIGNED:
            raise HTTPException(status_code=400, detail="이미 결재 완료된 항목은 반려할 수 없습니다.")

        seq = record["order_seq"]
        signed_at = _now_display()

        # 현재 항목 반려
        conn.execute(
            "UPDATE approvals SET status=?, signed_at=? WHERE id=?",
            (ApprovalStatus.REJECTED, signed_at, approval_id)
        )
        # 이후 결재자 모두 pending 초기화
        conn.execute("""
            UPDATE approvals SET status=?, signed_at=NULL
            WHERE review_id=? AND order_seq > ?
        """, (ApprovalStatus.PENDING, review_id, seq))

        conn.commit()

        row = conn.execute("SELECT * FROM approvals WHERE id=?", (approval_id,)).fetchone()
        return _row_to_record(row)
    finally:
        conn.close()
