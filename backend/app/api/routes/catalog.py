from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.catalog import FormationCatalogItem
from app.services.catalog import get_catalog_item, list_catalog_items

router = APIRouter(prefix="/formations", tags=["formations"])


@router.get("", response_model=list[FormationCatalogItem])
def list_formations(db: Session = Depends(get_db)) -> list[FormationCatalogItem]:
    return list_catalog_items(db)


@router.get("/{slug}", response_model=FormationCatalogItem)
def get_formation(slug: str, db: Session = Depends(get_db)) -> FormationCatalogItem:
    formation = get_catalog_item(db, slug)
    if formation is not None:
        return formation

    raise HTTPException(status_code=404, detail="Formation introuvable.")
