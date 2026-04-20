from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings

SUCCESS_STATUSES = {"success", "successful", "paid", "confirmed", "completed"}
FAILURE_STATUSES = {"failed", "cancelled", "canceled", "expired"}
PRODUCT_ID_PREFIX = "tara-checkout:"
PAYMENT_ID_PREFIX = "tara-payments:"


@dataclass(frozen=True)
class TaraPaymentLinks:
    whatsapp_link: str | None = None
    telegram_link: str | None = None
    dikalo_link: str | None = None
    sms_link: str | None = None

    def preferred_redirect_url(self) -> str | None:
        return self.dikalo_link or self.whatsapp_link or self.telegram_link or self.sms_link


def is_tara_money_configured() -> bool:
    return bool(settings.tara_api_key and settings.tara_business_id)


def build_tara_product_id(order_references: list[str]) -> str:
    return PRODUCT_ID_PREFIX + ",".join(order_references)


def build_tara_payment_product_id(payment_ids: list[int]) -> str:
    return PAYMENT_ID_PREFIX + ",".join(str(payment_id) for payment_id in payment_ids)


def extract_order_references_from_product_id(product_id: str | None) -> list[str]:
    if not product_id or not product_id.startswith(PRODUCT_ID_PREFIX):
        return []
    payload = product_id[len(PRODUCT_ID_PREFIX):]
    return [item.strip() for item in payload.split(",") if item.strip()]


def extract_payment_ids_from_product_id(product_id: str | None) -> list[int]:
    if not product_id or not product_id.startswith(PAYMENT_ID_PREFIX):
        return []
    payload = product_id[len(PAYMENT_ID_PREFIX):]
    ids: list[int] = []
    for item in payload.split(","):
        item = item.strip()
        if item.isdigit():
            ids.append(int(item))
    return ids


def build_tara_return_url(order_references: list[str]) -> str:
    orders = ",".join(order_references)
    return f"{settings.frontend_url}/espace?gateway=tara&orders={orders}"


def build_tara_webhook_url() -> str:
    base_url = f"{settings.backend_public_url}{settings.api_prefix}/tara/webhook"
    if not settings.tara_webhook_secret:
        return base_url
    return f"{base_url}?{urlencode({'token': settings.tara_webhook_secret})}"


def create_tara_payment_link(
    *,
    product_id: str,
    product_name: str,
    product_price: int,
    product_description: str,
    product_picture_url: str,
    return_url: str,
    webhook_url: str,
) -> TaraPaymentLinks:
    if not is_tara_money_configured():
        raise ValueError("Tara Money n'est pas configure. Renseignez TARA_API_KEY et TARA_BUSINESS_ID.")

    payload = {
        "apiKey": settings.tara_api_key,
        "businessId": settings.tara_business_id,
        "productId": product_id,
        "productName": product_name,
        "productPrice": product_price,
        "productDescription": product_description,
        "productPictureUrl": product_picture_url,
        "returnUrl": return_url,
        "webHookUrl": webhook_url,
    }
    request = Request(
        settings.tara_paymentlinks_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=settings.tara_timeout_seconds) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="ignore")
        raise ValueError(
            f"Tara Money a refuse la demande de paiement ({error.code}). {body or 'Reessayez.'}"
        ) from error
    except URLError as error:
        raise ValueError("Impossible de joindre Tara Money pour le moment.") from error

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError("Reponse invalide recue depuis Tara Money.") from error

    if str(data.get("status", "")).lower() != "success":
        raise ValueError(str(data.get("message") or "Tara Money n'a pas genere de lien de paiement."))

    return TaraPaymentLinks(
        whatsapp_link=_extract_link(data, "whatsappLink"),
        telegram_link=_extract_link(data, "telegramLink"),
        dikalo_link=_extract_link(data, "dikaloLink"),
        sms_link=_extract_link(data, "smsLink"),
    )


def _extract_link(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def extract_tara_webhook_status(payload: dict[str, Any]) -> str | None:
    for key in ("status", "paymentStatus", "transactionStatus", "event", "state"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
    return None


def extract_tara_product_id(payload: dict[str, Any]) -> str | None:
    for key in ("productId", "product_id", "reference", "merchantReference"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def is_tara_success_status(status: str | None) -> bool:
    return bool(status and status in SUCCESS_STATUSES)


def is_tara_failure_status(status: str | None) -> bool:
    return bool(status and status in FAILURE_STATUSES)
