from uuid import UUID
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from typing import TYPE_CHECKING

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.organization import Organization


class Template(BaseModel):
    __tablename__ = "templates"

    # NULL = a shared, platform-curated template visible to every org (created via
    # the Owner console, not by any org's own staff) — see the RLS policy in
    # add_shared_template_library, which allows org_id IS NULL through on read but
    # still requires org_id = current_org_id on write, so only Owner-mode (which
    # bypasses this check entirely) can create or edit a shared template.
    org_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    category: Mapped[str] = mapped_column(String(100), nullable=False)

    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    # file_key is the path/identifier used to locate the file in R2 — not the file itself

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    content_type: Mapped[str] = mapped_column(String(100), nullable=False)

    version: Mapped[int] = mapped_column(nullable=False, default=1)

    # Free-text reference copy of the template's contents (e.g. for in-app preview
    # or future document-generation features) — not currently substituted or
    # rendered by anything. Edited in place via PATCH, unrelated to the binary
    # file's own versioning above.
    body: Mapped[str | None] = mapped_column(Text, nullable=True)