from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
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
from app.models.entities import (
    AssignmentRecord,
    AssignmentSubmissionRecord,
    AttendanceRecord,
    ChapterRecord,
    CourseRecord,
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    GradeRecord,
    LessonProgressRecord,
    LessonRecord,
    OrderRecord,
    PaymentRecord,
    QuizRecord,
    ResourceRecord,
    SessionCourseDayRecord,
    UserRecord,
)
from app.db.session import SessionLocal, engine
from app.main import app


TEST_FORMATION_FIXTURES = [
    {
        "slug": "maitrisez-design-packaging-a-z",
        "title": "Maitrisez le Design de Packaging de A a Z - De la decoupe a l'impression",
        "category": "Packaging design",
        "level": "Niveau intermediaire",
        "image": "/Flyers/packaging.jpg",
        "format_type": "ligne",
        "dashboard_type": "classic",
        "session_label": "",
        "current_price_amount": 50000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": False,
        "is_featured_home": True,
        "home_feature_rank": 30,
        "rating": 3.0,
        "reviews": 65,
        "badges": [],
    },
    {
        "slug": "deviens-un-brand-designer",
        "title": "Demarque-toi des autres graphistes, deviens un Brand Designer",
        "category": "Brand designer",
        "level": "Niveau intermediaire",
        "image": "/Flyers/brand-identity.jpg",
        "format_type": "live",
        "dashboard_type": "guided",
        "session_label": "",
        "current_price_amount": 65000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": False,
        "is_featured_home": True,
        "home_feature_rank": 20,
        "rating": 4.0,
        "reviews": 205,
        "badges": ["premium"],
    },
    {
        "slug": "motion-design-par-la-pratique",
        "title": "Apprendre le motion design par la pratique (+40h de formation)",
        "category": "Motion design",
        "level": "Niveau intermediaire",
        "image": "/Flyers/Motion-design.jpg",
        "format_type": "live",
        "dashboard_type": "guided",
        "session_label": "",
        "current_price_amount": 70000,
        "original_price_amount": 95000,
        "price_currency": "XAF",
        "allow_installments": False,
        "is_featured_home": True,
        "home_feature_rank": 10,
        "rating": 3.0,
        "reviews": 895,
        "badges": ["populaire"],
    },
    {
        "slug": "monetisation-audience-tiktok",
        "title": "De la creation a la monetisation : la methode complete pour vivre de votre audience TikTok",
        "category": "TikTok marketing",
        "level": "Tous niveaux",
        "image": "/Flyers/Flyer_TIKTOK_Academie.jpg",
        "format_type": "ligne",
        "dashboard_type": "classic",
        "session_label": "",
        "current_price_amount": 50000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": False,
        "is_featured_home": True,
        "home_feature_rank": 40,
        "rating": 4.5,
        "reviews": 104,
        "badges": ["premium"],
    },
    {
        "slug": "bootcamp-brand-designer-presentiel",
        "title": "Bootcamp Brand Designer en presentiel - Coaching intensif et evaluation continue",
        "category": "Brand designer",
        "level": "Niveau intermediaire",
        "image": "/Flyers/brand-identity.jpg",
        "format_type": "presentiel",
        "dashboard_type": "guided",
        "session_label": "",
        "current_price_amount": 120000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": True,
        "is_featured_home": True,
        "home_feature_rank": 50,
        "rating": 4.5,
        "reviews": 36,
        "badges": ["premium"],
    },
]


