from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ReviewStatus(str, Enum):
    PENDING = "진행 중 요청"
    ANALYZING = "AI 분석 중"
    ANALYZED = "AI 분석 완료"
    APPROVED = "승인 완료"
    REJECTED = "반려"


class PriceDataItem(BaseModel):
    """벡터 DB에 저장되는 단가 데이터"""
    id: Optional[str] = None
    work_type: str       # 공종
    item: str            # 품목
    spec: str            # 규격
    unit: str            # 단위
    unit_price: float    # 단가
    project_name: str    # 현장명
    region: str = ""     # 지역
    period: str          # 시기 (YYYY-MM)
    source: str          # 출처 (내부실적/한국물가정보/한국물가협회 등)
    notes: str = ""      # 비고


class ReviewRequest(BaseModel):
    project_name: str    # 공사명
    work_type: str       # 공종
    item: str            # 품목/공종명
    spec: str            # 규격
    unit: str = "식"     # 단위
    quantity: float      # 수량
    region: str = "서울" # 지역
    requester: str = ""  # 요청자


class SimilarCase(BaseModel):
    item: str
    spec: str
    unit_price: float
    project_name: str
    period: str
    source: str
    similarity: float


class AnalysisResult(BaseModel):
    review_id: str
    item: str
    spec: str
    quantity: float
    unit: str
    proposed_price: float
    price_min: float
    price_max: float
    confidence: int
    similar_cases: List[SimilarCase]
    ai_insight: str
    price_trend: str     # 물가변동 반영 여부
    created_at: str


class ApprovalRequest(BaseModel):
    review_id: str
    final_price: float
    reviewer_comment: str
    approved: bool


class WorkOrder(BaseModel):
    review_id: str
    project_name: str
    item: str
    spec: str
    unit: str
    quantity: float
    unit_price: float
    total_amount: float
    reviewer_comment: str
    created_at: str
    status: str = "승인완료"


class DBStats(BaseModel):
    internal_count: int
    external_count: int
    last_updated: str


# ── 결재선 ──────────────────────────────────────────
class ApprovalStatus(str, Enum):
    PENDING   = "pending"    # 대기중
    REQUESTED = "requested"  # 요청됨
    SIGNED    = "signed"     # 결재완료
    REJECTED  = "rejected"   # 반려


class ApproverInfo(BaseModel):
    """결재선 초기 설정 시 각 결재자 정보"""
    role: str                  # 작성자 / 검토자 / 승인자
    name: str = ""
    department: str = ""


class ApprovalSetupRequest(BaseModel):
    """결재선 초기화 요청 (승인 직후 호출)"""
    approvers: List[ApproverInfo]


class ApprovalUpdateRequest(BaseModel):
    """결재자 이름·부서 수정"""
    name: Optional[str] = None
    department: Optional[str] = None


class ApprovalSignRequest(BaseModel):
    """결재 완료 처리 (이름·부서를 마지막으로 갱신 가능)"""
    name: Optional[str] = None
    department: Optional[str] = None


class ApprovalRecord(BaseModel):
    """결재 레코드 응답"""
    id: str
    review_id: str
    role: str
    order_seq: int
    name: str
    department: str
    status: ApprovalStatus
    signed_at: Optional[str] = None
    created_at: str
