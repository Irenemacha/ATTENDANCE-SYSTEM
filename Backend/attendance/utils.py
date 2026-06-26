from datetime import timedelta
from django.utils import timezone

def check_session_expiry(session):
    now = timezone.now()

    expected_end = session.start_time + timedelta(minutes=session.duration_minutes)

    if now >= expected_end and session.is_active:
        session.is_active = False
        session.end_time = expected_end
        session.save()

def calculate_attendance(attendance, session):

    if not attendance.check_out_time:
        return

    total = session.duration_minutes * 60

    spent = (attendance.check_out_time - attendance.check_in_time).seconds

    percent = (spent / total) * 100

    attendance.percentage = percent

    if percent >= 70:
        attendance.status = "Present"
    elif percent >= 50:
        attendance.status = "Late"
    else:
        attendance.status = "Absent"

    attendance.save()