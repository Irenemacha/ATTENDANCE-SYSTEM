# =========================
# IMPORTS (TOP OF FILE)
# =========================
import os

from django.core.files.storage import default_storage
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsHOD
from accounts.serializers import user_department
from courses.models import Course, Subject
from students.models import Student

from attendance.models import AttendanceSession, Attendance
from attendance.services import (
    attendance_status_label,
    session_attendance_summary,
    student_attendance_stats,
)


# =========================
# HELPERS
# =========================
def _department(user):
    return user_department(user)


def _apply_session_filters(sessions, params):
    course_id = params.get("course_id")
    if course_id and str(course_id).isdigit():
        sessions = sessions.filter(course_id=int(course_id))

    subject_id = params.get("subject_id")
    if subject_id and str(subject_id).isdigit():
        sessions = sessions.filter(subject_id=int(subject_id))

    lecturer_id = params.get("lecturer_id")
    if lecturer_id and str(lecturer_id).isdigit():
        sessions = sessions.filter(lecturer_id=int(lecturer_id))

    start_date = parse_date(params.get("start_date") or "")
    if start_date:
        sessions = sessions.filter(date__gte=start_date)

    end_date = parse_date(params.get("end_date") or "")
    if end_date:
        sessions = sessions.filter(date__lte=end_date)

    return sessions


def _serialize_student(student, sessions):
    attended, total, percentage = student_attendance_stats(student, sessions)
    department = None
    if student.course_id and student.course.department_id:
        department = student.course.department.name
    return {
        "student_id": student.id,
        "name": student.full_name,
        "registration": student.reg_number,
        "course": student.course.name if student.course_id else None,
        "course_code": student.course.code if student.course_id else None,
        "department": department,
        "year_of_study": student.year_of_study,
        "attended": attended,
        "total_sessions": total,
        "percentage": percentage,
        "status": attendance_status_label(percentage),
    }


# =========================
# HOD DASHBOARD (DEPARTMENT)
# =========================
@api_view(["GET"])
@permission_classes([IsHOD])
def hod_dashboard(request):
    department = _department(request.user)

    if department is None:
        return Response({
            "department": None,
            "total_sessions": 0,
            "active_sessions": 0,
            "total_attendance": 0,
            "total_students": 0,
            "low_attendance_alerts": [],
            "delay_analysis": [],
            "courses": [],
        })

    sessions = AttendanceSession.objects.filter(
        course__department=department
    ).select_related("course", "subject", "lecturer")

    department_students = Student.objects.filter(course__department=department)
    total_students = department_students.count()

    low_attendance_alerts = []
    for session in sessions:
        total, attended, percentage = session_attendance_summary(session)
        if total and percentage < 50:
            low_attendance_alerts.append({
                "session_id": session.id,
                "course": session.course.name,
                "subject": session.subject.name,
                "lecturer": session.lecturer.get_full_name() or session.lecturer.username,
                "total_students": total,
                "attended": attended,
                "percentage": percentage,
            })

    delay_analysis = []
    for session in sessions:
        first_attendance = Attendance.objects.filter(
            session=session
        ).order_by("check_in_time").first()
        if not first_attendance:
            delay_analysis.append({
                "session_id": session.id,
                "course": session.course.name,
                "subject": session.subject.name,
                "lecturer": session.lecturer.get_full_name() or session.lecturer.username,
                "issue": "No attendance recorded (possible lecturer delay or session not started on time)",
            })

    courses_data = []
    courses = Course.objects.filter(department=department).distinct()
    for course in courses:
        course_sessions = sessions.filter(course=course)
        course_students = department_students.filter(course=course)
        total, attended, percentage = 0, 0, 0.0
        if course_students.exists():
            percentages = []
            for student in course_students:
                _, _, student_percentage = student_attendance_stats(
                    student, course_sessions
                )
                percentages.append(student_percentage)
            percentage = round(sum(percentages) / len(percentages), 2) if percentages else 0.0
            total = course_students.count()
            attended = len([p for p in percentages if p >= 75])

        courses_data.append({
            "course": course.name,
            "course_code": course.code,
            "total_sessions": course_sessions.count(),
            "total_students": total,
            "attended": attended,
            "percentage": percentage,
        })

    return Response({
        "department": department.name,
        "total_sessions": sessions.count(),
        "active_sessions": sessions.filter(is_active=True).count(),
        "total_attendance": Attendance.objects.filter(
            session__course__department=department,
            check_in_time__isnull=False,
        ).exclude(status="ABSENT").count(),
        "total_students": total_students,
        "low_attendance_alerts": low_attendance_alerts,
        "delay_analysis": delay_analysis,
        "courses": courses_data,
    })