def seed_catalog_test_fixtures(db) -> None:
    db.add_all(FormationRecord(**item) for item in TEST_FORMATION_FIXTURES)
    db.flush()

    today = date.today()
    formations_by_slug = {
        formation.slug: formation for formation in db.scalars(select(FormationRecord)).all()
    }
    session_seed = [
        {
            "formation_slug": "deviens-un-brand-designer",
            "label": "Session live de mai 2026",
            "start_date": today + timedelta(days=12),
            "end_date": today + timedelta(days=32),
            "campus_label": "Classe virtuelle Zoom",
            "seat_capacity": 80,
            "enrolled_count": 22,
            "teacher_name": "Bihee Alex",
            "status": "planned",
        },
        {
            "formation_slug": "motion-design-par-la-pratique",
            "label": "Session live intensive motion design",
            "start_date": today + timedelta(days=6),
            "end_date": today + timedelta(days=26),
            "campus_label": "Classe virtuelle Zoom",
            "seat_capacity": 60,
            "enrolled_count": 15,
            "teacher_name": "Francis Kenne",
            "status": "planned",
        },
        {
            "formation_slug": "bootcamp-brand-designer-presentiel",
            "label": "Cohorte presentiel Douala",
            "start_date": today + timedelta(days=18),
            "end_date": today + timedelta(days=48),
            "campus_label": "Douala - Bonapriso",
            "seat_capacity": 30,
            "enrolled_count": 12,
            "teacher_name": "Bihee Alex",
            "status": "planned",
        },
    ]
    for item in session_seed:
        formation = formations_by_slug[item["formation_slug"]]
        db.add(
            FormationSessionRecord(
                formation_id=formation.id,
                label=item["label"],
                start_date=item["start_date"],
                end_date=item["end_date"],
                campus_label=item["campus_label"],
                seat_capacity=item["seat_capacity"],
                enrolled_count=item["enrolled_count"],
                teacher_name=item["teacher_name"],
                status=item["status"],
            )
        )


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
            seed_catalog_test_fixtures(db)
            db.commit()
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
        enrollments_payload = enrollments_response.json()
        self.assertEqual(len(enrollments_payload), 1)
        self.assertEqual(enrollments_payload[0]["assigned_teacher"]["full_name"], "Bihee Alex")
        self.assertEqual(enrollments_payload[0]["assigned_teacher"]["avatar_initials"], "BA")
        self.assertEqual(
            enrollments_payload[0]["assigned_teacher"]["email"],
            "alex@academiedescreatifs.com",
        )

        dashboard_response = self.client.get("/api/v1/me/dashboard", headers=headers)
        self.assertEqual(dashboard_response.status_code, 200, dashboard_response.text)
        dashboard_payload = dashboard_response.json()
        self.assertEqual(dashboard_payload["guided_enrollments_count"], 1)
        self.assertEqual(dashboard_payload["classic_enrollments_count"], 0)
        self.assertEqual(
            dashboard_payload["guided_enrollments"][0]["assigned_teacher"]["full_name"],
            "Bihee Alex",
        )

        sessions_response = self.client.get("/api/v1/me/sessions", headers=headers)
        self.assertEqual(sessions_response.status_code, 200, sessions_response.text)
        sessions_payload = sessions_response.json()
        self.assertEqual(len(sessions_payload), 1)
        self.assertEqual(sessions_payload[0]["teacher_name"], "Bihee Alex")
        self.assertEqual(
            sessions_payload[0]["assigned_teacher"]["email"],
            "alex@academiedescreatifs.com",
        )

        duplicate_add_response = self.client.post(
            "/api/v1/cart/items",
            headers=headers,
            json={"formation_slug": "deviens-un-brand-designer"},
        )
        self.assertEqual(duplicate_add_response.status_code, 400, duplicate_add_response.text)

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
            ) as mocked_tara_link,
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
        self.assertEqual(
            mocked_tara_link.call_args.kwargs["return_url"],
            "http://localhost:3000/espace?gateway=tara&orders=AC-ORD-2026-0001",
        )

        enrollments_response = self.client.get("/api/v1/me/enrollments", headers=headers)
        self.assertEqual(enrollments_response.status_code, 200, enrollments_response.text)
        self.assertEqual(enrollments_response.json(), [])

        orders_response = self.client.get("/api/v1/me/orders", headers=headers)
        self.assertEqual(orders_response.status_code, 200, orders_response.text)
        self.assertEqual(len(orders_response.json()), 1)
        self.assertEqual(orders_response.json()[0]["status"], "pending")

        cart_before_confirm = self.client.get("/api/v1/cart", headers=headers)
        self.assertEqual(cart_before_confirm.status_code, 200, cart_before_confirm.text)
        self.assertEqual(len(cart_before_confirm.json()["items"]), 1)

        duplicate_add_response = self.client.post(
            "/api/v1/cart/items",
            headers=headers,
            json={"formation_slug": "bootcamp-brand-designer-presentiel"},
        )
        self.assertEqual(duplicate_add_response.status_code, 200, duplicate_add_response.text)

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

        cart_after_confirm = self.client.get("/api/v1/cart", headers=headers)
        self.assertEqual(cart_after_confirm.status_code, 200, cart_after_confirm.text)
        self.assertEqual(cart_after_confirm.json()["items"], [])

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
            ) as mocked_stripe_checkout,
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
        self.assertEqual(
            mocked_stripe_checkout.call_args.kwargs["success_url"],
            "http://localhost:3000/espace?source=stripe&session_id={CHECKOUT_SESSION_ID}",
        )
        order_reference = payload["order_references"][0]

        enrollments_before_confirm = self.client.get("/api/v1/me/enrollments", headers=headers)
        self.assertEqual(enrollments_before_confirm.status_code, 200, enrollments_before_confirm.text)
        self.assertEqual(enrollments_before_confirm.json(), [])

        cart_before_confirm = self.client.get("/api/v1/cart", headers=headers)
        self.assertEqual(cart_before_confirm.status_code, 200, cart_before_confirm.text)
        self.assertEqual(len(cart_before_confirm.json()["items"]), 1)

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

        cart_after_confirm = self.client.get("/api/v1/cart", headers=headers)
        self.assertEqual(cart_after_confirm.status_code, 200, cart_after_confirm.text)
        self.assertEqual(cart_after_confirm.json()["items"], [])

        orders_response = self.client.get("/api/v1/me/orders", headers=headers)
        self.assertEqual(orders_response.status_code, 200, orders_response.text)
        self.assertEqual(orders_response.json()[0]["status"], "paid")

    def test_stripe_checkout_supports_installment_first_payment_only(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Stripe Installment Student",
                "email": "stripe-installment-student@example.com",
                "phone": "+237680001121",
                "password": "Student123!",
            },
        )

        self.assertEqual(register_response.status_code, 201, register_response.text)
        headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}

        add_cart_response = self.client.post(
            "/api/v1/cart/items",
            headers=headers,
            json={"formation_slug": "bootcamp-brand-designer-presentiel"},
        )
        self.assertEqual(add_cart_response.status_code, 200, add_cart_response.text)

        with (
            patch("app.services.commerce.is_stripe_configured", return_value=True),
            patch(
                "app.services.commerce.create_stripe_checkout_session",
                return_value="https://checkout.stripe.com/pay/cs_test_installment",
            ) as mocked_stripe_checkout,
        ):
            checkout_response = self.client.post(
                "/api/v1/cart/checkout",
                headers=headers,
                json={"payment_provider": "stripe", "use_installments": True},
            )

        self.assertEqual(checkout_response.status_code, 200, checkout_response.text)
        payload = checkout_response.json()
        self.assertEqual(payload["payment_provider"], "stripe")
        self.assertEqual(payload["external_redirect_url"], "https://checkout.stripe.com/pay/cs_test_installment")
        self.assertEqual(
            mocked_stripe_checkout.call_args.kwargs["success_url"],
            "http://localhost:3000/espace?source=stripe&session_id={CHECKOUT_SESSION_ID}",
        )
        self.assertTrue(payload["installment_schedules"])
        order_reference = payload["order_references"][0]

        db = SessionLocal()
        try:
            payments = db.scalars(
                select(PaymentRecord)
                .where(PaymentRecord.order_reference == order_reference)
                .order_by(PaymentRecord.installment_number.asc())
            ).all()
            self.assertGreater(len(payments), 1)
            first_payment_id = payments[0].id
            second_payment_id = payments[1].id
            self.assertEqual(payments[0].provider_code, "stripe")
            self.assertEqual(payments[0].provider_checkout_url, "https://checkout.stripe.com/pay/cs_test_installment")
            self.assertEqual(payments[0].status, "pending")
            self.assertEqual(payments[1].status, "pending")
        finally:
            db.close()

        with (
            patch(
                "app.api.routes.stripe_webhook.retrieve_stripe_checkout_session",
                return_value={
                    "payment_status": "paid",
                    "metadata": {
                        "order_references": order_reference,
                        "payment_ids": str(first_payment_id),
                    },
                },
            ),
            patch("app.api.routes.stripe_webhook.send_order_confirmation_for_orders") as mocked_email,
        ):
            confirm_response = self.client.post(
                "/api/v1/stripe/checkout/confirm",
                headers=headers,
                json={"session_id": "cs_test_installment"},
            )

        self.assertEqual(confirm_response.status_code, 200, confirm_response.text)
        self.assertEqual(confirm_response.json()["newly_confirmed_orders"], [order_reference])
        mocked_email.assert_called_once()

        db = SessionLocal()
        try:
            first_payment = db.get(PaymentRecord, first_payment_id)
            second_payment = db.get(PaymentRecord, second_payment_id)
            self.assertEqual(first_payment.status, "confirmed")
            self.assertEqual(second_payment.status, "pending")
        finally:
            db.close()

        orders_response = self.client.get("/api/v1/me/orders", headers=headers)
        self.assertEqual(orders_response.status_code, 200, orders_response.text)
        self.assertEqual(orders_response.json()[0]["status"], "partially_paid")

    def test_stripe_checkout_retry_cancels_unpaid_previous_attempt(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Stripe Retry Student",
                "email": "stripe-retry-student@example.com",
                "phone": "+237680001122",
                "password": "Student123!",
            },
        )
        self.assertEqual(register_response.status_code, 201, register_response.text)
        headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}

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
                return_value="https://checkout.stripe.com/pay/cs_retry_first",
            ),
        ):
            first_checkout = self.client.post(
                "/api/v1/cart/checkout",
                headers=headers,
                json={"payment_provider": "stripe", "payment_mode": "full"},
            )
        self.assertEqual(first_checkout.status_code, 200, first_checkout.text)
        first_reference = first_checkout.json()["order_references"][0]

        cart_after_first = self.client.get("/api/v1/cart", headers=headers)
        self.assertEqual(cart_after_first.status_code, 200, cart_after_first.text)
        self.assertEqual(len(cart_after_first.json()["items"]), 1)

        with (
            patch("app.services.commerce.is_stripe_configured", return_value=True),
            patch(
                "app.services.commerce.create_stripe_checkout_session",
                return_value="https://checkout.stripe.com/pay/cs_retry_second",
            ),
        ):
            second_checkout = self.client.post(
                "/api/v1/cart/checkout",
                headers=headers,
                json={"payment_provider": "stripe", "payment_mode": "full"},
            )
        self.assertEqual(second_checkout.status_code, 200, second_checkout.text)
        second_reference = second_checkout.json()["order_references"][0]
        self.assertNotEqual(first_reference, second_reference)

        db = SessionLocal()
        try:
            first_order = db.scalar(select(OrderRecord).where(OrderRecord.reference == first_reference))
            first_payment = db.scalar(
                select(PaymentRecord).where(PaymentRecord.order_reference == first_reference)
            )
            second_order = db.scalar(select(OrderRecord).where(OrderRecord.reference == second_reference))
            self.assertEqual(first_order.status, "cancelled")
            self.assertEqual(first_payment.status, "cancelled")
            self.assertEqual(second_order.status, "pending")
        finally:
            db.close()

        orders_response = self.client.get("/api/v1/me/orders", headers=headers)
        self.assertEqual(orders_response.status_code, 200, orders_response.text)
        self.assertEqual(len(orders_response.json()), 1)
        self.assertEqual(orders_response.json()[0]["orders"][0]["reference"], second_reference)

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

    def test_tara_webhook_duplicate_does_not_confirm_next_installment(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Tara Duplicate Student",
                "email": "tara-duplicate-student@example.com",
                "phone": "+237680001120",
                "password": "Student123!",
            },
        )
        self.assertEqual(register_response.status_code, 201, register_response.text)
        headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}

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
                return_value=TaraPaymentLinks(dikalo_link="https://dikalo.me/pay/duplicate-test"),
            ),
        ):
            checkout_response = self.client.post(
                "/api/v1/cart/checkout",
                headers=headers,
                json={"use_installments": True},
            )
        self.assertEqual(checkout_response.status_code, 200, checkout_response.text)
        order_reference = checkout_response.json()["order_references"][0]

        db = SessionLocal()
        try:
            first_payment = db.scalar(
                select(PaymentRecord).where(
                    PaymentRecord.order_reference == order_reference,
                    PaymentRecord.installment_number == 1,
                )
            )
            second_payment = db.scalar(
                select(PaymentRecord).where(
                    PaymentRecord.order_reference == order_reference,
                    PaymentRecord.installment_number == 2,
                )
            )
            self.assertIsNotNone(first_payment)
            self.assertIsNotNone(second_payment)
            product_id = first_payment.provider_payment_id
            self.assertIsNotNone(product_id)
        finally:
            db.close()

        payload = {"status": "paid", "productId": product_id}
        first_webhook = self.client.post("/api/v1/tara/webhook", json=payload)
        self.assertEqual(first_webhook.status_code, 200, first_webhook.text)
        second_webhook = self.client.post("/api/v1/tara/webhook", json=payload)
        self.assertEqual(second_webhook.status_code, 200, second_webhook.text)

        db = SessionLocal()
        try:
            first_payment = db.scalar(
                select(PaymentRecord).where(
                    PaymentRecord.order_reference == order_reference,
                    PaymentRecord.installment_number == 1,
                )
            )
            second_payment = db.scalar(
                select(PaymentRecord).where(
                    PaymentRecord.order_reference == order_reference,
                    PaymentRecord.installment_number == 2,
                )
            )
            self.assertEqual(first_payment.status, "confirmed")
            self.assertEqual(second_payment.status, "pending")
        finally:
            db.close()

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

        create_session_response = self.client.post(
            "/api/v1/admin/onsite-sessions",
            headers=admin_headers,
            json={
                "formation_id": enrollment["formation_id"],
                "label": "Session live de juin 2026",
                "start_date": "2026-06-10",
                "end_date": "2026-06-25",
                "campus_label": "Classe virtuelle Zoom",
                "seat_capacity": 60,
                "teacher_name": "Bihee Alex",
                "status": "planned",
            },
        )
        self.assertEqual(create_session_response.status_code, 201, create_session_response.text)
        reassigned_session_id = create_session_response.json()["id"]

        reassign_response = self.client.patch(
            f"/api/v1/admin/enrollments/{enrollment['id']}",
            headers=admin_headers,
            json={"session_id": reassigned_session_id},
        )
        self.assertEqual(reassign_response.status_code, 200, reassign_response.text)
        self.assertEqual(reassign_response.json()["session_id"], reassigned_session_id)
        self.assertEqual(reassign_response.json()["status"], "suspended")

        with SessionLocal() as db:
            db.add(
                AttendanceRecord(
                    session_id=reassigned_session_id,
                    enrollment_id=enrollment["id"],
                    course_day_id=None,
                    status="present",
                )
            )
            db.commit()

        blocked_reassign_response = self.client.patch(
            f"/api/v1/admin/enrollments/{enrollment['id']}",
            headers=admin_headers,
            json={"session_id": session_id},
        )
        self.assertEqual(blocked_reassign_response.status_code, 400, blocked_reassign_response.text)
        self.assertIn("donnees pedagogiques", blocked_reassign_response.text)

    def test_installment_payments_stay_pending_and_can_be_reminded(self) -> None:
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
        pending_payment = next(
            item
            for item in payments_response.json()
            if item["order_reference"] == order_reference and item["installment_number"] == 2
        )
        self.assertEqual(pending_payment["status"], "pending")
        self.assertEqual(pending_payment["order_status"], "partially_paid")
        self.assertTrue(pending_payment["can_send_reminder"])

        reminder_response = self.client.post(
            f"/api/v1/admin/payments/{pending_payment['id']}/reminders",
            headers=admin_headers,
        )
        self.assertEqual(reminder_response.status_code, 200, reminder_response.text)
        self.assertEqual(reminder_response.json()["reminder_count"], 1)
        self.assertIsNotNone(reminder_response.json()["last_reminded_at"])

        notifications_response = self.client.get("/api/v1/me/notifications", headers=student_headers)
        self.assertEqual(notifications_response.status_code, 200, notifications_response.text)
        self.assertTrue(
            any(
                item["title"] == "Paiement à régler"
                for item in notifications_response.json()
            )
        )

        confirm_second = self.client.patch(
            f"/api/v1/admin/payments/{pending_payment['id']}",
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

    def test_admin_can_revoke_teacher_invitation(self) -> None:
        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )

        invalid_phone_response = self.client.post(
            "/api/v1/admin/teachers/invite",
            headers=admin_headers,
            json={
                "full_name": "Invalid Phone Teacher",
                "email": "invalid-phone-teacher@example.com",
                "whatsapp": "6001",
            },
        )
        self.assertEqual(invalid_phone_response.status_code, 422, invalid_phone_response.text)

        invite_response = self.client.post(
            "/api/v1/admin/teachers/invite",
            headers=admin_headers,
            json={
                "full_name": "Invitation Teacher Test",
                "email": "invitation-teacher-test@example.com",
                "whatsapp": "+237600000001",
                "nationality": "Cameroun",
                "subject": "Design graphique",
                "experience_years": 5,
                "portfolio_url": "https://example.com/portfolio",
                "bio": "Profil enseignant de test.",
            },
        )
        self.assertEqual(invite_response.status_code, 201, invite_response.text)
        invitation = invite_response.json()
        self.assertEqual(invitation["status"], "pending")

        info_response = self.client.get(f"/api/v1/invitations/teacher/{invitation['token']}")
        self.assertEqual(info_response.status_code, 200, info_response.text)
        self.assertEqual(info_response.json()["subject"], "Design graphique")
        self.assertEqual(info_response.json()["nationality"], "Cameroun")

        revoke_response = self.client.post(
            f"/api/v1/admin/teachers/invitations/{invitation['id']}/revoke",
            headers=admin_headers,
        )
        self.assertEqual(revoke_response.status_code, 200, revoke_response.text)
        self.assertEqual(revoke_response.json()["status"], "cancelled")

        revoked_info_response = self.client.get(f"/api/v1/invitations/teacher/{invitation['token']}")
        self.assertEqual(revoked_info_response.status_code, 400, revoked_info_response.text)
        self.assertIn("révoquée", revoked_info_response.text)

        accept_response = self.client.post(
            f"/api/v1/invitations/teacher/{invitation['token']}/accept",
            json={"password": "Teacher123!"},
        )
        self.assertEqual(accept_response.status_code, 400, accept_response.text)

    def test_admin_can_update_teacher_detail_and_assignments(self) -> None:
        admin_headers = self.auth_headers(
            "francis@academiedescreatifs.com",
            "Admin123!",
        )

        invite_response = self.client.post(
            "/api/v1/admin/teachers/invite",
            headers=admin_headers,
            json={
                "full_name": "Phase Two Teacher",
                "email": "phase-two-teacher@example.com",
                "whatsapp": "+237600000002",
                "nationality": "Cameroun",
                "subject": "Motion designer",
            },
        )
        self.assertEqual(invite_response.status_code, 201, invite_response.text)
        token = invite_response.json()["token"]

        accept_response = self.client.post(
            f"/api/v1/invitations/teacher/{token}/accept",
            json={"password": "Teacher123!"},
        )
        self.assertEqual(accept_response.status_code, 201, accept_response.text)

        teachers_response = self.client.get("/api/v1/admin/teachers", headers=admin_headers)
        self.assertEqual(teachers_response.status_code, 200, teachers_response.text)
        teacher = next(
            item for item in teachers_response.json()
            if item["email"] == "phase-two-teacher@example.com"
        )

        detail_response = self.client.get(
            f"/api/v1/admin/teachers/{teacher['id']}/detail",
            headers=admin_headers,
        )
        self.assertEqual(detail_response.status_code, 200, detail_response.text)
        self.assertEqual(detail_response.json()["teacher"]["email"], "phase-two-teacher@example.com")

        update_response = self.client.patch(
            f"/api/v1/admin/teachers/{teacher['id']}",
            headers=admin_headers,
            json={
                "full_name": "Phase Two Teacher Updated",
                "email": "phase-two-teacher-updated@example.com",
                "status": "suspended",
                "whatsapp": "+237600000003",
                "nationality": "France",
                "subject": "Brand strategist",
                "experience_years": 7,
                "portfolio_url": "https://example.com/phase-two",
                "bio": "Profil admin mis à jour.",
            },
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        updated_teacher = update_response.json()["teacher"]
        self.assertEqual(updated_teacher["email"], "phase-two-teacher-updated@example.com")
        self.assertEqual(updated_teacher["status"], "suspended")
        self.assertEqual(updated_teacher["subject"], "Brand strategist")
        self.assertEqual(updated_teacher["experience_years"], 7)

        blocked_assign = self.client.post(
            "/api/v1/admin/formations/maitrisez-design-packaging-a-z/teachers",
            headers=admin_headers,
            json={"teacher_id": teacher["id"]},
        )
        self.assertEqual(blocked_assign.status_code, 400, blocked_assign.text)

        reactivate_response = self.client.patch(
            f"/api/v1/admin/teachers/{teacher['id']}",
            headers=admin_headers,
            json={"status": "active"},
        )
        self.assertEqual(reactivate_response.status_code, 200, reactivate_response.text)
        self.assertEqual(reactivate_response.json()["teacher"]["status"], "active")

        assign_response = self.client.post(
            "/api/v1/admin/formations/maitrisez-design-packaging-a-z/teachers",
            headers=admin_headers,
            json={"teacher_id": teacher["id"]},
        )
        self.assertEqual(assign_response.status_code, 201, assign_response.text)

        resource_id = None
        quiz_id = None
        assignment_id = None
        db = SessionLocal()
        try:
            formation = db.scalar(
                select(FormationRecord).where(FormationRecord.slug == "maitrisez-design-packaging-a-z")
            )
            self.assertIsNotNone(formation)
            student = UserRecord(
                full_name="Phase Three Student",
                email="phase-three-student@example.com",
                password_hash=None,
                role="student",
                status="active",
                student_code="AC-ST-260001",
            )
            db.add(student)
            db.flush()
            supervised_session = FormationSessionRecord(
                formation_id=formation.id,  # type: ignore[union-attr]
                label="Session supervision phase 3",
                start_date=date.today() + timedelta(days=1),
                end_date=date.today() + timedelta(days=20),
                campus_label="Classe virtuelle",
                seat_capacity=20,
                enrolled_count=1,
                teacher_name="Phase Two Teacher Updated",
                status="planned",
            )
            db.add(supervised_session)
            db.flush()
            enrollment = EnrollmentRecord(
                user_id=student.id,
                formation_id=formation.id,  # type: ignore[union-attr]
                session_id=supervised_session.id,
                order_reference="PHASE-3-ORDER",
                format_type=formation.format_type,  # type: ignore[union-attr]
                dashboard_type=formation.dashboard_type,  # type: ignore[union-attr]
                status="active",
            )
            db.add(enrollment)
            db.flush()
            course_day = SessionCourseDayRecord(
                session_id=supervised_session.id,
                title="Journée supervision",
                scheduled_at=datetime.now(timezone.utc) + timedelta(days=2),
                duration_minutes=90,
                status="planned",
            )
            db.add(course_day)
            db.flush()
            for index in range(1, 7):
                db.add(
                    SessionCourseDayRecord(
                        session_id=supervised_session.id,
                        title=f"Journée supervision {index}",
                        scheduled_at=datetime.now(timezone.utc) + timedelta(days=2 + index),
                        duration_minutes=90,
                        status="planned" if index % 2 else "done",
                    )
                )
            db.flush()
            course = CourseRecord(session_id=supervised_session.id, title="Cours supervision", description="")
            db.add(course)
            db.flush()
            chapter = ChapterRecord(course_id=course.id, title="Chapitre supervision", order_index=0)
            db.add(chapter)
            db.flush()
            lesson = LessonRecord(chapter_id=chapter.id, title="Leçon supervision", order_index=0)
            db.add(lesson)
            db.flush()
            db.add(LessonProgressRecord(enrollment_id=enrollment.id, lesson_id=lesson.id))
            db.add(AttendanceRecord(
                session_id=supervised_session.id,
                enrollment_id=enrollment.id,
                course_day_id=course_day.id,
                status="present",
            ))
            db.add(GradeRecord(
                session_id=supervised_session.id,
                enrollment_id=enrollment.id,
                course_day_id=course_day.id,
                label="Note supervision",
                score=16,
                max_score=20,
            ))
            resource = ResourceRecord(
                session_id=supervised_session.id,
                course_day_id=course_day.id,
                title="Ressource supervision",
                resource_type="link",
                url="https://example.com/resource",
                published_at=datetime.now(timezone.utc),
            )
            db.add(resource)
            db.flush()
            resource_id = resource.id
            quiz = QuizRecord(
                session_id=supervised_session.id,
                course_day_id=course_day.id,
                title="Quiz supervision",
                scheduled_at=datetime.now(timezone.utc) + timedelta(days=3),
                duration_minutes=15,
                status="draft",
            )
            db.add(quiz)
            db.flush()
            quiz_id = quiz.id
            assignment = AssignmentRecord(
                session_id=supervised_session.id,
                course_day_id=course_day.id,
                title="Devoir supervision",
                instructions="Rendu de test",
                due_date=datetime.now(timezone.utc) + timedelta(days=5),
            )
            db.add(assignment)
            db.flush()
            assignment_id = assignment.id
            db.add(AssignmentSubmissionRecord(
                assignment_id=assignment.id,
                enrollment_id=enrollment.id,
                file_url="https://example.com/submission.pdf",
                submitted_at=datetime.now(timezone.utc),
                is_reviewed=False,
            ))
            db.commit()
        finally:
            db.close()

        detail_after_assign = self.client.get(
            f"/api/v1/admin/teachers/{teacher['id']}/detail",
            headers=admin_headers,
        )
        self.assertEqual(detail_after_assign.status_code, 200, detail_after_assign.text)
        detail_payload = detail_after_assign.json()
        self.assertEqual(len(detail_payload["formations"]), 1)
        self.assertEqual(len(detail_payload["sessions"]), 1)
        self.assertEqual(detail_payload["activity"]["students_count"], 1)
        self.assertEqual(detail_payload["activity"]["lessons_count"], 1)
        self.assertEqual(detail_payload["activity"]["attendance_present_count"], 1)
        self.assertEqual(detail_payload["activity"]["pending_reviews_count"], 1)
        self.assertEqual(detail_payload["activity"]["average_grade_pct"], 80.0)
        self.assertEqual(len(detail_payload["students"]), 1)
        self.assertEqual(detail_payload["students"][0]["full_name"], "Phase Three Student")
        self.assertEqual(detail_payload["students"][0]["progress_pct"], 100.0)
        self.assertEqual(len(detail_payload["pedagogy"]), 1)
        pedagogy = detail_payload["pedagogy"][0]
        self.assertEqual(pedagogy["course_days_count"], 7)
        self.assertEqual(len(pedagogy["course_days"]), 4)
        self.assertEqual(pedagogy["courses_count"], 1)
        self.assertEqual(pedagogy["lessons_count"], 1)
        self.assertEqual(pedagogy["resources_count"], 1)
        self.assertEqual(pedagogy["assignments_count"], 1)
        self.assertEqual(pedagogy["quizzes_count"], 1)
        self.assertEqual(pedagogy["pending_reviews_count"], 1)
        self.assertEqual(
            {alert["code"] for alert in pedagogy["alerts"]},
            {"draft_content", "pending_reviews"},
        )
        self.assertEqual(pedagogy["course_days"][0]["present_count"], 1)
        self.assertEqual(pedagogy["courses"][0]["lessons_count"], 1)
        self.assertEqual(
            {content["content_type"] for content in pedagogy["contents"]},
            {"assignment", "quiz", "resource:link"},
        )
        course_days_page = self.client.get(
            f"/api/v1/admin/teachers/{teacher['id']}/sessions/{pedagogy['session_id']}/course-days?offset=0&limit=3",
            headers=admin_headers,
        )
        self.assertEqual(course_days_page.status_code, 200, course_days_page.text)
        course_days_payload = course_days_page.json()
        self.assertEqual(course_days_payload["total_count"], 7)
        self.assertEqual(len(course_days_payload["items"]), 3)
        self.assertEqual(course_days_payload["items"][0]["present_count"], 1)

        last_course_days_page = self.client.get(
            f"/api/v1/admin/teachers/{teacher['id']}/sessions/{pedagogy['session_id']}/course-days?offset=6&limit=3",
            headers=admin_headers,
        )
        self.assertEqual(last_course_days_page.status_code, 200, last_course_days_page.text)
        self.assertEqual(len(last_course_days_page.json()["items"]), 1)

        self.assertIsNotNone(quiz_id)
        quiz_update_response = self.client.patch(
            f"/api/v1/admin/teachers/{teacher['id']}/quizzes/{quiz_id}/status",
            headers=admin_headers,
            json={"status": "active"},
        )
        self.assertEqual(quiz_update_response.status_code, 200, quiz_update_response.text)
        quiz_update_pedagogy = quiz_update_response.json()["pedagogy"][0]
        self.assertEqual(
            next(
                content["status"]
                for content in quiz_update_pedagogy["contents"]
                if content["content_type"] == "quiz"
            ),
            "active",
        )
        self.assertEqual(
            {alert["code"] for alert in quiz_update_pedagogy["alerts"]},
            {"pending_reviews"},
        )

        self.assertIsNotNone(resource_id)
        resource_update_response = self.client.patch(
            f"/api/v1/admin/teachers/{teacher['id']}/resources/{resource_id}/publication",
            headers=admin_headers,
            json={"published_at": None},
        )
        self.assertEqual(resource_update_response.status_code, 200, resource_update_response.text)
        resource_update_pedagogy = resource_update_response.json()["pedagogy"][0]
        self.assertEqual(
            next(
                content["status"]
                for content in resource_update_pedagogy["contents"]
                if content["content_type"] == "resource:link"
            ),
            "draft",
        )
        self.assertEqual(
            {alert["code"] for alert in resource_update_pedagogy["alerts"]},
            {"draft_content", "pending_reviews"},
        )

        self.assertIsNotNone(assignment_id)
        next_due_date = datetime.now(timezone.utc) + timedelta(days=9)
        assignment_update_response = self.client.patch(
            f"/api/v1/admin/teachers/{teacher['id']}/assignments/{assignment_id}/due-date",
            headers=admin_headers,
            json={"due_date": next_due_date.isoformat()},
        )
        self.assertEqual(assignment_update_response.status_code, 200, assignment_update_response.text)
        assignment_update_pedagogy = assignment_update_response.json()["pedagogy"][0]
        self.assertEqual(
            next(
                content["due_date"][:10]
                for content in assignment_update_pedagogy["contents"]
                if content["content_type"] == "assignment"
            ),
            next_due_date.date().isoformat(),
        )

        remove_response = self.client.delete(
            f"/api/v1/admin/formations/maitrisez-design-packaging-a-z/teachers/{teacher['id']}",
            headers=admin_headers,
        )
        self.assertEqual(remove_response.status_code, 204, remove_response.text)

        detail_after_remove = self.client.get(
            f"/api/v1/admin/teachers/{teacher['id']}/detail",
            headers=admin_headers,
        )
        self.assertEqual(detail_after_remove.status_code, 200, detail_after_remove.text)
        self.assertEqual(detail_after_remove.json()["formations"], [])


if __name__ == "__main__":
    unittest.main()
