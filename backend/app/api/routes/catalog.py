from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/formations", tags=["formations"])

FORMATIONS_SEED = [
  {
    "id": 1,
    "slug": "design-graphique-fondamental",
    "title": "Design Graphique Fondamental",
    "delivery_mode": "online",
    "price_amount": 60000,
    "price_currency": "XAF",
    "allow_installments": False,
  },
  {
    "id": 2,
    "slug": "brand-identity-intensive",
    "title": "Brand Identity Intensive",
    "delivery_mode": "onsite",
    "price_amount": 120000,
    "price_currency": "XAF",
    "allow_installments": True,
  },
  {
    "id": 3,
    "slug": "motion-design-bootcamp",
    "title": "Motion Design Bootcamp",
    "delivery_mode": "onsite",
    "price_amount": 150000,
    "price_currency": "XAF",
    "allow_installments": True,
  },
]


@router.get("")
def list_formations() -> list[dict[str, object]]:
    return FORMATIONS_SEED


@router.get("/{slug}")
def get_formation(slug: str) -> dict[str, object]:
    for formation in FORMATIONS_SEED:
        if formation["slug"] == slug:
            return formation

    raise HTTPException(status_code=404, detail="Formation introuvable.")
