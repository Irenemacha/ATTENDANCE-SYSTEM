# =========================
# IMPORTS (TOP OF FILE)
# =========================
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Count

from accounts.permissions import IsHOD
from attendance.models import AttendanceSession, Attendance


# =========================
# HOD DASHBOARD (FULL SYSTEM)
# =========================
@api_view(["GET"])
@permission_classes([IsHOD])
def hod_dashboard(request):

    # =========================
    # STEP 1: DEPARTMENT FILTER (BASE FOUNDATION)
    # =========================
    hod = request.user

    sessions = AttendanceSession.objects.filter(
        course__department=hod.department
    )

    attendance = Attendance.objects.filter(
        session__course__department=hod.department
    )

    # =========================
    # OVERVIEW STATS
    # =========================
    total_sessions = sessions.count()
    total_attendance = attendance.count()

    active_sessions = sessions.filter(is_active=True).count()

    # =========================
    # STEP 2: LOW ATTENDANCE ALERT
    # =========================
    low_attendance_sessions = []

    for session in sessions:

        total = Attendance.objects.filter(session=session).count()

        if total < 5:  # threshold (unaweza kubadilisha)
            low_attendance_sessions.append({
                "session_id": session.id,
                "course": session.course.name,
                "subject": session.subject.name,
                "total_attendance": total
            })

    # =========================
    # STEP 3: LECTURER DELAY ANALYSIS
    # =========================
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
                "issue": "No attendance recorded early (possible lecturer delay or session not started on time)"
            })

    # =========================
    # STEP 4: COURSE BREAKDOWN (OPTIONAL INSIGHT LAYER)
    # =========================
    courses_data = []

    courses = sessions.values(
        "course__id",
        "course__name"
    ).distinct()

    for course in courses:

        course_sessions = sessions.filter(course__id=course["course__id"])
        course_attendance = attendance.filter(session__course__id=course["course__id"])

        total = course_attendance.count()
        present = course_attendance.filter(status="PRESENT").count()

        percentage = (present / total * 100) if total > 0 else 0

        courses_data.append({
            "course": course["course__name"],
            "total_sessions": course_sessions.count(),
            "total_attendance": total,
            "present": present,
            "percentage": percentage
        })

    # =========================
    # FINAL RESPONSE (HOD VIEW)
    # =========================
    return Response({
        "department": hod.department.name,

        # overview
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "total_attendance": total_attendance,

        # intelligence layer
        "low_attendance_alerts": low_attendance_sessions,
        "delay_analysis": delay_analysis,

        # analytics
        "courses": courses_data
    })