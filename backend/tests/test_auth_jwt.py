from __future__ import annotations

from datetime import timedelta
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from sqlalchemy import select


TEST_DB_PATH = Path(__file__).resolve().parent / "test_auth_jwt.sqlite3"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["JWT_SECRET_KEY"] = "academie-des-creatifs-test-secret"
os.environ["ALLOWED_ORIGINS"] = (
    "http://localhost:3000,http://127.0.0.1:3000,"
    "http://localhost:5173,http://127.0.0.1:5173"
)
os.environ["TARA_API_KEY"] = ""
os.environ["TARA_BUSINESS_ID"] = ""
os.environ["TARA_WEBHOOK_SECRET"] = ""

from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.seed import seed_database
from app.services.tara_money import TaraPaymentLinks
from app.models.entities import PaymentRecord, UserRecord
from app.db.session import SessionLocal, engine
from app.main import app


class JwtAuthenticationFlowTests(unittest.TestCase):
    def auth_headers(self, email: str, password: str) -> dict[str, str]:
        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": email,
                "password": password,
                "remember_me": False,
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    @classmethod
    def setUpClass(cls) -> None:
        if TEST_DB_PATH.exists():
            TEST_DB_PATH.unlink()

        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        if TEST_DB_PATH.exists():
            TEST_DB_PATH.unlink()

    def test_register_returns_jwt_and_unlocks_cart(self) -> None:
        response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Test Student",
                "email": "jwt-student@example.com",
                "phone": "+237680001111",
                "password": "Student123!",
            },
        )

        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        self.assertIn("access_token", payload)
        token = payload["access_token"]
        self.assertTrue(isinstance(token, str) and token)

        headers = {"Authorization": f"Bearer {token}"}

        me_response = self.client.get("/api/v1/auth/me", headers=headers)
        self.assertEqual(me_response.status_code, 200, me_response.text)
        self.assertEqual(me_response.json()["user"]["email"], "jwt-student@example.com")

        cart_response = self.client.post(
            "/api/v1/cart/items",
            headers=headers,
            json={"formation_slug": "deviens-un-brand-designer"},
        )
        self.assertEqual(cart_response.status_code, 200, cart_response.text)
        self.assertEqual(len(cart_response.json()["items"]), 1)

    def test_login_returns_jwt_and_allows_cart_read(self) -> None:
        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": "melvine@example.com",
                "password": "Student123!",
                "remember_me": False,
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertIn("access_token", payload)

        headers = {"Authorization": f"Bearer {payload['access_token']}"}

        cart_response = self.client.get("/api/v1/cart", headers=headers)
        self.assertEqual(cart_response.status_code, 200, cart_response.text)
        self.assertIn("items", cart_response.json())

    def test_register_checkout_unlocks_enrollments_and_dashboard(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Checkout Student",
                "email": "checkout-student@example.com",
                "phone": "+237680001112",
                "password": "Student123!",
            },
        )

        self.assertEqual(register_response.status_code, 201, register_response.text)
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        add_cart_response = self.client.post(
            "/api/v1/cart/items",
            headers=headers,
            json={"formation_slug": "deviens-un-brand-designer"},
        )
        self.assertEqual(add_cart_response.status_code, 200, add_cart_response.text)
        self.assertEqual(len(add_cart_response.json()["items"]), 1)

        checkout_response = self.client.post("/api/v1/cart/checkout", headers=headers)
        self.assertEqual(checkout_response.status_code, 200, checkout_response.text)
        self.assertEqual(checkout_response.json()["processed_items"], 1)

        enrollments_response = self.client.get("/api/v1/me/enrollments", headers=headers)
        self.assertEqual(enrollments_response.status_code, 200, enrollments_response.text)
        self.assertEqual(len(enrollments_response.json()), 1)

        dashboard_response = self.client.get("/api/v1/me/dashboard", headers=headers)
        self.assertEqual(dashboard_response.status_code, 200, dashboard_response.text)
        dashboard_payload = dashboard_response.json()
        self.assertEqual(dashboard_payload["guided_enrollments_count"], 1)
        self.assertEqual(dashboard_payload["classic_enrollments_count"], 0)

    def test_checkout_uses_tara_links_when_gateway_is_configured(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Tara Student",
                "email": "tara-student@example.com",
                "phone": "+237680001115",
                "password": "Student123!",
            },
        )

        self.assertEqual(register_response.status_code, 201, register_response.text)
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        add_cart_response = self.client.post(
            "/api/v1/cart/items",
            headers=headers,
            json={"formation_slug": "bootcamp-brand-designer-presentiel"},
        )
        self.assertEqual(add_cart_response.status_code, 200, add_cart_response.text)

        with (
            patch("app.services.commerce.is_tara_money_configured", return_value=True),
            patch(
                "app.services.commerce.create_tara_payment_link",
                return_value=TaraPaymentLinks(
                    dikalo_link="https://dikalo.me/pay/test-link",
                    whatsapp_link="https://wa.me/test-link",
                ),
            ),
        ):
            checkout_response = self.client.post(
                "/api/v1/cart/checkout",
                headers=headers,
                json={"use_installments": True},
            )

        self.assertEqual(checkout_response.status_code, 200, checkout_response.text)
        payload = checkout_response.json()
        self.assertEqual(payload["payment_provider"], "tara_money")
        self.assertEqual(payload["external_redirect_url"], "https://dikalo.me/pay/test-link")
        self.assertEqual(payload["redirect_path"], "/espace/etudiant/paiements")

        enrollments_response = self.client.get("/api/v1/me/enrollments", headers=headers)
        self.assertEqual(enrollments_response.status_code, 200, enrollments_response.text)
        self.assertEqual(enrollments_response.json(), [])

        orders_response = self.client.get("/api/v1/me/orders", headers=headers)
        self.assertEqual(orders_response.status_code, 200, orders_response.text)
        self.assertEqual(len(orders_response.json()), 1)
        self.assertEqual(orders_response.json()[0]["status"], "pending")

        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )
        first_payment_id = orders_response.json()[0]["payments"][0]["id"]
        confirm_response = self.client.patch(
            f"/api/v1/admin/payments/{first_payment_id}",
            headers=admin_headers,
            json={"status": "confirmed"},
        )
        self.assertEqual(confirm_response.status_code, 200, confirm_response.text)

        enrollments_after_confirm = self.client.get("/api/v1/me/enrollments", headers=headers)
        self.assertEqual(enrollments_after_confirm.status_code, 200, enrollments_after_confirm.text)
        self.assertEqual(len(enrollments_after_confirm.json()), 1)

    def test_stripe_checkout_can_be_confirmed_when_user_returns_from_payment(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Stripe Student",
                "email": "stripe-student@example.com",
                "phone": "+237680001119",
                "password": "Student123!",
            },
        )

        self.assertEqual(register_response.status_code, 201, register_response.text)
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        add_cart_response = self.client.post(
            "/api/v1/cart/items",
            headers=headers,
            json={"formation_slug": "deviens-un-brand-designer"},
        )
        self.assertEqual(add_cart_response.status_code, 200, add_cart_response.text)

        with (
            patch("app.services.commerce.is_stripe_configured", return_value=True),
            patch(
                "app.services.commerce.create_stripe_checkout_session",
                return_value="https://checkout.stripe.com/pay/cs_test_123",
            ),
        ):
            checkout_response = self.client.post(
                "/api/v1/cart/checkout",
                headers=headers,
                json={"payment_provider": "stripe"},
            )

        self.assertEqual(checkout_response.status_code, 200, checkout_response.text)
        payload = checkout_response.json()
        self.assertEqual(payload["payment_provider"], "stripe")
        self.assertEqual(payload["external_redirect_url"], "https://checkout.stripe.com/pay/cs_test_123")
        order_reference = payload["order_references"][0]

        enrollments_before_confirm = self.client.get("/api/v1/me/enrollments", headers=headers)
        self.assertEqual(enrollments_before_confirm.status_code, 200, enrollments_before_confirm.text)
        self.assertEqual(enrollments_before_confirm.json(), [])

        with (
            patch(
                "app.api.routes.stripe_webhook.retrieve_stripe_checkout_session",
                return_value={
                    "payment_status": "paid",
                    "metadata": {"order_references": order_reference},
                },
            ),
            patch("app.api.routes.stripe_webhook.send_order_confirmation_for_orders") as mocked_email,
        ):
            confirm_response = self.client.post(
                "/api/v1/stripe/checkout/confirm",
                headers=headers,
                json={"session_id": "cs_test_123"},
            )

        self.assertEqual(confirm_response.status_code, 200, confirm_response.text)
        confirm_payload = confirm_response.json()
        self.assertEqual(confirm_payload["status"], "confirmed")
        self.assertEqual(confirm_payload["matched_orders"], [order_reference])
        self.assertEqual(confirm_payload["newly_confirmed_orders"], [order_reference])
        mocked_email.assert_called_once()

        enrollments_after_confirm = self.client.get("/api/v1/me/enrollments", headers=headers)
        self.assertEqual(enrollments_after_confirm.status_code, 200, enrollments_after_confirm.text)
        self.assertEqual(len(enrollments_after_confirm.json()), 1)

        orders_response = self.client.get("/api/v1/me/orders", headers=headers)
        self.assertEqual(orders_response.status_code, 200, orders_response.text)
        self.assertEqual(orders_response.json()[0]["status"], "paid")

    def test_live_cart_over_threshold_can_use_installments(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Threshold Student",
                "email": "threshold-student@example.com",
                "phone": "+237680001116",
                "password": "Student123!",
            },
        )

        self.assertEqual(register_response.status_code, 201, register_response.text)
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        first_add = self.client.post(
            "/api/v1/cart/items",
            headers=headers,
            json={"formation_slug": "deviens-un-brand-designer"},
        )
        self.assertEqual(first_add.status_code, 200, first_add.text)

        second_add = self.client.post(
            "/api/v1/cart/items",
            headers=headers,
            json={"formation_slug": "motion-design-par-la-pratique"},
        )
        self.assertEqual(second_add.status_code, 200, second_add.text)

        cart_response = self.client.get("/api/v1/cart", headers=headers)
        self.assertEqual(cart_response.status_code, 200, cart_response.text)
        self.assertTrue(cart_response.json()["allow_installments"])

        checkout_response = self.client.post(
            "/api/v1/cart/checkout",
            headers=headers,
            json={"use_installments": True},
        )
        self.assertEqual(checkout_response.status_code, 200, checkout_response.text)
        payload = checkout_response.json()
        self.assertEqual(len(payload["installment_schedules"]), 2)

        orders_response = self.client.get("/api/v1/me/orders", headers=headers)
        self.assertEqual(orders_response.status_code, 200, orders_response.text)
        self.assertTrue(all(order["status"] == "partially_paid" for order in orders_response.json()))

    def test_cart_requires_authentication_without_jwt(self) -> None:
        self.client.cookies.clear()
        response = self.client.post(
            "/api/v1/cart/items",
            json={"formation_slug": "deviens-un-brand-designer"},
        )
        self.assertEqual(response.status_code, 401, response.text)

    def test_tara_webhook_requires_token_when_secret_is_set(self) -> None:
        with patch(
            "app.api.routes.tara.settings",
            SimpleNamespace(tara_webhook_secret="test-secret"),
        ):
            response = self.client.post("/api/v1/tara/webhook", json={})

        self.assertEqual(response.status_code, 403, response.text)

    def test_checkout_preflight_allows_localhost_3000(self) -> None:
        response = self.client.options(
            "/api/v1/cart/checkout",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "http://localhost:3000",
        )

    def test_admin_can_upload_media_asset(self) -> None:
        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )
        payload = b"fake-image-content"

        upload_response = self.client.post(
            "/api/v1/admin/uploads?filename=cover-test.png",
            headers={
                **admin_headers,
                "Content-Type": "image/png",
            },
            content=payload,
        )
        self.assertEqual(upload_response.status_code, 201, upload_response.text)
        body = upload_response.json()
        self.assertEqual(body["content_type"], "image/png")
        self.assertEqual(body["size"], len(payload))
        self.assertTrue(body["path"].startswith("/uploads/admin-media/"))

        fetch_response = self.client.get(body["path"])
        self.assertEqual(fetch_response.status_code, 200, fetch_response.text)
        self.assertEqual(fetch_response.content, payload)

        uploaded_file = Path(__file__).resolve().parents[1] / body["path"].lstrip("/").replace("/", os.sep)
        if uploaded_file.exists():
            uploaded_file.unlink()

    def test_admin_can_supervise_enrollments_with_session_and_payment_context(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Enrollment Admin Test",
                "email": "enrollment-admin-test@example.com",
                "phone": "+237680001113",
                "password": "Student123!",
            },
        )
        self.assertEqual(register_response.status_code, 201, register_response.text)
        student_headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}

        add_cart_response = self.client.post(
            "/api/v1/cart/items",
            headers=student_headers,
            json={"formation_slug": "deviens-un-brand-designer"},
        )
        self.assertEqual(add_cart_response.status_code, 200, add_cart_response.text)

        checkout_response = self.client.post("/api/v1/cart/checkout", headers=student_headers)
        self.assertEqual(checkout_response.status_code, 200, checkout_response.text)

        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )
        enrollments_response = self.client.get("/api/v1/admin/enrollments", headers=admin_headers)
        self.assertEqual(enrollments_response.status_code, 200, enrollments_response.text)

        enrollment = next(
            item
            for item in enrollments_response.json()
            if item["student_email"] == "enrollment-admin-test@example.com"
        )
        self.assertEqual(enrollment["order_status"], "paid")
        self.assertEqual(enrollment["payments_count"], 1)
        self.assertEqual(enrollment["confirmed_payments_count"], 1)
        self.assertIsNotNone(enrollment["session_id"])
        session_id = enrollment["session_id"]

        patch_response = self.client.patch(
            f"/api/v1/admin/enrollments/{enrollment['id']}",
            headers=admin_headers,
            json={"status": "suspended"},
        )
        self.assertEqual(patch_response.status_code, 200, patch_response.text)
        self.assertEqual(patch_response.json()["status"], "suspended")

        refreshed_enrollments = self.client.get("/api/v1/admin/enrollments", headers=admin_headers)
        self.assertEqual(refreshed_enrollments.status_code, 200, refreshed_enrollments.text)
        refreshed_row = next(
            item
            for item in refreshed_enrollments.json()
            if item["id"] == enrollment["id"]
        )
        self.assertEqual(refreshed_row["status"], "suspended")

    def test_installment_payments_can_be_marked_late_and_reminded(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Installment Student",
                "email": "installment-student@example.com",
                "phone": "+237680001114",
                "password": "Student123!",
            },
        )
        self.assertEqual(register_response.status_code, 201, register_response.text)
        student_headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}

        add_cart_response = self.client.post(
            "/api/v1/cart/items",
            headers=student_headers,
            json={"formation_slug": "bootcamp-brand-designer-presentiel"},
        )
        self.assertEqual(add_cart_response.status_code, 200, add_cart_response.text)

        checkout_response = self.client.post(
            "/api/v1/cart/checkout",
            headers=student_headers,
            json={"use_installments": True},
        )
        self.assertEqual(checkout_response.status_code, 200, checkout_response.text)
        order_reference = checkout_response.json()["order_references"][0]

        db = SessionLocal()
        try:
            upcoming_payment = db.scalar(
                select(PaymentRecord).where(
                    PaymentRecord.order_reference == order_reference,
                    PaymentRecord.installment_number == 2,
                )
            )
            self.assertIsNotNone(upcoming_payment)
            upcoming_payment.due_date = upcoming_payment.due_date - timedelta(days=31)
            db.add(upcoming_payment)
            db.commit()
        finally:
            db.close()

        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )

        payments_response = self.client.get("/api/v1/admin/payments", headers=admin_headers)
        self.assertEqual(payments_response.status_code, 200, payments_response.text)
        late_payment = next(
            item
            for item in payments_response.json()
            if item["order_reference"] == order_reference and item["installment_number"] == 2
        )
        self.assertEqual(late_payment["status"], "late")
        self.assertEqual(late_payment["order_status"], "partially_paid")
        self.assertTrue(late_payment["can_send_reminder"])

        reminder_response = self.client.post(
            f"/api/v1/admin/payments/{late_payment['id']}/reminders",
            headers=admin_headers,
        )
        self.assertEqual(reminder_response.status_code, 200, reminder_response.text)
        self.assertEqual(reminder_response.json()["reminder_count"], 1)
        self.assertIsNotNone(reminder_response.json()["last_reminded_at"])

        notifications_response = self.client.get("/api/v1/me/notifications", headers=student_headers)
        self.assertEqual(notifications_response.status_code, 200, notifications_response.text)
        self.assertTrue(
            any(
                item["title"] == "Échéance en retard"
                for item in notifications_response.json()
            )
        )

        confirm_second = self.client.patch(
            f"/api/v1/admin/payments/{late_payment['id']}",
            headers=admin_headers,
            json={"status": "confirmed"},
        )
        self.assertEqual(confirm_second.status_code, 200, confirm_second.text)

        payments_after_second = self.client.get("/api/v1/admin/payments", headers=admin_headers)
        third_payment = next(
            item
            for item in payments_after_second.json()
            if item["order_reference"] == order_reference and item["installment_number"] == 3
        )
        confirm_third = self.client.patch(
            f"/api/v1/admin/payments/{third_payment['id']}",
            headers=admin_headers,
            json={"status": "confirmed"},
        )
        self.assertEqual(confirm_third.status_code, 200, confirm_third.text)
        self.assertEqual(confirm_third.json()["order_status"], "paid")

    def test_live_formation_without_session_cannot_be_added_to_cart(self) -> None:
        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )

        create_response = self.client.post(
            "/api/v1/admin/formations",
            headers=admin_headers,
            json={
                "slug": "live-sans-session-test",
                "title": "Live sans session",
                "category": "Formation creative",
                "level": "Niveau debutant",
                "image": "/Flyers/brand-identity.jpg",
                "format_type": "live",
                "current_price_amount": 45000,
                "original_price_amount": None,
                "is_featured_home": False,
                "home_feature_rank": 100,
                "rating": 0,
                "reviews": 0,
                "badges": [],
            },
        )
        self.assertEqual(create_response.status_code, 201, create_response.text)

        student_headers = self.auth_headers(
            "melvine@example.com",
            "Student123!",
        )

        cart_response = self.client.post(
            "/api/v1/cart/items",
            headers=student_headers,
            json={"formation_slug": "live-sans-session-test"},
        )
        self.assertEqual(cart_response.status_code, 400, cart_response.text)
        self.assertIn("Inscriptions closes", cart_response.text)

    def test_student_live_events_route_uses_me_prefix_once(self) -> None:
        student_headers = self.auth_headers(
            "melvine@example.com",
            "Student123!",
        )

        response = self.client.get("/api/v1/me/live-events", headers=student_headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsInstance(response.json(), list)

    def test_admin_can_create_formation_with_rich_detail_content(self) -> None:
        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )

        create_response = self.client.post(
            "/api/v1/admin/formations",
            headers=admin_headers,
            json={
                "slug": "formation-detail-admin-test",
                "title": "Formation detail admin test",
                "category": "Brand design",
                "level": "Niveau intermediaire",
                "image": "/Flyers/brand-identity.jpg",
                "format_type": "ligne",
                "current_price_amount": 70000,
                "original_price_amount": 95000,
                "is_featured_home": True,
                "home_feature_rank": 4,
                "rating": 4.5,
                "reviews": 18,
                "badges": ["premium", "populaire"],
                "intro": "Une fiche detaillee alimentee depuis le dashboard admin.",
                "mentor_name": "Francis Kenne",
                "mentor_label": "Directeur de creation",
                "mentor_image": "/Teams/photo-fk.jpg",
                "included": [
                    "Acces a tous les chapitres",
                    "Corrections de rendus",
                ],
                "objectives": [
                    "Construire un systeme de marque solide",
                    "Presenter une proposition defendable",
                ],
                "projects": [
                    {
                        "title": "Etude de cas branding",
                        "image": "/Flyers/brand-identity.jpg",
                        "kind": "image",
                    },
                    {
                        "title": "Presentation video du projet final",
                        "image": "/Flyers/anim-logo.mp4",
                        "kind": "video",
                        "poster": "/Flyers/anim-logo.png",
                    },
                ],
                "audience_text": "Pour les graphistes qui veulent structurer une offre plus haut de gamme.",
                "modules": [
                    {
                        "title": "Module 1 - Positionnement",
                        "summary": "Clarifier l'offre et la direction visuelle.",
                        "duration": "2h 30",
                        "lessons": [
                            "Audit des references",
                            "Choix du territoire visuel",
                        ],
                    }
                ],
                "faqs": [
                    {
                        "question": "Le programme reste-t-il accessible ?",
                        "answer": "Oui, l'espace reste disponible apres activation de l'acces.",
                    }
                ],
            },
        )
        self.assertEqual(create_response.status_code, 201, create_response.text)
        payload = create_response.json()

        self.assertEqual(payload["intro"], "Une fiche detaillee alimentee depuis le dashboard admin.")
        self.assertEqual(payload["mentor_name"], "Francis Kenne")
        self.assertEqual(payload["included"], ["Acces a tous les chapitres", "Corrections de rendus"])
        self.assertEqual(payload["projects"][1]["kind"], "video")
        self.assertEqual(payload["projects"][1]["poster"], "/Flyers/anim-logo.png")
        self.assertEqual(payload["certificate_image"], "/certicate.jpg")
        self.assertEqual(payload["modules"][0]["summary"], "Clarifier l'offre et la direction visuelle.")
        self.assertEqual(payload["modules"][0]["duration"], "2h 30")
        self.assertEqual(payload["modules"][0]["lessons"], ["Audit des references", "Choix du territoire visuel"])
        self.assertEqual(payload["faqs"][0]["question"], "Le programme reste-t-il accessible ?")

        public_response = self.client.get("/api/v1/formations/formation-detail-admin-test")
        self.assertEqual(public_response.status_code, 200, public_response.text)
        public_payload = public_response.json()
        self.assertEqual(
            public_payload["certificate_copy"],
            "Une attestation de fin de parcours peut etre delivree apres validation des exigences de la formation et completion des etapes obligatoires du programme.",
        )
        self.assertEqual(public_payload["certificate_image"], "/certicate.jpg")
        self.assertEqual(public_payload["modules"][0]["duration"], "2h 30")
        self.assertEqual(public_payload["faqs"][0]["answer"], "Oui, l'espace reste disponible apres activation de l'acces.")

    def test_admin_can_create_multiple_sessions_for_same_formation(self) -> None:
        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )

        create_formation_response = self.client.post(
            "/api/v1/admin/formations",
            headers=admin_headers,
            json={
                "slug": "live-avec-session-test",
                "title": "Live avec plusieurs sessions",
                "category": "Formation creative",
                "level": "Niveau intermediaire",
                "image": "/Flyers/Motion-design.jpg",
                "format_type": "live",
                "current_price_amount": 60000,
                "original_price_amount": 80000,
                "is_featured_home": False,
                "home_feature_rank": 100,
                "rating": 4,
                "reviews": 10,
                "badges": ["premium"],
            },
        )
        self.assertEqual(create_formation_response.status_code, 201, create_formation_response.text)
        formation_id = create_formation_response.json()["id"]

        first_session_response = self.client.post(
            "/api/v1/admin/onsite-sessions",
            headers=admin_headers,
            json={
                "formation_id": formation_id,
                "label": "Cohorte avril",
                "start_date": "2026-04-20",
                "end_date": "2026-04-30",
                "campus_label": "Campus Douala",
                "seat_capacity": 20,
                "teacher_name": "Bihee Alex",
                "status": "planned",
            },
        )
        self.assertEqual(first_session_response.status_code, 201, first_session_response.text)
        self.assertTrue(
            first_session_response.json()["meeting_link"].startswith("https://meet.jit.si/"),
        )

        second_session_response = self.client.post(
            "/api/v1/admin/onsite-sessions",
            headers=admin_headers,
            json={
                "formation_id": formation_id,
                "label": "Cohorte mai",
                "start_date": "2026-05-05",
                "end_date": "2026-05-15",
                "campus_label": "Campus Douala",
                "seat_capacity": 20,
                "teacher_name": "Bihee Alex",
                "status": "planned",
            },
        )
        self.assertEqual(second_session_response.status_code, 201, second_session_response.text)
        self.assertTrue(
            second_session_response.json()["meeting_link"].startswith("https://meet.jit.si/"),
        )

    def test_teacher_cannot_schedule_live_event_outside_session_dates(self) -> None:
        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )
        teacher_headers = self.auth_headers(
            "alex@academiedescreatifs.com",
            "Teacher123!",
        )

        create_formation_response = self.client.post(
            "/api/v1/admin/formations",
            headers=admin_headers,
            json={
                "slug": "live-calendrier-session-test",
                "title": "Live calendrier session test",
                "category": "Formation creative",
                "level": "Niveau intermediaire",
                "image": "/Flyers/Motion-design.jpg",
                "format_type": "live",
                "current_price_amount": 60000,
                "original_price_amount": None,
                "is_featured_home": False,
                "home_feature_rank": 100,
                "rating": 4,
                "reviews": 10,
                "badges": ["premium"],
            },
        )
        self.assertEqual(create_formation_response.status_code, 201, create_formation_response.text)
        formation_id = create_formation_response.json()["id"]
        formation_slug = create_formation_response.json()["slug"]

        db = SessionLocal()
        try:
            teacher = db.scalar(select(UserRecord).where(UserRecord.email == "alex@academiedescreatifs.com"))
            self.assertIsNotNone(teacher)
            teacher_id = teacher.id
        finally:
            db.close()

        assign_response = self.client.post(
            f"/api/v1/admin/formations/{formation_slug}/teachers",
            headers=admin_headers,
            json={"teacher_id": teacher_id},
        )
        self.assertEqual(assign_response.status_code, 201, assign_response.text)

        teacher_create_session_response = self.client.post(
            f"/api/v1/teacher/formations/{formation_id}/sessions",
            headers=teacher_headers,
            json={
                "label": "Session fevrier 2026",
                "start_date": "2026-02-01",
                "end_date": "2026-04-30",
                "campus_label": "Jitsi",
                "seat_capacity": 20,
                "status": "planned",
            },
        )
        self.assertIn(teacher_create_session_response.status_code, {404, 405}, teacher_create_session_response.text)

        session_response = self.client.post(
            "/api/v1/admin/onsite-sessions",
            headers=admin_headers,
            json={
                "formation_id": formation_id,
                "label": "Session fevrier 2026",
                "start_date": "2026-02-01",
                "end_date": "2026-04-30",
                "campus_label": "Jitsi",
                "seat_capacity": 20,
                "teacher_name": "Bihee Alex",
                "status": "planned",
            },
        )
        self.assertEqual(session_response.status_code, 201, session_response.text)
        session_id = session_response.json()["id"]
        self.assertTrue(session_response.json()["meeting_link"].startswith("https://meet.jit.si/"))

        teacher_update_session_response = self.client.patch(
            f"/api/v1/teacher/sessions/{session_id}",
            headers=teacher_headers,
            json={"label": "Tentative de modification"},
        )
        self.assertIn(teacher_update_session_response.status_code, {404, 405}, teacher_update_session_response.text)

        valid_event_response = self.client.post(
            f"/api/v1/teacher/sessions/{session_id}/live-events",
            headers=teacher_headers,
            json={
                "title": "Cours 1",
                "scheduled_at": "2026-03-10T09:00:00Z",
                "duration_minutes": 90,
            },
        )
        self.assertEqual(valid_event_response.status_code, 201, valid_event_response.text)
        live_event_id = valid_event_response.json()["id"]

        course_days_response = self.client.get(
            f"/api/v1/teacher/sessions/{session_id}/course-days",
            headers=teacher_headers,
        )
        self.assertEqual(course_days_response.status_code, 200, course_days_response.text)
        course_days = course_days_response.json()
        self.assertEqual(len(course_days), 1)
        self.assertEqual(course_days[0]["title"], "Cours 1")
        self.assertEqual(course_days[0]["live_event_id"], live_event_id)
        course_day_id = course_days[0]["id"]

        quiz_response = self.client.post(
            f"/api/v1/teacher/sessions/{session_id}/quizzes",
            headers=teacher_headers,
            json={
                "title": "Quiz cours 1",
                "course_day_id": course_day_id,
                "duration_minutes": 15,
                "questions": [
                    {
                        "order_index": 0,
                        "text": "Quel est le sujet ?",
                        "options": ["Branding", "Comptabilite"],
                        "correct_index": 0,
                    }
                ],
            },
        )
        self.assertEqual(quiz_response.status_code, 201, quiz_response.text)
        self.assertEqual(quiz_response.json()["course_day_id"], course_day_id)

        course_days_after_quiz_response = self.client.get(
            f"/api/v1/teacher/sessions/{session_id}/course-days",
            headers=teacher_headers,
        )
        self.assertEqual(course_days_after_quiz_response.status_code, 200, course_days_after_quiz_response.text)
        self.assertEqual(course_days_after_quiz_response.json()[0]["quiz_count"], 1)

        invalid_event_response = self.client.post(
            f"/api/v1/teacher/sessions/{session_id}/live-events",
            headers=teacher_headers,
            json={
                "title": "Cours hors session",
                "scheduled_at": "2026-05-01T09:00:00Z",
                "duration_minutes": 90,
            },
        )
        self.assertEqual(invalid_event_response.status_code, 400, invalid_event_response.text)
        self.assertIn("entre la date de debut et la date de fin", invalid_event_response.text)


if __name__ == "__main__":
    unittest.main()
