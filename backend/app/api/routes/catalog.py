from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.catalog import FormationCatalogItem, FormationDetailItem
from app.services.catalog import (
    get_catalog_detail_item,
    list_catalog_items,
)

router = APIRouter(prefix="/formations", tags=["formations"])


@router.get("", response_model=list[FormationCatalogItem])
def list_formations(db: Session = Depends(get_db)) -> list[FormationCatalogItem]:
    return list_catalog_items(db)


@router.get("/{slug}", response_model=FormationDetailItem)
def get_formation(slug: str, db: Session = Depends(get_db)) -> FormationDetailItem:
    formation = get_catalog_detail_item(db, slug)
    if formation is not None:
        return formation

    raise HTTPException(status_code=404, detail="Formation introuvable.")
