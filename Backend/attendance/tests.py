import shutil
import tempfile
from datetime import datetime, time, timedelta

from django.contrib.auth.models import Group, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import StaffProfile
from courses.models import (
    Classroom,
    Course,
    Department,
    LecturerCourse,
    StudentCourse,
    Subject,
    Timetable,
)
from students.models import Student

from .models import Attendance, AttendanceSession


class OverrideTimeTests(TestCase):
    def setUp(self):
        department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc", code="CS01", department=department
        )
        self.subject = Subject.objects.create(
            name="Algebra", code="CS101", course=self.course
        )
        self.classroom = Classroom.objects.create(
            room_name="A1", room_number="A1", latitude=0.0, longitude=0.0
        )
        self.lecturer = User.objects.create_user(
            username="lect1", password="pass", is_staff=True
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.lecturer)

    def payload(self, **extra):
        data = {
            "course_id": self.course.id,
            "subject_id": self.subject.id,
            "classroom_id": self.classroom.id,
            "is_override": True,
            "override_reason": "Postponed class",
            "start_time": "09:00",
            "end_time": "11:00",
        }
        data.update(extra)
        return data

    def test_override_with_times(self):
        response = self.client.post(
            "/api/attendance/start-session/",
            self.payload(start_time="09:00", end_time="11:30"),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

        session = AttendanceSession.objects.get(id=response.data["session_id"])
        self.assertEqual(
            timezone.localtime(session.start_time).strftime("%H:%M"), "09:00"
        )
        self.assertEqual(
            timezone.localtime(session.end_time).strftime("%H:%M"), "11:30"
        )
        self.assertEqual(session.override_duration_minutes, 150)

    def test_end_before_start_rejected(self):
        response = self.client.post(
            "/api/attendance/start-session/",
            self.payload(start_time="11:00", end_time="09:00"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("End time must be after start time", response.data["error"])

    def test_end_equal_to_start_rejected(self):
        response = self.client.post(
            "/api/attendance/start-session/",
            self.payload(start_time="09:00", end_time="09:00"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_bad_format_rejected(self):
        response = self.client.post(
            "/api/attendance/start-session/",
            self.payload(start_time="9am", end_time="11:00"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("HH:MM", response.data["error"])

    def test_override_defaults_times_when_missing(self):
        before = timezone.localtime()
        response = self.client.post(
            "/api/attendance/start-session/",
            self.payload(start_time="", end_time=""),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

        session = AttendanceSession.objects.get(id=response.data["session_id"])
        self.assertGreaterEqual(timezone.localtime(session.start_time), before)
        self.assertEqual(session.override_duration_minutes, 120)
        self.assertEqual(
            session.end_time - session.start_time, timedelta(minutes=120)
        )

    def test_override_defaults_end_time_when_missing(self):
        response = self.client.post(
            "/api/attendance/start-session/",
            self.payload(start_time="09:00", end_time=""),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

        session = AttendanceSession.objects.get(id=response.data["session_id"])
        self.assertEqual(
            timezone.localtime(session.start_time).strftime("%H:%M"), "09:00"
        )
        self.assertEqual(session.override_duration_minutes, 120)
        self.assertEqual(
            session.end_time - session.start_time, timedelta(minutes=120)
        )

    def test_override_defaults_start_time_when_missing(self):
        end_clock = (timezone.localtime() + timedelta(minutes=30)).strftime("%H:%M")
        if end_clock <= timezone.localtime().strftime("%H:%M"):
            self.skipTest("Test window would cross midnight")
        response = self.client.post(
            "/api/attendance/start-session/",
            self.payload(start_time="", end_time=end_clock),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

        session = AttendanceSession.objects.get(id=response.data["session_id"])
        self.assertEqual(
            timezone.localtime(session.end_time).strftime("%H:%M"), end_clock
        )

    def test_override_without_reason_allowed(self):
        data = self.payload()
        data.pop("override_reason")
        response = self.client.post(
            "/api/attendance/start-session/", data, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_start_uses_dashboard_geofence_values(self):
        response = self.client.post(
            "/api/attendance/start-session/",
            self.payload(latitude=-6.8, longitude=39.2, radius=75),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

        session = AttendanceSession.objects.get(id=response.data["session_id"])
        self.assertAlmostEqual(session.latitude, -6.8)
        self.assertAlmostEqual(session.longitude, 39.2)
        self.assertEqual(session.radius_meters, 75)

    def test_auto_close_uses_override_end_time(self):
        from .views import auto_close_expired_sessions

        response = self.client.post(
            "/api/attendance/start-session/",
            self.payload(start_time="00:01", end_time="00:02"),
            format="json",
        )
        session = AttendanceSession.objects.get(id=response.data["session_id"])

        auto_close_expired_sessions()
        session.refresh_from_db()
        self.assertFalse(session.is_active)
        self.assertTrue(session.auto_closed)
        self.assertEqual(
            timezone.localtime(session.end_time).strftime("%H:%M"), "00:02"
        )


class AdminReportTests(TestCase):
    def setUp(self):
        from courses.models import Department

        department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc", code="CS01", department=department
        )
        self.subject = Subject.objects.create(
            name="Algebra", code="CS101", course=self.course
        )
        self.admin = User.objects.create_user(
            username="admin", password="pass", is_staff=True
        )
        self.lecturer = User.objects.create_user(
            username="lect1", password="pass", is_staff=True
        )
        self.student_user = User.objects.create_user(
            username="stud1", password="pass"
        )
        self.student = Student.objects.create(
            user=self.student_user,
            reg_number="S001",
            full_name="Stella Student",
            email="stella@example.com",
            course=self.course,
            year_of_study=2,
        )
        self.session = AttendanceSession.objects.create(
            lecturer=self.lecturer,
            course=self.course,
            subject=self.subject,
            latitude=0.0,
            longitude=0.0,
        )
        Attendance.objects.create(
            student=self.student,
            session=self.session,
            status="PRESENT",
            check_in_time=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_admin_report_returns_sessions_and_overview(self):
        response = self.client.get("/api/attendance/admin-report/")
        self.assertEqual(response.status_code, 200, response.data)

        overview = response.data["overview"]
        self.assertEqual(overview["total_sessions"], 1)
        self.assertEqual(overview["total_records"], 1)
        self.assertEqual(overview["total_present"], 1)
        self.assertEqual(overview["overall_percentage"], 100.0)

        session = response.data["sessions"][0]
        self.assertEqual(session["course"], "BSc")
        self.assertEqual(session["subject"], "Algebra")
        self.assertEqual(session["lecturer"], "lect1")
        self.assertEqual(session["total"], 1)
        self.assertEqual(session["present"], 1)
        self.assertEqual(session["percentage"], 100.0)

    def test_admin_report_filters_by_course(self):
        other_department = Department.objects.create(name="MA")
        other_course = Course.objects.create(
            name="Maths", code="MA01", department=other_department
        )
        other_subject = Subject.objects.create(
            name="Calculus", code="MA101", course=other_course
        )
        AttendanceSession.objects.create(
            lecturer=self.lecturer,
            course=other_course,
            subject=other_subject,
            latitude=0.0,
            longitude=0.0,
        )
        response = self.client.get(
            f"/api/attendance/admin-report/?course_id={self.course.id}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["overview"]["total_sessions"], 1)
        self.assertEqual(response.data["sessions"][0]["course"], "BSc")

    def test_admin_report_requires_admin(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get("/api/attendance/admin-report/")
        self.assertEqual(response.status_code, 403)


class SessionChangeHistoryTests(TestCase):
    def setUp(self):
        from courses.models import Timetable

        department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc", code="CS01", department=department
        )
        self.subject = Subject.objects.create(
            name="Algebra", code="CS101", course=self.course
        )
        self.classroom = Classroom.objects.create(
            room_name="A1", room_number="A1", latitude=0.0, longitude=0.0
        )
        self.lecturer = User.objects.create_user(
            username="lect1", password="pass", is_staff=True
        )
        self.admin = User.objects.create_user(
            username="admin", password="pass", is_staff=True
        )
        self.student_user = User.objects.create_user(
            username="stud1", password="pass"
        )
        days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        now = timezone.localtime()
        today = days[now.weekday()]
        self.timetable = Timetable.objects.create(
            course=self.course,
            lecturer=self.lecturer,
            day=today,
            start_time=(now - timedelta(minutes=5)).time(),
            end_time=(now + timedelta(minutes=5)).time(),
            room="LH-101",
        )
        self.client = APIClient()

    def start(self, **extra):
        self.client.force_authenticate(user=self.lecturer)
        data = {
            "course_id": self.course.id,
            "subject_id": self.subject.id,
            "classroom_id": self.classroom.id,
        }
        data.update(extra)
        return self.client.post(
            "/api/attendance/start-session/", data, format="json"
        )

    def test_start_session_records_change(self):
        response = self.start(
            is_override=True,
            override_reason="Replacement class",
            start_time="09:00",
            end_time="11:00",
        )
        self.assertEqual(response.status_code, 201, response.data)
        session = AttendanceSession.objects.get(id=response.data["session_id"])

        log = session.change_logs.get()
        self.assertEqual(log.change_type, "OVERRIDE")
        self.assertEqual(log.changed_by, self.lecturer)
        self.assertEqual(log.reason, "Replacement class")
        self.assertEqual(log.actual_start_time, session.start_time)

    def test_end_session_records_change(self):
        response = self.start()
        self.assertEqual(response.status_code, 201, response.data)
        session_id = response.data["session_id"]

        self.client.force_authenticate(user=self.lecturer)
        end = self.client.post(
            "/api/attendance/end-session/", {"session_id": session_id}, format="json"
        )
        self.assertEqual(end.status_code, 200, end.data)

        session = AttendanceSession.objects.get(id=session_id)
        self.assertTrue(
            session.change_logs.filter(change_type="END").exists()
        )

    def test_timetable_edit_records_change_for_session(self):
        from attendance.models import SessionChangeLog
        from courses.models import Timetable

        entry = Timetable.objects.create(
            course=self.course,
            lecturer=self.lecturer,
            day="MON",
            start_time="09:00",
            end_time="11:00",
            room="LH-101",
        )
        session = AttendanceSession.objects.create(
            lecturer=self.lecturer,
            course=self.course,
            subject=self.subject,
            classroom=self.classroom,
            timetable=entry,
            latitude=0.0,
            longitude=0.0,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/courses/timetable/{entry.id}/", {"start_time": "10:00"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)

        log = SessionChangeLog.objects.get(
            session=session, change_type="TIMETABLE_CHANGE"
        )
        self.assertEqual(log.changed_by, self.admin)
        self.assertEqual(
            timezone.localtime(log.original_start_time).strftime("%H:%M"), "09:00"
        )
        self.assertEqual(
            timezone.localtime(log.actual_start_time).strftime("%H:%M"), "10:00"
        )

    def test_history_endpoint_requires_admin(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get("/api/attendance/session-history/")
        self.assertEqual(response.status_code, 403)

    def test_history_endpoint_lists_changes(self):
        self.start(
            is_override=True,
            override_reason="Replacement",
            start_time="09:00",
            end_time="11:00",
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/attendance/session-history/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["change_type"], "OVERRIDE")
        self.assertEqual(response.data[0]["changed_by"], "lect1")

    def test_history_endpoint_filters_by_session(self):
        first = self.start().data["session_id"]

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            f"/api/attendance/session-history/{first}/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(all(item["session_id"] == first for item in response.data))

    def test_history_detail_missing_session(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/attendance/session-history/9999/")
        self.assertEqual(response.status_code, 404)


class ActiveSessionPercentageTests(TestCase):
    def setUp(self):
        department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc", code="CS01", department=department
        )
        self.subject = Subject.objects.create(
            name="Algebra", code="CS101", course=self.course
        )
        self.lecturer = User.objects.create_user(
            username="lect1", password="pass", is_staff=True
        )
        self.session = AttendanceSession.objects.create(
            lecturer=self.lecturer,
            course=self.course,
            subject=self.subject,
            latitude=0.0,
            longitude=0.0,
        )

        student_group = Group.objects.create(name="Student")
        self.student_user = User.objects.create_user(
            username="stud1", password="pass"
        )
        self.student_user.groups.add(student_group)
        self.student = Student.objects.create(
            user=self.student_user,
            reg_number="S001",
            full_name="Stella Student",
            email="stella@example.com",
            course=self.course,
            year_of_study=2,
        )
        other_user = User.objects.create_user(username="stud2", password="pass")
        other_student = Student.objects.create(
            user=other_user,
            reg_number="S002",
            full_name="Other Student",
            email="other@example.com",
            course=self.course,
            year_of_study=2,
        )
        Attendance.objects.create(
            student=other_student,
            session=self.session,
            status="PRESENT",
            check_in_time=timezone.now(),
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.student_user)

    def test_active_session_returns_same_percentage_as_web_reports(self):
        response = self.client.get("/api/attendance/active-session/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["session_percentage"], 50.0)
        self.assertEqual(response.data["attended_students"], 1)
        self.assertEqual(response.data["total_students"], 2)

    def test_active_session_requires_student(self):
        outsider = User.objects.create_user(username="outsider", password="pass")
        self.client.force_authenticate(user=outsider)
        response = self.client.get("/api/attendance/active-session/")
        self.assertEqual(response.status_code, 403)


class LecturerStudentAttendanceTests(TestCase):
    def setUp(self):
        department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc", code="CS01", department=department
        )
        self.other_course = Course.objects.create(
            name="BIT", code="BIT01", department=department
        )
        lecturer_group = Group.objects.create(name="Lecturer")
        self.lecturer = User.objects.create_user(
            username="lect1", password="pass"
        )
        self.lecturer.groups.add(lecturer_group)
        LecturerCourse.objects.create(lecturer=self.lecturer, course=self.course)
        self.client = APIClient()
        self.client.force_authenticate(user=self.lecturer)

    def make_student(self, username, reg_number, full_name, course):
        user = User.objects.create_user(username=username, password="pass")
        return Student.objects.create(
            user=user,
            reg_number=reg_number,
            full_name=full_name,
            email=f"{username}@example.com",
            course=course,
            year_of_study=1,
        )

    def test_includes_students_enrolled_in_course(self):
        self.make_student("stud1", "S001", "Stella Student", self.course)
        enrolled = self.make_student(
            "stud2", "S002", "Enrolled Student", self.other_course
        )
        StudentCourse.objects.create(student=enrolled.user, course=self.course)
        self.make_student("stud3", "S003", "Outsider Student", self.other_course)

        response = self.client.get(
            f"/api/attendance/lecturer/students/?course_id={self.course.id}"
        )

        self.assertEqual(response.status_code, 200, response.data)
        registrations = {row["registration"] for row in response.data["students"]}
        self.assertEqual(registrations, {"S001", "S002"})
        self.assertEqual(response.data["summary"]["total_students"], 2)


class AdminStudentAttendanceTests(TestCase):
    def setUp(self):
        department = Department.objects.create(name="CS")
        self.course = Course.objects.create(
            name="BSc", code="CS01", department=department
        )
        self.other_course = Course.objects.create(
            name="BIT", code="BIT01", department=department
        )
        self.subject = Subject.objects.create(
            name="Algebra", code="CS101", course=self.course
        )
        other_subject = Subject.objects.create(
            name="Programming", code="BIT101", course=self.other_course
        )
        self.lecturer = User.objects.create_user(
            username="lect1", password="pass", is_staff=True
        )
        self.admin = User.objects.create_user(
            username="admin", password="pass", is_staff=True
        )

        def make_student(username, reg_number, full_name, course):
            user = User.objects.create_user(username=username, password="pass")
            return Student.objects.create(
                user=user,
                reg_number=reg_number,
                full_name=full_name,
                email=f"{username}@example.com",
                course=course,
                year_of_study=1,
            )

        self.student_one = make_student(
            "stud1", "S001", "Stella Student", self.course
        )
        self.student_two = make_student(
            "stud2", "S002", "Brian Student", self.course
        )
        self.student_three = make_student(
            "stud3", "S003", "Carol Student", self.other_course
        )

        self.session_one = AttendanceSession.objects.create(
            lecturer=self.lecturer,
            course=self.course,
            subject=self.subject,
            date=timezone.localdate() - timedelta(days=1),
            latitude=0.0,
            longitude=0.0,
        )
        self.session_two = AttendanceSession.objects.create(
            lecturer=self.lecturer,
            course=self.course,
            subject=self.subject,
            date=timezone.localdate(),
            latitude=0.0,
            longitude=0.0,
        )
        self.other_session = AttendanceSession.objects.create(
            lecturer=self.lecturer,
            course=self.other_course,
            subject=other_subject,
            date=timezone.localdate() - timedelta(days=1),
            latitude=0.0,
            longitude=0.0,
        )

        Attendance.objects.create(
            student=self.student_one,
            session=self.session_one,
            status="PRESENT",
            check_in_time=timezone.now(),
        )
        Attendance.objects.create(
            student=self.student_one,
            session=self.session_two,
            status="ABSENT",
        )
        Attendance.objects.create(
            student=self.student_two,
            session=self.session_one,
            status="PRESENT",
            check_in_time=timezone.now(),
        )
        Attendance.objects.create(
            student=self.student_two,
            session=self.session_two,
            status="LATE",
            check_in_time=timezone.now(),
        )
        Attendance.objects.create(
            student=self.student_three,
            session=self.other_session,
            status="PRESENT",
            check_in_time=timezone.now(),
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_returns_percentage_for_every_student(self):
        response = self.client.get("/api/attendance/admin/students/")
        self.assertEqual(response.status_code, 200, response.data)

        rows = {row["registration"]: row for row in response.data["students"]}
        self.assertEqual(rows["S001"]["attended"], 1)
        self.assertEqual(rows["S001"]["total_sessions"], 2)
        self.assertEqual(rows["S001"]["percentage"], 50.0)
        self.assertEqual(rows["S001"]["status"], "Critical")
        self.assertEqual(rows["S002"]["percentage"], 100.0)
        self.assertEqual(rows["S002"]["status"], "Fine")
        self.assertEqual(rows["S003"]["course"], "BIT")
        self.assertEqual(rows["S003"]["course_id"], self.other_course.id)
        self.assertEqual(rows["S003"]["percentage"], 100.0)

        summary = response.data["summary"]
        self.assertEqual(summary["total_students"], 3)
        self.assertEqual(summary["total_sessions"], 3)
        self.assertEqual(summary["average_percentage"], 83.33)
        self.assertEqual(summary["critical_students"], 1)

    def test_filters_by_course(self):
        response = self.client.get(
            f"/api/attendance/admin/students/?course_id={self.course.id}"
        )
        self.assertEqual(response.status_code, 200, response.data)

        registrations = {
            row["registration"] for row in response.data["students"]
        }
        self.assertEqual(registrations, {"S001", "S002"})
        self.assertEqual(response.data["summary"]["total_sessions"], 2)
        self.assertEqual(response.data["summary"]["average_percentage"], 75.0)

    def test_filters_by_date(self):
        response = self.client.get(
            "/api/attendance/admin/students/"
            f"?start_date={timezone.localdate().isoformat()}"
        )
        self.assertEqual(response.status_code, 200, response.data)

        rows = {row["registration"]: row for row in response.data["students"]}
        self.assertEqual(rows["S001"]["attended"], 0)
        self.assertEqual(rows["S001"]["total_sessions"], 1)
        self.assertEqual(rows["S002"]["attended"], 1)
        self.assertEqual(rows["S003"]["total_sessions"], 0)
        self.assertEqual(response.data["summary"]["total_sessions"], 1)

    def test_rejects_subject_from_another_course(self):
        response = self.client.get(
            "/api/attendance/admin/students/"
            f"?course_id={self.course.id}&subject_id=9999"
        )
        self.assertEqual(response.status_code, 404)

    def test_requires_admin(self):
        self.client.force_authenticate(user=self.student_one.user)
        response = self.client.get("/api/attendance/admin/students/")
        self.assertEqual(response.status_code, 403)


class HodDelayAnalysisTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(name="CS")
        other_department = Department.objects.create(name="Math")
        self.course = Course.objects.create(
            name="BSc CS", code="CS01", department=self.department
        )
        other_course = Course.objects.create(
            name="BSc Math", code="MA01", department=other_department
        )
        self.subject = Subject.objects.create(
            name="Algebra", code="CS101", course=self.course
        )
        other_subject = Subject.objects.create(
            name="Calculus", code="MA101", course=other_course
        )
        lecturer_group = Group.objects.create(name="Lecturer")
        self.lecturer = User.objects.create_user(
            username="lect1",
            password="pass",
            first_name="Lena",
            last_name="Lecturer",
        )
        self.lecturer.groups.add(lecturer_group)
        other_lecturer = User.objects.create_user(username="lect2", password="pass")
        other_lecturer.groups.add(lecturer_group)

        hod_group = Group.objects.create(name="HOD")
        self.hod = User.objects.create_user(username="hod1", password="pass")
        self.hod.groups.add(hod_group)
        StaffProfile.objects.create(user=self.hod, department=self.department)

        today = timezone.localdate()
        day_code = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][
            today.weekday()
        ]
        self.timetable = Timetable.objects.create(
            course=self.course,
            lecturer=self.lecturer,
            day=day_code,
            start_time=time(9, 0),
            end_time=time(11, 0),
            room="LH-1",
        )

        def aware(clock):
            return timezone.make_aware(datetime.combine(today, clock))

        self.late_session = AttendanceSession.objects.create(
            lecturer=self.lecturer,
            course=self.course,
            subject=self.subject,
            date=today,
            start_time=aware(time(9, 20)),
            timetable=self.timetable,
            latitude=0.0,
            longitude=0.0,
        )
        self.on_time_session = AttendanceSession.objects.create(
            lecturer=self.lecturer,
            course=self.course,
            subject=self.subject,
            date=today,
            start_time=aware(time(9, 2)),
            timetable=self.timetable,
            latitude=0.0,
            longitude=0.0,
        )
        self.other_department_session = AttendanceSession.objects.create(
            lecturer=other_lecturer,
            course=other_course,
            subject=other_subject,
            date=today,
            start_time=aware(time(9, 30)),
            latitude=0.0,
            longitude=0.0,
        )

        student_user = User.objects.create_user(username="stud1", password="pass")
        self.student = Student.objects.create(
            user=student_user,
            reg_number="S001",
            full_name="Stella Student",
            email="stella@example.com",
            course=self.course,
            year_of_study=1,
        )
        Attendance.objects.create(
            student=self.student,
            session=self.late_session,
            status="PRESENT",
            check_in_time=timezone.now(),
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.hod)

    def test_reports_late_starts_and_average_delay(self):
        response = self.client.get("/api/attendance/hod/dashboard/")
        self.assertEqual(response.status_code, 200, response.data)

        late_rows = [
            row for row in response.data["delay_analysis"] if row.get("late_starts")
        ]
        self.assertEqual(len(late_rows), 1)
        self.assertEqual(late_rows[0]["lecturer"], "Lena Lecturer")
        self.assertEqual(late_rows[0]["late_starts"], 1)
        self.assertAlmostEqual(late_rows[0]["average_delay_minutes"], 20.0)
        self.assertEqual(late_rows[0]["courses"], ["BSc CS · Algebra"])

    def test_reports_sessions_without_attendance(self):
        response = self.client.get("/api/attendance/hod/dashboard/")
        self.assertEqual(response.status_code, 200, response.data)

        issues = {
            row["session_id"]: row
            for row in response.data["delay_analysis"]
            if "session_id" in row
        }
        self.assertIn(self.on_time_session.id, issues)
        self.assertIn("No attendance recorded", issues[self.on_time_session.id]["issue"])
        self.assertNotIn(self.late_session.id, issues)

    def test_excludes_other_departments(self):
        response = self.client.get("/api/attendance/hod/dashboard/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["total_sessions"], 2)
        self.assertEqual(
            {
                row["session_id"]
                for row in response.data["delay_analysis"]
                if "session_id" in row
            },
            {self.on_time_session.id},
        )


class HodLedgerUploadTests(TestCase):
    def setUp(self):
        hod_group = Group.objects.create(name="HOD")
        self.hod = User.objects.create_user(username="hod1", password="pass")
        self.hod.groups.add(hod_group)
        self.client = APIClient()
        self.client.force_authenticate(user=self.hod)

        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)

    def test_upload_requires_file(self):
        response = self.client.post("/api/attendance/hod/upload-ledger/", {})
        self.assertEqual(response.status_code, 400)

    def test_upload_rejects_unsupported_extension(self):
        upload = SimpleUploadedFile("ledger.txt", b"not a ledger")
        response = self.client.post(
            "/api/attendance/hod/upload-ledger/", {"file": upload}
        )
        self.assertEqual(response.status_code, 400)

    def test_upload_saves_ledger(self):
        upload = SimpleUploadedFile("ledger.csv", b"reg_number,status\nS001,PRESENT\n")
        response = self.client.post(
            "/api/attendance/hod/upload-ledger/", {"file": upload}
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIn("ledgers/", response.data["file"])
        self.assertTrue(response.data["file"].endswith("ledger.csv"))
