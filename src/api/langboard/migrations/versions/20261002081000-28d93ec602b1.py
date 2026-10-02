"""Seed a small multilingual global label catalog without replacing user definitions."""

from datetime import datetime, timezone
import sqlalchemy as sa
from alembic import op
from langboard_shared.core.types import SnowflakeID


revision = "28d93ec602b1"
down_revision = "17c82db591a0"
branch_labels = None
depends_on = None

# Labels describe work type, never workflow state, priority, assignment, or authorization.
DEFAULT_LABELS = (
    (
        "#EF4444",
        ("Bug", "버그", "不具合", "缺陷"),
        (
            "An existing behavior fails to meet its expected result; record reproduction and verification.",
            "기존 동작이 기대 결과와 다른 문제입니다. 재현 조건과 수정 검증을 기록합니다.",
            "既存の動作が期待する結果と異なる問題。再現条件と修正の検証を記録します。",
            "现有行为未达到预期结果；记录复现条件与修复验证。",
        ),
    ),
    (
        "#8B5CF6",
        ("Feature", "기능", "機能", "功能"),
        (
            "A new capability or deliverable; define the intended outcome and acceptance criteria.",
            "새로운 기능이나 결과물을 추가합니다. 목표 결과와 수용 기준을 정의합니다.",
            "新しい機能や成果物の追加。目標と受け入れ基準を定義します。",
            "新增能力或交付物；明确目标结果与验收标准。",
        ),
    ),
    (
        "#0EA5E9",
        ("Improvement", "개선", "改善", "改进"),
        (
            "Improve the usability, quality, efficiency, or performance of an existing capability.",
            "기존 기능의 사용성·품질·효율·성능을 개선합니다.",
            "既存機能の使いやすさ、品質、効率、性能を改善します。",
            "改进现有能力的易用性、质量、效率或性能。",
        ),
    ),
    (
        "#14B8A6",
        ("Documentation", "문서", "ドキュメント", "文档"),
        (
            "Create or update reusable instructions, specifications, decisions, or knowledge.",
            "재사용 가능한 안내·명세·의사결정·지식을 작성하거나 갱신합니다.",
            "再利用可能な手順、仕様、意思決定、知識を作成または更新します。",
            "创建或更新可复用的指南、规范、决策记录或知识。",
        ),
    ),
    (
        "#F97316",
        ("Security", "보안", "セキュリティ", "安全"),
        (
            "Address security, privacy, or access-control concerns; this label does not grant permission.",
            "보안·개인정보·접근 제어 관련 사항을 다룹니다. 이 라벨은 권한을 부여하지 않습니다.",
            "セキュリティ、プライバシー、アクセス制御の課題。このラベルは権限を付与しません。",
            "处理安全、隐私或访问控制事项；此标签不授予权限。",
        ),
    ),
    (
        "#64748B",
        ("Maintenance", "유지보수", "保守", "维护"),
        (
            "Routine upkeep, dependency updates, cleanup, or operational maintenance.",
            "정기 점검·의존성 갱신·정리·운영 유지보수 작업입니다.",
            "定期点検、依存関係の更新、整理、運用保守の作業。",
            "日常检查、依赖更新、清理或运行维护工作。",
        ),
    ),
)

global_label = sa.table(
    "global_label",
    sa.column("id", sa.BigInteger()),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
    sa.column("name", sa.String()),
    sa.column("color", sa.String()),
    sa.column("description", sa.String()),
    sa.column("translations", sa.JSON()),
)


def _rows_to_insert(existing_names: list[str]) -> list[dict]:
    existing = {name.strip().casefold() for name in existing_names}
    now = datetime.now(timezone.utc)
    return [
        {
            "id": int(SnowflakeID()),
            "created_at": now,
            "updated_at": now,
            "name": names[0],
            "color": color,
            "description": descriptions[0],
            "translations": {
                language: {"name": name, "description": description}
                for language, name, description in zip(("en", "ko", "ja", "zh"), names, descriptions, strict=True)
            },
        }
        for color, names, descriptions in DEFAULT_LABELS
        if names[0].casefold() not in existing
    ]


def upgrade() -> None:
    names = list(op.get_bind().execute(sa.select(global_label.c.name)).scalars())
    rows = _rows_to_insert(names)
    if rows:
        op.bulk_insert(global_label, rows)


def downgrade() -> None:
    """Retain user-visible definitions and any template or project references."""
