from __future__ import annotations

from importlib import import_module
from app.core.config import settings


def _get_stripe_module():
    try:
        return import_module("stripe")
    except ModuleNotFoundError:
        return None


def is_stripe_configured() -> bool:
    return bool(settings.stripe_secret_key and _get_stripe_module() is not None)


def create_stripe_checkout_session(
    order_references: list[str],
    line_items: list[dict],
    success_url: str,
    cancel_url: str,
    customer_email: str | None = None,
) -> str:
    stripe = _get_stripe_module()
    if stripe is None:
        raise RuntimeError("Le module Stripe n'est pas installe sur ce serveur.")
    stripe.api_key = settings.stripe_secret_key
    payload: dict[str, object] = {
        "payment_method_types": ["card"],
        "line_items": line_items,
        "mode": "payment",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"order_references": ",".join(order_references)},
    }
    if customer_email:
        payload["customer_email"] = customer_email
    session = stripe.checkout.Session.create(
        **payload,
    )
    return session.url or ""


def build_stripe_line_item(name: str, amount: int, currency: str) -> dict:
    return {
        "price_data": {
            "currency": currency.lower(),
            "product_data": {"name": name},
            "unit_amount": amount,
        },
        "quantity": 1,
    }


def build_stripe_success_url(frontend_url: str) -> str:
    return f"{frontend_url}/espace/etudiant?source=stripe&session_id={{CHECKOUT_SESSION_ID}}"


def build_stripe_cancel_url(frontend_url: str) -> str:
    return f"{frontend_url}/checkout"


def retrieve_stripe_checkout_session(session_id: str):
    stripe = _get_stripe_module()
    if stripe is None:
        raise RuntimeError("Le module Stripe n'est pas installe sur ce serveur.")
    if not session_id.strip():
        raise ValueError("L'identifiant de session Stripe est obligatoire.")
    stripe.api_key = settings.stripe_secret_key
    return stripe.checkout.Session.retrieve(session_id)


def stripe_checkout_session_is_paid(session: object) -> bool:
    return _session_value(session, "payment_status") == "paid"


def extract_stripe_order_references(session: object) -> list[str]:
    metadata = _session_value(session, "metadata") or {}
    raw_references = ""
    if isinstance(metadata, dict):
        raw_references = str(metadata.get("order_references") or "")
    else:
        raw_references = str(getattr(metadata, "order_references", "") or "")
    return [reference.strip() for reference in raw_references.split(",") if reference.strip()]


def _session_value(session: object, key: str):
    if isinstance(session, dict):
        return session.get(key)
    return getattr(session, key, None)
