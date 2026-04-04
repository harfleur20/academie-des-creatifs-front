from __future__ import annotations

import os
from pathlib import Path
import unittest


TEST_DB_PATH = Path(__file__).resolve().parent / "test_auth_jwt.sqlite3"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["JWT_SECRET_KEY"] = "academie-des-creatifs-test-secret"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173"

from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.seed import seed_database
from app.db.session import SessionLocal, engine
from app.main import app


class JwtAuthenticationFlowTests(unittest.TestCase):
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

    def test_cart_requires_authentication_without_jwt(self) -> None:
        response = self.client.get("/api/v1/cart")
        self.assertEqual(response.status_code, 401, response.text)


if __name__ == "__main__":
    unittest.main()
