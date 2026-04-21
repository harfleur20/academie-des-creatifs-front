from __future__ import annotations

import os
from pathlib import Path
import unittest
from unittest.mock import patch


TEST_DB_PATH = Path(__file__).resolve().parent / "test_diagnostic_route.sqlite3"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["JWT_SECRET_KEY"] = "academie-des-creatifs-test-secret"

from fastapi.testclient import TestClient

from app.api.routes import diagnostic as diagnostic_route
from app.main import app
from app.services import ai_client


class DiagnosticRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()
        if TEST_DB_PATH.exists():
            try:
                TEST_DB_PATH.unlink()
            except PermissionError:
                pass

    def test_diagnostic_suggest_returns_ai_recommendations(self) -> None:
        runtime = ai_client.AIRuntimeConfig(
            provider="huggingface",
            api_key="hf-test-key",
            model="openai/gpt-oss-20b:cheapest",
            base_url="https://router.huggingface.co/v1",
        )
        ai_reply = (
            '{"suggestions": ['
            '{"title": "Deviens-un Brand Designer", "reason": "Bon point d entree pour structurer ton oeil et tes livrables."},'
            '{"title": "Apprendre le motion design par la pratique (+40h de formation)", "reason": "Adapte si tu veux apprendre par la production concrete."},'
            '{"title": "Maitrisez le Design de Packaging de A a Z - De la decoupe a l impression", "reason": "Bonne suite pour monter en niveau sur des cas appliques."}'
            "]}"
        )

        with (
            patch.object(diagnostic_route, "resolve_ai_runtime_config", return_value=runtime),
            patch.object(
                diagnostic_route,
                "_format_catalog_context",
                return_value=(
                    "- Deviens-un Brand Designer | categorie: Brand | niveau: Intermediaire | format: live | prix: 65 000 FCFA",
                    [
                        "Deviens-un Brand Designer",
                        "Apprendre le motion design par la pratique (+40h de formation)",
                        "Maitrisez le Design de Packaging de A a Z - De la decoupe a l impression",
                    ],
                ),
            ),
            patch.object(diagnostic_route, "run_ai_chat", return_value=ai_reply),
        ):
            response = self.client.post(
                "/api/v1/diagnostic/suggest",
                json={
                    "first_name": "Melvine",
                    "last_name": "Possi",
                    "domain": "Design Graphique",
                    "self_rating": 3,
                    "level": "debutant",
                    "nationality": "Cameroun",
                    "city": "Douala",
                    "training_type": "online",
                    "whatsapp": "+237680000003",
                    "expectations": "Je veux progresser pour travailler en freelance.",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["suggestions"]), 3)
        self.assertIn("Deviens-un Brand Designer", payload["suggestions"][0])
        self.assertIn("Formations suggerees", payload["whatsapp_message"])

    def test_diagnostic_suggest_falls_back_when_ai_fails(self) -> None:
        runtime = ai_client.AIRuntimeConfig(
            provider="huggingface",
            api_key="hf-test-key",
            model="openai/gpt-oss-20b:cheapest",
            base_url="https://router.huggingface.co/v1",
        )

        with (
            patch.object(diagnostic_route, "resolve_ai_runtime_config", return_value=runtime),
            patch.object(
                diagnostic_route,
                "_format_catalog_context",
                return_value=(
                    "- Design Graphique | categorie: Design | niveau: Debutant | format: en ligne | prix: 50 000 FCFA",
                    [
                        "Design Graphique",
                        "Marketing Digital",
                        "Community Management",
                    ],
                ),
            ),
            patch.object(diagnostic_route, "run_ai_chat", side_effect=RuntimeError("hf down")),
        ):
            response = self.client.post(
                "/api/v1/diagnostic/suggest",
                json={
                    "first_name": "Melvine",
                    "last_name": "Possi",
                    "domain": "Design Graphique",
                    "self_rating": 3,
                    "level": "debutant",
                    "nationality": "Cameroun",
                    "city": "Douala",
                    "training_type": "online",
                    "whatsapp": "+237680000003",
                    "expectations": "Je veux progresser pour travailler en freelance.",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["suggestions"]), 3)
        self.assertIn("Design Graphique", payload["suggestions"][0])


if __name__ == "__main__":
    unittest.main()
