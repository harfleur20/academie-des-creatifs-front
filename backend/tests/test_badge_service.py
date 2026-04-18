from __future__ import annotations

import unittest

from app.services.badge import BadgeStats, compute_badge_from_stats


class BadgeProgressionRulesTests(unittest.TestCase):
    def test_aventurier_is_default_until_course_program_exists(self) -> None:
        progress = compute_badge_from_stats(BadgeStats(
            total_lessons=0,
            completed_lessons=0,
            lesson_progress_pct=0,
        ))

        self.assertEqual(progress.level, "aventurier")
        self.assertEqual(progress.ring_pct, 0)
        self.assertIn("programme de cours", progress.hint or "")

    def test_debutant_requires_first_activity_when_available(self) -> None:
        blocked = compute_badge_from_stats(BadgeStats(
            total_lessons=20,
            completed_lessons=5,
            lesson_progress_pct=25,
            available_assignments=2,
            submitted_assignments=0,
            available_quizzes=1,
            attempted_quizzes=1,
            past_course_days=1,
            attended_course_days=1,
        ))
        self.assertEqual(blocked.level, "aventurier")
        self.assertIn("rendez au moins 1 devoir", blocked.hint or "")

        unlocked = compute_badge_from_stats(BadgeStats(
            total_lessons=20,
            completed_lessons=5,
            lesson_progress_pct=25,
            available_assignments=2,
            submitted_assignments=1,
            available_quizzes=1,
            attempted_quizzes=1,
            past_course_days=1,
            attended_course_days=1,
        ))
        self.assertEqual(unlocked.level, "debutant")

    def test_intermediaire_and_semi_pro_use_activity_percentages(self) -> None:
        intermediaire = compute_badge_from_stats(BadgeStats(
            total_lessons=20,
            completed_lessons=10,
            lesson_progress_pct=50,
            available_assignments=4,
            submitted_assignments=2,
            available_quizzes=5,
            attempted_quizzes=5,
            passed_quizzes=3,
            past_course_days=6,
            attended_course_days=3,
            grade_average_pct=55,
        ))
        self.assertEqual(intermediaire.level, "intermediaire")

        semi_pro = compute_badge_from_stats(BadgeStats(
            total_lessons=20,
            completed_lessons=15,
            lesson_progress_pct=75,
            available_assignments=4,
            submitted_assignments=3,
            available_quizzes=5,
            attempted_quizzes=5,
            passed_quizzes=4,
            past_course_days=8,
            attended_course_days=6,
            grade_average_pct=65,
        ))
        self.assertEqual(semi_pro.level, "semi_pro")

    def test_professionnel_requires_final_project_and_final_average(self) -> None:
        blocked = compute_badge_from_stats(BadgeStats(
            total_lessons=20,
            completed_lessons=20,
            lesson_progress_pct=100,
            available_assignments=4,
            submitted_assignments=4,
            available_quizzes=5,
            attempted_quizzes=5,
            passed_quizzes=5,
            past_course_days=10,
            attended_course_days=8,
            grade_average_pct=82,
            final_project_validated=False,
        ))
        self.assertEqual(blocked.level, "semi_pro")
        self.assertIn("projet final", blocked.hint or "")

        unlocked = compute_badge_from_stats(BadgeStats(
            total_lessons=20,
            completed_lessons=20,
            lesson_progress_pct=100,
            available_assignments=4,
            submitted_assignments=4,
            available_quizzes=5,
            attempted_quizzes=5,
            passed_quizzes=5,
            past_course_days=10,
            attended_course_days=8,
            grade_average_pct=82,
            final_project_validated=True,
        ))
        self.assertEqual(unlocked.level, "professionnel")
        self.assertEqual(unlocked.ring_pct, 100)


if __name__ == "__main__":
    unittest.main()
