from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from courses.models import Course, Department
from students.models import Student


class UserManagementStudentProfileTests(TestCase):
    def setUp(self):
        Group.objects.create(name="Student")
        self.department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc Computer Science",
            code="CS01",
            department=self.department,
        )
        self.admin = User.objects.create_user(
            username="admin", password="pass", is_staff=True
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def payload(self, **extra):
        data = {
            "username": "stud1",
            "password": "secret123",
            "email": "stud1@example.com",
            "first_name": "Stella",
            "last_name": "Student",
            "groups": ["Student"],
            "reg_number": "S001",
            "course_id": self.course.id,
            "year_of_study": 2,
        }
        data.update(extra)
        return data

    def test_create_student_creates_profile(self):
        response = self.client.post(
            "/api/user-management/users/", self.payload(), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)

        profile = Student.objects.get(user__username="stud1")
        self.assertEqual(profile.reg_number, "S001")
        self.assertEqual(profile.full_name, "Stella Student")
        self.assertEqual(profile.course_id, self.course.id)
        self.assertEqual(profile.year_of_study, 2)

        self.assertEqual(response.data["profile"]["reg_number"], "S001")
        self.assertEqual(response.data["profile"]["course_id"], self.course.id)

    def test_create_student_requires_profile_fields(self):
        data = self.payload()
        data.pop("reg_number")
        response = self.client.post(
            "/api/user-management/users/", data, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("reg_number", response.data)
        self.assertFalse(Student.objects.exists())

    def test_create_user_requires_password(self):
        response = self.client.post(
            "/api/user-management/users/", self.payload(password=""), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)

    def test_update_student_profile(self):
        self.client.post(
            "/api/user-management/users/", self.payload(), format="json"
        )
        profile = Student.objects.get(user__username="stud1")
        other_course = Course.objects.create(
            name="BSc Mathematics",
            code="MA01",
            department=self.department,
        )

        response = self.client.patch(
            f"/api/user-management/users/{profile.user_id}/",
            {"course_id": other_course.id, "year_of_study": 3},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

        profile.refresh_from_db()
        self.assertEqual(profile.course_id, other_course.id)
        self.assertEqual(profile.year_of_study, 3)