# =========================
# HOD STUDENT ATTENDANCE (ALL STUDENTS IN DEPARTMENT)
# =========================
@api_view(["GET"])
@permission_classes([IsHOD])
def hod_students(request):
    department = _department(request.user)
    if department is None:
        return Response({
            "department": None,
            "students": [],
            "summary": {"total_students": 0, "average_percentage": 0},
        })

    students = Student.objects.filter(
        course__department=department
    ).select_related("course", "course__department").order_by("full_name")

    course_id = request.query_params.get("course_id")
    if course_id and str(course_id).isdigit():
        students = students.filter(course_id=int(course_id))

    subject_id = request.query_params.get("subject_id")
    subject_id = int(subject_id) if subject_id and str(subject_id).isdigit() else None

    session_cache = {}

    def sessions_for(student):
        key = (student.course_id, subject_id)
        if key not in session_cache:
            sessions = _apply_session_filters(
                AttendanceSession.objects.filter(course_id=student.course_id),
                request.query_params,
            )
            session_cache[key] = list(sessions)
        return session_cache[key]

    rows = [_serialize_student(student, sessions_for(student)) for student in students]

    average = (
        round(sum(row["percentage"] for row in rows) / len(rows), 2) if rows else 0.0
    )

    return Response({
        "department": department.name,
        "students": rows,
        "summary": {
            "total_students": len(rows),
            "average_percentage": average,
            "critical_students": len([r for r in rows if r["status"] == "Critical"]),
        },
    })


@api_view(["GET"])
@permission_classes([IsHOD])
def hod_courses(request):
    """Courses and subjects in the HOD's department (for report filters)."""
    department = _department(request.user)
    if department is None:
        return Response([])

    courses = Course.objects.filter(department=department).order_by("name")
    return Response([
        {
            "id": course.id,
            "name": course.name,
            "code": course.code,
            "subjects": [
                {"id": subject.id, "name": subject.name, "code": subject.code}
                for subject in Subject.objects.filter(course=course).order_by("name")
            ],
        }
        for course in courses
    ])


# =========================
# HOD SESSION REPORT (DEPARTMENT)
# =========================
@api_view(["GET"])
@permission_classes([IsHOD])
def hod_report(request):
    department = _department(request.user)
    if department is None:
        return Response({"department": None, "sessions": []})

    sessions = AttendanceSession.objects.filter(
        course__department=department
    ).select_related("course", "subject", "lecturer").order_by("-start_time")
    sessions = _apply_session_filters(sessions, request.query_params)

    result = []
    total_records = 0
    total_attended = 0

    for session in sessions:
        total, attended, percentage = session_attendance_summary(session)
        records = Attendance.objects.filter(session=session)

        total_records += total
        total_attended += attended

        result.append({
            "session_id": session.id,
            "course": session.course.name,
            "course_code": session.course.code,
            "subject": session.subject.name,
            "lecturer": session.lecturer.get_full_name() or session.lecturer.username,
            "date": session.date,
            "active": session.is_active,
            "is_override": session.is_override,
            "total": total,
            "present": records.filter(status="PRESENT").count(),
            "late": records.filter(status="LATE").count(),
            "absent": records.filter(status="ABSENT").count(),
            "attended": attended,
            "percentage": percentage,
        })

    return Response({
        "department": department.name,
        "sessions": result,
        "overview": {
            "total_sessions": len(result),
            "total_records": total_records,
            "total_attended": total_attended,
            "overall_percentage": (
                round(total_attended / total_records * 100, 2)
                if total_records else 0
            ),
        },
    })

# =========================
# HOD LEDGER UPLOAD
# =========================
LEDGER_EXTENSIONS = {".xlsx", ".xls", ".csv"}


@api_view(["POST"])
@permission_classes([IsHOD])
def hod_upload_ledger(request):
    upload = request.FILES.get("file")
    if not upload:
        return Response({"detail": "file is required."}, status=400)

    extension = os.path.splitext(upload.name)[1].lower()
    if extension not in LEDGER_EXTENSIONS:
        return Response(
            {"detail": "Only .xlsx, .xls or .csv files are supported."},
            status=400,
        )

    folder = f"ledgers/{timezone.localdate():%Y/%m/%d}"
    saved_path = default_storage.save(f"{folder}/{upload.name}", upload)

    return Response(
        {
            "message": "Ledger uploaded successfully.",
            "file": saved_path,
        },
        status=201,
    )
