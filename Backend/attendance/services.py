from datetime import datetime

from django.utils import timezone

from .models import Attendance, AttendanceSession, SessionChangeLog

# A student is considered to have attended a session once they have checked in
# and are not marked absent, regardless of whether the time-weighted percentage
# later marks them as late or partial. This keeps the percentage identical on
# mobile and web.
ATTENDED_STATUSES = ("PRESENT", "LATE", "PARTIAL_ATTENDANCE")

PASS_MARK = 75


def is_attended(attendance):
    return (
        attendance.check_in_time is not None
        and attendance.status != "ABSENT"
    )


def student_attendance_stats(student, sessions):
    """Return (attended_sessions, total_sessions, percentage) for a student.

    ``sessions`` is any iterable/queryset of AttendanceSession. The percentage
    is session-count based: attended sessions divided by sessions held. This is
    the single source of truth shared by the mobile dashboard and every web
    report so the numbers always match.
    """
    session_list = list(sessions)
    total_sessions = len(session_list)
    if not total_sessions:
        return 0, 0, 0.0

    session_ids = [session.id for session in session_list]
    attended_sessions = (
        Attendance.objects.filter(
            student=student,
            session_id__in=session_ids,
            check_in_time__isnull=False,
        )
        .exclude(status="ABSENT")
        .values("session_id")
        .distinct()
        .count()
    )

    percentage = round(attended_sessions / total_sessions * 100, 2)
    return attended_sessions, total_sessions, percentage


def attendance_status_label(percentage):
    return "Fine" if percentage >= PASS_MARK else "Critical"


def session_attendance_summary(session):
    """Return (total_students, attended_students, percentage) for a session.

    The denominator is every student enrolled in the session's course, not just
    the students who already have an attendance record. This means an active
    session no longer reports 100% just because only present students have rows.
    """
    from students.models import Student

    total_students = Student.objects.filter(course_id=session.course_id).count()
    attended_students = (
        Attendance.objects.filter(
            session=session,
            check_in_time__isnull=False,
        )
        .exclude(status="ABSENT")
        .values("student_id")
        .distinct()
        .count()
    )
    percentage = (
        round(attended_students / total_students * 100, 2)
        if total_students
        else 0.0
    )
    return total_students, attended_students, percentage


def combine_day(reference, clock):
    """Combine a date (or datetime) with a time object into an aware datetime."""
    if not clock:
        return None
    day = reference.date() if isinstance(reference, datetime) else reference
    return timezone.make_aware(datetime.combine(day, clock))


def timetable_window(session):
    """Return the (start, end) datetimes of the timetable linked to a session."""
    timetable = session.timetable
    if not timetable:
        return None, None
    reference = timezone.localtime(session.start_time)
    return combine_day(reference, timetable.start_time), combine_day(reference, timetable.end_time)


def record_session_change(
    session,
    change_type,
    *,
    changed_by=None,
    reason="",
    original_start=None,
    original_end=None,
    actual_start=None,
    actual_end=None,
):
    return SessionChangeLog.objects.create(
        session=session,
        change_type=change_type,
        original_start_time=original_start,
        original_end_time=original_end,
        actual_start_time=actual_start,
        actual_end_time=actual_end,
        reason=reason or "",
        changed_by=changed_by,
    )


def record_timetable_change(
    entry,
    old_start,
    old_end,
    new_start,
    new_end,
    *,
    changed_by=None,
    reason="Timetable updated by administrator",
):
    """Log a timetable change against every session that references the entry."""
    logs = []
    sessions = AttendanceSession.objects.filter(timetable=entry)
    for session in sessions:
        reference = timezone.localtime(session.start_time)
        logs.append(
            record_session_change(
                session,
                "TIMETABLE_CHANGE",
                changed_by=changed_by,
                reason=reason,
                original_start=combine_day(reference, old_start),
                original_end=combine_day(reference, old_end),
                actual_start=combine_day(reference, new_start),
                actual_end=combine_day(reference, new_end),
            )
        )
    return logs
