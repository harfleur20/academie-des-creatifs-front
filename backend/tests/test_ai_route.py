from __future__ import annotations

import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch


TEST_DB_PATH = Path(__file__).resolve().parent / "test_ai_route.sqlite3"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["JWT_SECRET_KEY"] = "academie-des-creatifs-test-secret"

from fastapi.testclient import TestClient

from app.api.dependencies import get_current_user_optional
from app.api.routes import ai as ai_route
from app.main import app
from app.services import ai_client


def _settings_stub(**overrides: object) -> SimpleNamespace:
    base = {
        "ai_provider": "openai",
        "ai_api_key": "",
        "ai_model": "",
        "ai_base_url": "",
        "hf_token": "",
        "hf_model": "",
        "hf_base_url": "https://router.huggingface.co/v1",
        "anthropic_api_key": "",
        "openai_api_key": "",
        "openai_base_url": "",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class AiRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        app.dependency_overrides.clear()
        cls.client.close()
        if TEST_DB_PATH.exists():
            try:
                TEST_DB_PATH.unlink()
            except PermissionError:
                pass

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_resolve_openai_runtime_uses_openai_settings(self) -> None:
        with patch.object(
            ai_client,
            "settings",
            _settings_stub(
                ai_provider="openai",
                openai_api_key="openai-test-key",
                openai_base_url="https://api.openai.test/v1",
            ),
        ):
            runtime = ai_client.resolve_ai_runtime_config()

        self.assertIsNotNone(runtime)
        assert runtime is not None
        self.assertEqual(runtime.provider, "openai")
        self.assertEqual(runtime.api_key, "openai-test-key")
        self.assertEqual(runtime.model, "gpt-4o-mini")
        self.assertEqual(runtime.base_url, "https://api.openai.test/v1")

    def test_resolve_huggingface_runtime_uses_hf_aliases(self) -> None:
        with patch.object(
            ai_client,
            "settings",
            _settings_stub(
                ai_provider="huggingface",
                hf_token="hf-test-key",
                hf_model="openai/gpt-oss-20b:cheapest",
            ),
        ):
            runtime = ai_client.resolve_ai_runtime_config()

        self.assertIsNotNone(runtime)
        assert runtime is not None
        self.assertEqual(runtime.provider, "huggingface")
        self.assertEqual(runtime.api_key, "hf-test-key")
        self.assertEqual(runtime.model, "openai/gpt-oss-20b:cheapest")
        self.assertEqual(runtime.base_url, "https://router.huggingface.co/v1")

    def test_ai_chat_returns_mocked_reply_for_authenticated_learning_mode(self) -> None:
        app.dependency_overrides[get_current_user_optional] = lambda: SimpleNamespace(id=1, role="student")
        runtime = ai_client.AIRuntimeConfig(
            provider="huggingface",
            api_key="hf-test-key",
            model="openai/gpt-oss-20b:cheapest",
            base_url="https://router.huggingface.co/v1",
        )

        with (
            patch.object(ai_route, "resolve_ai_runtime_config", return_value=runtime),
            patch.object(ai_route, "run_ai_chat", return_value="Bonjour depuis HF") as chat_mock,
        ):
            response = self.client.post(
                "/api/v1/ai/chat",
                json={
                    "message": "Resume ce cours",
                    "formation_title": "Brand Design",
                    "module_title": "Identite visuelle",
                    "lesson_title": "Palette de couleurs",
                    "assistant_mode": "teacher_assistant",
                    "history": [],
                },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"reply": "Bonjour depuis HF", "actions": []})
        chat_mock.assert_called_once()

    def test_ai_chat_injects_student_context_when_enrollment_is_provided(self) -> None:
        app.dependency_overrides[get_current_user_optional] = lambda: SimpleNamespace(
            id=1,
            role="student",
            full_name="Melvine Possi",
        )
        runtime = ai_client.AIRuntimeConfig(
            provider="huggingface",
            api_key="hf-test-key",
            model="openai/gpt-oss-20b:cheapest",
            base_url="https://router.huggingface.co/v1",
        )

        with (
            patch.object(ai_route, "resolve_ai_runtime_config", return_value=runtime),
            patch.object(ai_route, "_build_student_context", return_value="- Prochain cours : 24/04/2026 a 18:00"),
            patch.object(ai_route, "run_ai_chat", return_value="Votre prochain cours est vendredi.") as chat_mock,
        ):
            response = self.client.post(
                "/api/v1/ai/chat",
                json={
                    "message": "Quand est mon prochain cours ?",
                    "formation_title": "Brand Design",
                    "assistant_mode": "student_learning",
                    "enrollment_id": 42,
                    "history": [],
                },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "reply": "Votre prochain cours est vendredi.",
                "actions": [
                    {
                        "id": "student_paths",
                        "label": "Mes parcours",
                        "href": "/espace/etudiant/parcours",
                        "style": "primary",
                    }
                ],
            },
        )
        prompt = chat_mock.call_args.kwargs["system_prompt"]
        self.assertIn("Contexte de l'etudiant", prompt)
        self.assertIn("24/04/2026", prompt)
        self.assertIn("N'utilise pas de tableaux Markdown", prompt)

    def test_ai_chat_allows_anonymous_ecommerce_support(self) -> None:
        runtime = ai_client.AIRuntimeConfig(
            provider="huggingface",
            api_key="hf-test-key",
            model="openai/gpt-oss-20b:cheapest",
            base_url="https://router.huggingface.co/v1",
        )

        with (
            patch.object(ai_route, "resolve_ai_runtime_config", return_value=runtime),
            patch.object(ai_route, "_build_catalog_context", return_value="- Formation test"),
            patch.object(ai_route, "run_ai_chat", return_value="Bonjour, je peux vous aider.") as chat_mock,
        ):
            response = self.client.post(
                "/api/v1/ai/chat",
                json={
                    "message": "Quelle formation choisir pour debuter ?",
                    "formation_title": "Académie des Créatifs",
                    "assistant_mode": "ecommerce_support",
                    "history": [],
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["reply"], "Bonjour, je peux vous aider.")
        self.assertEqual(
            payload["actions"],
            [
                {
                    "id": "diagnostic",
                    "label": "Passer un diagnostic",
                    "href": "/diagnostic",
                    "style": "primary",
                },
                {
                    "id": "formations",
                    "label": "Voir les formations",
                    "href": "/formations",
                    "style": "secondary",
                },
                {
                    "id": "whatsapp",
                    "label": "Nous écrire sur WhatsApp",
                    "href": "https://wa.me/237680950319?text=Bonjour%20l%27Academie%20des%20Creatifs%2C%20j%27aimerais%20avoir%20des%20informations.",
                    "style": "secondary",
                },
            ],
        )
        chat_mock.assert_called_once()
        prompt = chat_mock.call_args.kwargs["system_prompt"]
        self.assertIn("Logique d'intentions ecommerce", prompt)
        self.assertIn("Intentions detectees : orientation, catalog", prompt)
        self.assertIn("N'utilise pas de tableaux Markdown", prompt)

    def test_ecommerce_pricing_intent_returns_pricing_actions(self) -> None:
        actions = ai_route._build_chat_actions(
            "ecommerce_support",
            "Quel est le prix et comment payer mon inscription ?",
            "Voici les options de paiement disponibles.",
        )

        self.assertEqual(
            [action.model_dump() for action in actions],
            [
                {
                    "id": "formations",
                    "label": "Comparer les formations",
                    "href": "/formations",
                    "style": "primary",
                },
                {
                    "id": "cart",
                    "label": "Voir le panier",
                    "href": "/panier",
                    "style": "secondary",
                },
                {
                    "id": "whatsapp",
                    "label": "Nous écrire sur WhatsApp",
                    "href": "https://wa.me/237680950319?text=Bonjour%20l%27Academie%20des%20Creatifs%2C%20j%27aimerais%20avoir%20des%20informations.",
                    "style": "secondary",
                },
            ],
        )

    def test_student_support_intent_returns_student_actions(self) -> None:
        actions = ai_route._build_chat_actions(
            "student_learning",
            "Mon paiement est bloque, je veux contacter le support",
            "Je vous propose de contacter l'administration.",
        )

        self.assertEqual(
            [action.model_dump() for action in actions],
            [
                {
                    "id": "student_payments",
                    "label": "Mes paiements",
                    "href": "/espace/etudiant/paiements",
                    "style": "primary",
                },
                {
                    "id": "whatsapp",
                    "label": "Nous écrire sur WhatsApp",
                    "href": "https://wa.me/237680950319?text=Bonjour%20l%27Academie%20des%20Creatifs%2C%20j%27ai%20besoin%20d%27aide%20dans%20mon%20espace%20etudiant.",
                    "style": "primary",
                },
                {
                    "id": "student_help",
                    "label": "Aide étudiant",
                    "href": "/espace/etudiant/aide",
                    "style": "secondary",
                },
            ],
        )

    def test_catalog_context_includes_site_and_formation_details(self) -> None:
        formation = SimpleNamespace(
            title="Brand Design",
            slug="brand-design",
            category="Design",
            level="Debutant",
            format_type="ligne",
            current_price_label="80 000 FCFA",
            original_price_label=None,
            allow_installments=False,
            can_purchase=True,
            purchase_message=None,
            session_state="not_applicable",
            card_session_label=None,
        )
        detail = SimpleNamespace(
            intro="Apprenez a construire une identite visuelle claire et professionnelle.",
            audience_text="Creatifs, entrepreneurs et debutants qui veulent structurer leur image.",
            included=["Acces a l'espace de formation", "Supports de cours", "Certificat"],
            objectives=["Construire une identite visuelle", "Presenter un projet coherent"],
            modules=[
                SimpleNamespace(title="Fondamentaux de marque"),
                SimpleNamespace(title="Direction artistique"),
            ],
            faqs=[
                SimpleNamespace(
                    question="Quand l'acces est-il active ?",
                    answer="Apres validation de l'inscription.",
                )
            ],
        )

        with (
            patch.object(ai_route, "list_catalog_items", return_value=[formation]),
            patch.object(ai_route, "get_catalog_detail_item", return_value=detail),
        ):
            context = ai_route._build_catalog_context(SimpleNamespace())

        self.assertIn("/diagnostic", context)
        self.assertIn("+237 680 950 319", context)
        self.assertIn("/formations/brand-design", context)
        self.assertIn("Apprenez a construire une identite visuelle", context)
        self.assertIn("Fondamentaux de marque", context)
        self.assertIn("Quand l'acces est-il active ?", context)

    def test_ai_chat_requires_auth_for_student_learning_mode(self) -> None:
        runtime = ai_client.AIRuntimeConfig(
            provider="huggingface",
            api_key="hf-test-key",
            model="openai/gpt-oss-20b:cheapest",
            base_url="https://router.huggingface.co/v1",
        )

        with patch.object(ai_route, "resolve_ai_runtime_config", return_value=runtime):
            response = self.client.post(
                "/api/v1/ai/chat",
                json={
                    "message": "Explique ce module",
                    "formation_title": "Brand Design",
                    "assistant_mode": "student_learning",
                    "history": [],
                },
            )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Authentification requise.")


if __name__ == "__main__":
    unittest.main()
