from io import BytesIO

from django.contrib.auth.models import Group, User
from django.test import TestCase
from openpyxl import Workbook
from rest_framework.test import APIClient

from .models import Course, Department, Timetable


def build_workbook(headers, rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer


class TimetableApiTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc Computer Science", code="CS01", department=self.department
        )
        self.other_course = Course.objects.create(
            name="BSc Mathematics", code="MA01", department=self.department
        )
        lecturer_group = Group.objects.create(name="Lecturer")
        self.lecturer = User.objects.create_user(username="jdoe", password="pass")
        self.lecturer.groups.add(lecturer_group)
        self.admin = User.objects.create_user(
            username="admin", password="pass", is_staff=True
        )
        self.student = User.objects.create_user(username="stud", password="pass")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def entry_payload(self, **extra):
        payload = {
            "course_code": "CS01",
            "lecturer": "jdoe",
            "day": "MON",
            "start_time": "09:00",
            "end_time": "11:00",
            "room": "LH-101",
        }
        payload.update(extra)
        return payload

    def test_list_requires_admin(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/courses/timetable/")
        self.assertEqual(response.status_code, 403)

    def test_create_entry(self):
        response = self.client.post(
            "/api/courses/timetable/", self.entry_payload(), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["course_code"], "CS01")
        self.assertEqual(response.data["start_time"], "09:00")
        self.assertEqual(Timetable.objects.count(), 1)

    def test_create_entry_rejects_unknown_course(self):
        response = self.client.post(
            "/api/courses/timetable/", self.entry_payload(course_code="NOPE"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("does not match an existing course", response.data["errors"][0]["errors"][0])

    def test_create_entry_rejects_non_lecturer(self):
        response = self.client.post(
            "/api/courses/timetable/", self.entry_payload(lecturer="stud"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("not a lecturer", response.data["errors"][0]["errors"][0])

    def test_create_entry_rejects_end_before_start(self):
        response = self.client.post(
            "/api/courses/timetable/",
            self.entry_payload(end_time="08:00"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_time must be after start_time.", response.data["errors"][0]["errors"])

    def test_patch_entry(self):
        entry = Timetable.objects.create(
            course=self.course,
            lecturer=self.lecturer,
            day="MON",
            start_time="09:00",
            end_time="11:00",
            room="LH-101",
        )
        response = self.client.patch(
            f"/api/courses/timetable/{entry.id}/",
            {"room": "LH-202", "day": "Tuesday"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        entry.refresh_from_db()
        self.assertEqual(entry.room, "LH-202")
        self.assertEqual(entry.day, "TUE")

    def test_delete_entry(self):
        entry = Timetable.objects.create(
            course=self.course,
            lecturer=self.lecturer,
            day="MON",
            start_time="09:00",
            end_time="11:00",
            room="LH-101",
        )
        response = self.client.delete(f"/api/courses/timetable/{entry.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Timetable.objects.count(), 0)

    def upload(self, headers, rows):
        buffer = build_workbook(headers, rows)
        return self.client.post(
            "/api/courses/timetable/upload/",
            {"file": ("timetable.xlsx", buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            format="multipart",
        )

    def test_upload_creates_valid_rows_and_skips_invalid(self):
        headers = ["course_code", "lecturer", "day", "start_time", "end_time", "room"]
        rows = [
            ["CS01", "jdoe", "MON", "09:00", "11:00", "LH-101"],
            ["CS01", "jdoe", "MON", "14:00", "13:00", "LH-101"],
            ["ZZ99", "jdoe", "TUE", "09:00", "11:00", "LH-102"],
            ["MA01", "stud", "WED", "09:00", "11:00", "LH-103"],
        ]
        response = self.upload(headers, rows)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["total_rows"], 4)
        self.assertEqual(response.data["created_count"], 1)
        self.assertEqual(response.data["skipped_count"], 3)
        self.assertEqual(len(response.data["errors"]), 3)
        rows_by_number = {item["row"]: item["errors"] for item in response.data["errors"]}
        self.assertIn("end_time must be after start_time", rows_by_number[3][0])
        self.assertIn("does not match an existing course", rows_by_number[4][0])
        self.assertIn("is not a lecturer", rows_by_number[5][0])
        self.assertEqual(Timetable.objects.count(), 1)

    def test_upload_updates_existing_entry(self):
        Timetable.objects.create(
            course=self.course,
            lecturer=self.lecturer,
            day="MON",
            start_time="09:00",
            end_time="11:00",
            room="OLD-ROOM",
        )
        headers = ["course_code", "lecturer", "day", "start_time", "end_time", "room"]
        response = self.upload(headers, [["CS01", "jdoe", "Monday", "09:00", "11:00", "LH-999"]])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["updated_count"], 1)
        self.assertEqual(response.data["created_count"], 0)
        self.assertEqual(Timetable.objects.count(), 1)
        self.assertEqual(Timetable.objects.first().room, "LH-999")

    def test_upload_flags_duplicate_rows_in_file(self):
        headers = ["course_code", "lecturer", "day", "start_time", "end_time", "room"]
        rows = [
            ["CS01", "jdoe", "MON", "09:00", "11:00", "LH-101"],
            ["CS01", "jdoe", "MON", "09:00", "11:00", "LH-101"],
        ]
        response = self.upload(headers, rows)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created_count"], 1)
        self.assertEqual(response.data["skipped_count"], 1)
        self.assertIn("Duplicate row in this file.", response.data["errors"][0]["errors"])

    def test_upload_requires_expected_columns(self):
        response = self.upload(["day", "room"], [["MON", "LH-101"]])
        self.assertEqual(response.status_code, 400)
        self.assertIn("Missing columns", response.data["errors"][0]["errors"][0])
        self.assertEqual(Timetable.objects.count(), 0)

    def test_upload_requires_file(self):
        response = self.client.post("/api/courses/timetable/upload/", {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Excel file is required", response.data["errors"][0]["errors"][0])


class SubjectApiTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc Computer Science", code="CS01", department=self.department
        )
        self.other_course = Course.objects.create(
            name="BSc Mathematics", code="MA01", department=self.department
        )
        Group.objects.create(name="Lecturer")
        Group.objects.create(name="Student")
        self.admin = User.objects.create_user(
            username="admin", password="pass", is_staff=True
        )
        self.lecturer = User.objects.create_user(username="jdoe", password="pass")
        self.lecturer.groups.add(Group.objects.get(name="Lecturer"))
        self.student = User.objects.create_user(username="stud", password="pass")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_list_subjects_with_course_filter(self):
        from .models import Subject

        Subject.objects.create(name="Algebra", code="MA101", course=self.other_course)
        Subject.objects.create(name="Programming", code="CS101", course=self.course)

        response = self.client.get(f"/api/courses/subjects/?course_id={self.course.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Programming")
        self.assertEqual(response.data[0]["course_name"], "BSc Computer Science")

    def test_create_subject(self):
        response = self.client.post(
            "/api/courses/subjects/",
            {"name": "Algebra", "code": "CS101", "course_id": self.course.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["code"], "CS101")

    def test_create_subject_requires_fields(self):
        response = self.client.post("/api/courses/subjects/", {}, format="json")
        self.assertEqual(response.status_code, 400)
        errors = response.data["errors"][0]["errors"]
        self.assertIn("name is required.", errors)
        self.assertIn("code is required.", errors)
        self.assertIn("course_id is required.", errors)

    def test_create_subject_rejects_unknown_course(self):
        response = self.client.post(
            "/api/courses/subjects/",
            {"name": "Algebra", "code": "CS101", "course_id": 9999},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "does not match an existing course",
            response.data["errors"][0]["errors"][0],
        )

    def test_create_subject_rejects_duplicate_code_in_course(self):
        from .models import Subject

        Subject.objects.create(name="Algebra", code="CS101", course=self.course)
        response = self.client.post(
            "/api/courses/subjects/",
            {"name": "Calculus", "code": "cs101", "course_id": self.course.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", response.data["errors"][0]["errors"][0])

    def test_same_code_allowed_in_different_course(self):
        from .models import Subject

        Subject.objects.create(name="Algebra", code="CS101", course=self.course)
        response = self.client.post(
            "/api/courses/subjects/",
            {"name": "Algebra", "code": "CS101", "course_id": self.other_course.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_lecturer_cannot_create_subject(self):
        self.client.force_authenticate(user=self.lecturer)
        response = self.client.post(
            "/api/courses/subjects/",
            {"name": "Algebra", "code": "CS101", "course_id": self.course.id},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_lecturer_can_list_subjects(self):
        self.client.force_authenticate(user=self.lecturer)
        response = self.client.get("/api/courses/subjects/")
        self.assertEqual(response.status_code, 200)

    def test_patch_subject(self):
        from .models import Subject

        subject = Subject.objects.create(name="Algebra", code="CS101", course=self.course)
        response = self.client.patch(
            f"/api/courses/subjects/{subject.id}/",
            {"name": "Linear Algebra", "code": "CS102"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        subject.refresh_from_db()
        self.assertEqual(subject.name, "Linear Algebra")
        self.assertEqual(subject.code, "CS102")

    def test_delete_subject(self):
        from .models import Subject

        subject = Subject.objects.create(name="Algebra", code="CS101", course=self.course)
        response = self.client.delete(f"/api/courses/subjects/{subject.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Subject.objects.filter(id=subject.id).exists())

    def test_student_cannot_modify_subject(self):
        from .models import Subject

        subject = Subject.objects.create(name="Algebra", code="CS101", course=self.course)
        self.client.force_authenticate(user=self.student)
        response = self.client.patch(
            f"/api/courses/subjects/{subject.id}/", {"name": "Hacked"}, format="json"
        )
        self.assertEqual(response.status_code, 403)


class EnrollmentApiTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc Computer Science", code="CS01", department=self.department
        )
        self.other_course = Course.objects.create(
            name="BSc Mathematics", code="MA01", department=self.department
        )
        Group.objects.create(name="Student")
        self.admin = User.objects.create_user(
            username="admin", password="pass", is_staff=True
        )
        self.student = User.objects.create_user(
            username="stud1", password="pass", first_name="Stella", last_name="Student"
        )
        self.student.groups.add(Group.objects.get(name="Student"))
        self.other_student = User.objects.create_user(username="stud2", password="pass")
        self.other_student.groups.add(Group.objects.get(name="Student"))
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_list_enrollments_empty(self):
        response = self.client.get("/api/courses/enrollments/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_create_and_list_enrollment(self):
        response = self.client.post(
            "/api/courses/enrollments/",
            {"student_id": self.student.id, "course_id": self.course.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["student_username"], "stud1")
        self.assertEqual(response.data["course_code"], "CS01")

        listing = self.client.get("/api/courses/enrollments/")
        self.assertEqual(len(listing.data), 1)

        filtered = self.client.get(
            f"/api/courses/enrollments/?course_id={self.other_course.id}"
        )
        self.assertEqual(filtered.data, [])

    def test_duplicate_enrollment_rejected(self):
        payload = {"student_id": self.student.id, "course_id": self.course.id}
        self.client.post("/api/courses/enrollments/", payload, format="json")
        response = self.client.post("/api/courses/enrollments/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already enrolled", response.data["detail"])

    def test_enroll_unknown_student(self):
        response = self.client.post(
            "/api/courses/enrollments/",
            {"student_id": 9999, "course_id": self.course.id},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_enroll_non_student_user(self):
        lecturer_group = Group.objects.create(name="Lecturer")
        lecturer = User.objects.create_user(username="jdoe", password="pass")
        lecturer.groups.add(lecturer_group)
        response = self.client.post(
            "/api/courses/enrollments/",
            {"student_id": lecturer.id, "course_id": self.course.id},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_delete_enrollment(self):
        from .models import StudentCourse

        enrollment = StudentCourse.objects.create(
            student=self.student, course=self.course
        )
        response = self.client.delete(f"/api/courses/enrollments/{enrollment.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(StudentCourse.objects.filter(id=enrollment.id).exists())

    def test_delete_missing_enrollment(self):
        response = self.client.delete("/api/courses/enrollments/9999/")
        self.assertEqual(response.status_code, 404)

    def test_requires_admin(self):
        self.client.force_authenticate(user=self.student)
        self.assertEqual(
            self.client.get("/api/courses/enrollments/").status_code, 403
        )
        self.assertEqual(
            self.client.post(
                "/api/courses/enrollments/",
                {"student_id": self.student.id, "course_id": self.course.id},
                format="json",
            ).status_code,
            403,
        )
