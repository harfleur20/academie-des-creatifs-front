from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.models.entities import BlogPostRecord
from app.api.dependencies import require_roles

router = APIRouter(prefix="/blog", tags=["blog"])


# ── Schemas ──────────────────────────────────────────────────

class BlogPostOut(BaseModel):
    id: int
    slug: str
    title: str
    excerpt: str
    content: str
    cover_image: str
    author: str
    category: str
    is_featured: bool
    is_popular: bool
    published_at: str
    rating: float = 0
    reviews_count: int = 0

    class Config:
        from_attributes = True


class BlogPostCreate(BaseModel):
    slug: str
    title: str
    excerpt: str = ""
    content: str = ""
    cover_image: str = ""
    author: str = "Francis Kenne"
    category: str = ""
    is_featured: bool = False
    is_popular: bool = False
    published_at: str = ""


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image: Optional[str] = None
    author: Optional[str] = None
    category: Optional[str] = None
    is_featured: Optional[bool] = None
    is_popular: Optional[bool] = None
    published_at: Optional[str] = None


class RatePayload(BaseModel):
    stars: int = Field(..., ge=1, le=5)


# ── Public routes ─────────────────────────────────────────────

@router.get("", response_model=list[BlogPostOut])
def list_posts(db: Session = Depends(get_db)):
    result = db.execute(
        select(BlogPostRecord).order_by(BlogPostRecord.created_at.desc())
    )
    return result.scalars().all()


@router.get("/featured", response_model=list[BlogPostOut])
def featured_posts(db: Session = Depends(get_db)):
    result = db.execute(
        select(BlogPostRecord)
        .where(BlogPostRecord.is_popular == True)
        .order_by(BlogPostRecord.created_at.desc())
        .limit(4)
    )
    return result.scalars().all()


@router.post("/{slug}/rate", response_model=BlogPostOut)
def rate_post(slug: str, payload: RatePayload, db: Session = Depends(get_db)):
    result = db.execute(select(BlogPostRecord).where(BlogPostRecord.slug == slug))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Article introuvable")

    total = post.rating * post.reviews_count + payload.stars
    post.reviews_count += 1
    post.rating = round(total / post.reviews_count, 1)
    db.commit()
    db.refresh(post)
    return post


@router.get("/{slug}", response_model=BlogPostOut)
def get_post(slug: str, db: Session = Depends(get_db)):
    result = db.execute(
        select(BlogPostRecord).where(BlogPostRecord.slug == slug)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Article introuvable")
    return post


# ── Admin CRUD ────────────────────────────────────────────────

@router.post("/admin", response_model=BlogPostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: BlogPostCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles("admin")),
):
    existing = db.execute(
        select(BlogPostRecord).where(BlogPostRecord.slug == payload.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Un article avec ce slug existe déjà")

    post = BlogPostRecord(**payload.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.put("/admin/{post_id}", response_model=BlogPostOut)
def update_post(
    post_id: int,
    payload: BlogPostUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles("admin")),
):
    result = db.execute(
        select(BlogPostRecord).where(BlogPostRecord.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Article introuvable")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(post, field, value)

    db.commit()
    db.refresh(post)
    return post


@router.delete("/admin/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles("admin")),
):
    result = db.execute(
        select(BlogPostRecord).where(BlogPostRecord.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Article introuvable")

    db.delete(post)
    db.commit()
