from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Holiday, Semester


class SemesterApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin", password="pass", is_staff=True
        )
        self.student = User.objects.create_user(username="stud", password="pass")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def payload(self, **extra):
        data = {
            "name": "Semester 1",
            "academic_year": "2025/2026",
            "start_date": "2025-09-01",
            "end_date": "2025-12-20",
            "teaching_weeks": 15,
            "is_current": True,
            "holidays": [{"name": "Independence Day", "date": "2025-10-09"}],
        }
        data.update(extra)
        return data

    def test_list_requires_admin(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/academics/semesters/")
        self.assertEqual(response.status_code, 403)

    def test_list_empty(self):
        response = self.client.get("/api/academics/semesters/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_create_semester_with_holidays(self):
        response = self.client.post(
            "/api/academics/semesters/", self.payload(), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["name"], "Semester 1")
        self.assertTrue(response.data["is_current"])
        self.assertEqual(len(response.data["holidays"]), 1)
        self.assertEqual(Semester.objects.count(), 1)
        self.assertEqual(Holiday.objects.count(), 1)

    def test_create_requires_required_fields(self):
        response = self.client.post(
            "/api/academics/semesters/", {"name": ""}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        errors = response.data["errors"][0]["errors"]
        self.assertIn("academic_year is required.", errors)

    def test_end_before_start_rejected(self):
        response = self.client.post(
            "/api/academics/semesters/",
            self.payload(start_date="2025-12-20", end_date="2025-09-01"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "end_date must be on or after start_date.",
            response.data["errors"][0]["errors"],
        )

    def test_setting_current_unsets_others(self):
        first = Semester.objects.create(
            name="Semester 1",
            academic_year="2025/2026",
            start_date="2025-09-01",
            end_date="2025-12-20",
            is_current=True,
        )
        response = self.client.post(
            "/api/academics/semesters/",
            self.payload(name="Semester 2", is_current=True),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        first.refresh_from_db()
        self.assertFalse(first.is_current)

    def test_patch_semester_replaces_holidays(self):
        semester = Semester.objects.create(
            name="Semester 1",
            academic_year="2025/2026",
            start_date="2025-09-01",
            end_date="2025-12-20",
        )
        Holiday.objects.create(semester=semester, name="Old", date="2025-09-10")

        response = self.client.patch(
            f"/api/academics/semesters/{semester.id}/",
            {"name": "Updated", "holidays": [{"name": "New", "date": "2025-11-01"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        semester.refresh_from_db()
        self.assertEqual(semester.name, "Updated")
        self.assertEqual(
            list(semester.holidays.values_list("name", flat=True)), ["New"]
        )

    def test_delete_semester(self):
        semester = Semester.objects.create(
            name="Semester 1",
            academic_year="2025/2026",
            start_date="2025-09-01",
            end_date="2025-12-20",
        )
        response = self.client.delete(f"/api/academics/semesters/{semester.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Semester.objects.filter(id=semester.id).exists())

    def test_delete_missing_semester(self):
        response = self.client.delete("/api/academics/semesters/9999/")
        self.assertEqual(response.status_code, 404)
