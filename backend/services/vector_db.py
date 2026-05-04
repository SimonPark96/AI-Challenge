"""
ChromaDB 기반 단가 벡터 데이터베이스
한국어 지원을 위해 multilingual 임베딩 모델 사용
"""
import chromadb
from chromadb.utils import embedding_functions
from typing import List, Optional
import uuid
import logging
from config import CHROMA_DB_PATH
from models.schemas import PriceDataItem, SimilarCase

logger = logging.getLogger(__name__)

# 한국어 지원 multilingual 임베딩
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"


def _get_client_and_collections():
    """ChromaDB 클라이언트와 컬렉션 반환 (지연 초기화)"""
    client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBED_MODEL
    )
    internal_col = client.get_or_create_collection(
        name="internal_prices",
        embedding_function=ef,
        metadata={"description": "사내 실적 단가 데이터"}
    )
    external_col = client.get_or_create_collection(
        name="external_prices",
        embedding_function=ef,
        metadata={"description": "외부 물가정보 단가 데이터"}
    )
    return client, internal_col, external_col


def _make_document(item: PriceDataItem) -> str:
    """검색을 위한 텍스트 문서 생성"""
    return (
        f"공종: {item.work_type} "
        f"품목: {item.item} "
        f"규격: {item.spec} "
        f"단위: {item.unit} "
        f"지역: {item.region} "
        f"비고: {item.notes}"
    )


def _make_metadata(item: PriceDataItem) -> dict:
    return {
        "work_type": item.work_type,
        "item": item.item,
        "spec": item.spec,
        "unit": item.unit,
        "unit_price": item.unit_price,
        "project_name": item.project_name,
        "region": item.region,
        "period": item.period,
        "source": item.source,
        "notes": item.notes,
    }


def add_internal_prices(items: List[PriceDataItem]) -> int:
    """사내 실적 단가 데이터 추가"""
    _, internal_col, _ = _get_client_and_collections()
    documents, metadatas, ids = [], [], []
    for item in items:
        doc_id = item.id or str(uuid.uuid4())
        documents.append(_make_document(item))
        metadatas.append(_make_metadata(item))
        ids.append(doc_id)
    internal_col.add(documents=documents, metadatas=metadatas, ids=ids)
    logger.info(f"내부 단가 {len(items)}건 추가 완료")
    return len(items)


def add_external_prices(items: List[PriceDataItem]) -> int:
    """외부 물가 데이터 추가"""
    _, _, external_col = _get_client_and_collections()
    documents, metadatas, ids = [], [], []
    for item in items:
        doc_id = item.id or str(uuid.uuid4())
        documents.append(_make_document(item))
        metadatas.append(_make_metadata(item))
        ids.append(doc_id)
    external_col.add(documents=documents, metadatas=metadatas, ids=ids)
    logger.info(f"외부 단가 {len(items)}건 추가 완료")
    return len(items)


def search_similar_prices(
    item: str,
    spec: str,
    work_type: str = "",
    region: str = "",
    n_results: int = 5,
) -> List[SimilarCase]:
    """RAG: 유사 단가 사례 검색 (내부 + 외부 통합)"""
    query = f"공종: {work_type} 품목: {item} 규격: {spec} 지역: {region}"
    _, internal_col, external_col = _get_client_and_collections()

    results: List[SimilarCase] = []

    def _extract(col, n):
        count = col.count()
        if count == 0:
            return []
        actual_n = min(n, count)
        try:
            res = col.query(query_texts=[query], n_results=actual_n)
        except Exception as e:
            logger.warning(f"검색 오류: {e}")
            return []
        cases = []
        for i, meta in enumerate(res["metadatas"][0]):
            dist = res["distances"][0][i] if res.get("distances") else 1.0
            similarity = max(0.0, round(1 - dist / 2, 3))
            cases.append(SimilarCase(
                item=meta.get("item", ""),
                spec=meta.get("spec", ""),
                unit_price=float(meta.get("unit_price", 0)),
                project_name=meta.get("project_name", ""),
                period=meta.get("period", ""),
                source=meta.get("source", ""),
                similarity=similarity,
            ))
        return cases

    results.extend(_extract(internal_col, n_results))
    results.extend(_extract(external_col, n_results))

    # 유사도 순 정렬, 상위 n_results 반환
    results.sort(key=lambda x: x.similarity, reverse=True)
    return results[:n_results]


def clear_all() -> dict:
    """모든 단가 데이터 삭제"""
    client, internal_col, external_col = _get_client_and_collections()
    ic = internal_col.count()
    ec = external_col.count()
    client.delete_collection("internal_prices")
    client.delete_collection("external_prices")
    logger.info(f"DB 초기화 완료 (내부 {ic}건, 외부 {ec}건 삭제)")
    return {"deleted_internal": ic, "deleted_external": ec}


def get_stats() -> dict:
    """DB 통계 반환"""
    try:
        _, internal_col, external_col = _get_client_and_collections()
        return {
            "internal_count": internal_col.count(),
            "external_count": external_col.count(),
        }
    except Exception:
        return {"internal_count": 0, "external_count": 0}
