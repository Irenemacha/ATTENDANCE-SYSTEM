from datetime import datetime, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from geopy.distance import geodesic
from students.models import Notification
from students.models import Student

from accounts.models import UserSessionState
from accounts.permissions import IsLecturer, IsStudent, IsAdminOrStaff
from accounts.services import advance_user_state

from courses.models import (
    BLEBeacon,
    Course,
    Subject,
    Timetable,
    LecturerCourse,
    LecturerSubject,
    Classroom
)

from students.models import Student

from .models import AttendanceSession, Attendance, MovementLog, SessionChangeLog
from .services import (
    attendance_status_label,
    record_session_change,
    session_attendance_summary,
    student_attendance_stats,
    timetable_window,
)
from .utils import calculate_distance


def is_within_geofence(distance, radius):
    return distance <= radius

# ======================================================
# ACTIVE CLASS CHECK
# ======================================================

def get_active_class():

    now = timezone.localtime()

    days = {
        0: "MON",
        1: "TUE",
        2: "WED",
        3: "THU",
        4: "FRI",
        5: "SAT",
        6: "SUN",
    }

    return Timetable.objects.filter(
        day=days[now.weekday()],
        start_time__lte=now.time(),
        end_time__gte=now.time()
    ).first()



# ======================================================
# START ATTENDANCE SESSION
# LECTURER
# ======================================================

@api_view(["POST"])
@permission_classes([IsLecturer])
def start_session(request):
    
    existing_session = AttendanceSession.objects.filter(
    lecturer=request.user,
    is_active=True
    ).first()


    if existing_session:

        return Response(
        {
            "error":
            "You already have an active session. End it before starting another one."
        },
        status=400
    )

    user = request.user

    course_id = request.data.get("course_id")
    subject_id = request.data.get("subject_id")
    classroom_id = request.data.get("classroom_id")
    is_override = bool(request.data.get("is_override", False))

    override_reason = (
        request.data.get("override_reason") or ""
    ).strip()

    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")
    radius = request.data.get("radius")

    # ==============================
# CHECK TIMETABLE
# ==============================

    days = {
    0: "MON",
    1: "TUE",
    2: "WED",
    3: "THU",
    4: "FRI",
    5: "SAT",
    6: "SUN",
    }


    now = timezone.localtime()


    timetable = Timetable.objects.filter(
    course_id=course_id,
    lecturer=user,
    day=days[now.weekday()],
    start_time__lte=now.time(),
    end_time__gte=now.time()
    ).first()


    if not timetable and not is_override:

        return Response(
        {
            "error": "No timetable found for this time slot. Use override if this is a postponed/replacement class."
        },
        status=400
    )


    override_start = None
    override_end = None

    if is_override:

        start_raw = request.data.get("start_time")
        end_raw = request.data.get("end_time")

        if bool(start_raw) != bool(end_raw):

            return Response(
                {
                    "error": "Provide both start time and end time for an override"
                },
                status=400
            )

        if start_raw and end_raw:

            try:
                start_clock = datetime.strptime(str(start_raw), "%H:%M").time()
                end_clock = datetime.strptime(str(end_raw), "%H:%M").time()

            except ValueError:

                return Response(
                    {
                        "error": "Invalid time format. Use HH:MM (24-hour)."
                    },
                    status=400
                )

            if end_clock <= start_clock:

                return Response(
                    {
                        "error": "End time must be after start time"
                    },
                    status=400
                )

            session_date = timezone.localdate()

            override_start = timezone.make_aware(
                datetime.combine(session_date, start_clock)
            )

            override_end = timezone.make_aware(
                datetime.combine(session_date, end_clock)
            )

    # WiFi is optional and only enforced when the dashboard/client supplies it.
    allowed_wifi = request.data.get("allowed_wifi_bssid") or None
    


    if not course_id or not subject_id:
        return Response(
            {
                "error": "course_id and subject_id are required"
            },
            status=400
        )
        
    if not classroom_id:
        return Response(
        {
            "error":"classroom_id is required"
        },
        status=400
    )
        
    classroom = Classroom.objects.filter(
    id=classroom_id
    ).first()


    if not classroom:
        return Response(
        {
            "error":"Invalid classroom"
        },
        status=400
    )


    # Lecturer course permission

    if not user.is_staff and not user.is_superuser:

        allowed_course = LecturerCourse.objects.filter(
            lecturer=user,
            course_id=course_id
        ).exists()

        if not allowed_course:
            return Response(
                {
                    "error": "You are not assigned to this course"
                },
                status=403
            )


    # Validate subject

    subject = Subject.objects.filter(
        id=subject_id,
        course_id=course_id
    ).first()


    if not subject:
        return Response(
            {
                "error": "Invalid subject"
            },
            status=400
        )


    # Lecturer subject permission. When an admin has configured
    # subject-level assignments for this course they are enforced; otherwise
    # the course assignment is enough, matching what the dashboard displays.

    if not user.is_staff and not user.is_superuser:

        has_subject_assignments = LecturerSubject.objects.filter(
            lecturer=user,
            subject__course_id=course_id
        ).exists()

        if has_subject_assignments and not LecturerSubject.objects.filter(
            lecturer=user,
            subject=subject
        ).exists():
            return Response(
                {
                    "error": "You are not allowed to teach this subject"
                },
                status=403
            )

    # Geofence values come from the dashboard when supplied, otherwise the
    # classroom defaults are used.

    try:
        session_latitude = (
            float(latitude) if latitude not in (None, "") else classroom.latitude
        )
        session_longitude = (
            float(longitude) if longitude not in (None, "") else classroom.longitude
        )
        session_radius = (
            int(float(radius)) if radius not in (None, "") else classroom.radius_meters
        )
    except (TypeError, ValueError):
        return Response(
            {
                "error": "latitude, longitude and radius must be numbers"
            },
            status=400
        )

    if session_latitude is None or session_longitude is None:
        return Response(
            {
                "error": "This classroom has no GPS coordinates. Set them before starting a session."
            },
            status=400
        )

    if not -90 <= session_latitude <= 90 or not -180 <= session_longitude <= 180:
        return Response(
            {
                "error": "Invalid GPS coordinates"
            },
            status=400
        )

    if session_radius <= 0:
        return Response(
            {
                "error": "Geofence radius must be greater than zero"
            },
            status=400
        )

    session = AttendanceSession.objects.create(

    lecturer=user,

    course_id=course_id,

    subject=subject,

    classroom=classroom,

    timetable=timetable,

    latitude=session_latitude,

    longitude=session_longitude,

    radius_meters=session_radius,

    allowed_wifi_bssid=allowed_wifi,

    start_time=timezone.now(),

    is_active=True,

    is_override=is_override,

    override_reason=override_reason,
    override_duration_minutes=120
)

    if override_start and override_end:

        session.start_time = override_start

        session.end_time = override_end

        session.override_duration_minutes = int(
            (override_end - override_start).total_seconds() // 60
        )

        session.save(
            update_fields=[
                "start_time",
                "end_time",
                "override_duration_minutes",
            ]
        )

    original_start, original_end = timetable_window(session)

    record_session_change(
        session,
        "OVERRIDE" if is_override else "START",
        changed_by=user,
        reason=override_reason or "",
        original_start=original_start,
        original_end=original_end,
        actual_start=session.start_time,
        actual_end=session.end_time,
    )

    students = Student.objects.filter(course_id=course_id)

    for student in students:
        Notification.objects.create(
        student=student,
        title="Attendance Session Started",
        message=f"{session.subject.name} session is now active."
    )


    return Response(
        {
            "message": "Session started successfully",
            "session_id": session.id
        },
        status=201
    )



# ======================================================
# STUDENT CHECK IN
# ======================================================

@api_view(["POST"])
@permission_classes([IsStudent])
def check_in(request):

    user = request.user


    session_id = request.data.get("session_id")

    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")
    wifi_bssid = request.data.get("wifi_bssid")
    beacon_id = request.data.get("beacon_id")


    if not session_id:
        return Response(
            {
                "error": "session_id required"
            },
            status=400
        )


    try:

        student = user.student

    except Student.DoesNotExist:

        return Response(
            {
                "error": "Student profile not found"
            },
            status=404
        )



    session = AttendanceSession.objects.filter(
    id=session_id,
    is_active=True
).first()


    if not session:
        return Response(
        {
            "error": "Active session not found"
        },
        status=404
    )


    expected_beacon = (
        BLEBeacon.objects.filter(classroom=session.classroom).first()
        if session.classroom else None
    )

    if not expected_beacon:
        return Response(
        {
            "error": "No BLE beacon assigned to this classroom"
        },
        status=403
    )

    if beacon_id != expected_beacon.beacon_id:

        return Response(
        {
            "error":"Wrong classroom beacon detected",
            "expected": expected_beacon.beacon_id,
            "detected": beacon_id
        },
        status=400
    )



    state, _ = UserSessionState.objects.get_or_create(
    user=user
    )



    # GPS validation

    if latitude is None or longitude is None:
        return Response(
            {
                "error": "Location is required for check-in"
            },
            status=400
        )

    distance = calculate_distance(

        latitude,

        longitude,

        session.latitude,

        session.longitude

    )


    if distance > session.radius_meters:

        return Response(
            {
                "error": "Outside attendance location"
            },
            status=403
        )

    # WiFi and BLE are checked before identity verification. Keep this order
    # consistent with the Flutter validation flow.
    if session.allowed_wifi_bssid and wifi_bssid != session.allowed_wifi_bssid:
        return Response({"error": "Unauthorized WiFi network"}, status=403)

        # fingerprint verification

    if state.current_state != "ATTENDANCE_GRANTED":

        return Response(
            {
                "error": "Fingerprint verification required",
                "state": state.current_state
            },
            status=403
        )

    attendance, created = Attendance.objects.get_or_create(
    student=student,
    session=session,
    defaults={
        "status": "PRESENT",
        "check_in_time": timezone.now()
    }
)


    if not created:

        if attendance.check_in_time:
            return Response(
              {
                "error": "Already checked in"
            },
            status=400
            )

    # Update existing ABSENT record
    attendance.status = "PRESENT"
    attendance.check_in_time = timezone.now()
    attendance.save()
    
    state.current_state = "CHECKED_IN"
    state.save()
    
    Notification.objects.create(
    student=student,
    title="Check-in successful",
    message=f"You checked into {session.subject.name}"
)





    



    return Response(
        {
            "message": "Checked-in successfully",

            "attendance_id": attendance.id,

            "status": attendance.status,

            "distance": round(distance,2)
        }
    )
    
    
    
    
# ======================================================
# STUDENT CHECK OUT
# ======================================================

@api_view(["POST"])
@permission_classes([IsStudent])
def check_out(request):

    user = request.user

    session_id = request.data.get("session_id")

    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")

    wifi_bssid = request.data.get("wifi_bssid")
    beacon_id = request.data.get("beacon_id")


    try:

        student = user.student

    except Student.DoesNotExist:

        return Response(
            {
                "error": "Student profile not found"
            },
            status=404
        )



    attendance = Attendance.objects.filter(

        student=student,

        session_id=session_id,

        check_out_time__isnull=True

    ).first()



    if not attendance:

        return Response(
            {
                "error": "No active attendance record found"
            },
            status=404
        )



    session = attendance.session
    
    if not session:
        return Response(
        {
            "error":"Session not found"
        },
        status=404
    )



    # Session must end before checkout

    if session.is_active:

        return Response(
            {
                "error": "Session is still active. Checkout is allowed after lecturer ends the session."
            },
            status=403
        )
        
    if session.checkout_deadline and timezone.now() > session.checkout_deadline:

        return Response(
        {
            "error":
            "Checkout period expired. You can no longer checkout."
        },
        status=403
        )



    # GPS validation

    if latitude is None or longitude is None:
        return Response(
            {
                "error": "Location is required for checkout"
            },
            status=400
        )

    distance = calculate_distance(

        latitude,

        longitude,

        session.latitude,

        session.longitude

    )


    if distance > session.radius_meters:

        return Response(
            {
                "error": "Outside allowed attendance area"
            },
            status=403
        )



    # WIFI validation

    if session.allowed_wifi_bssid:

        if wifi_bssid != session.allowed_wifi_bssid:

            return Response(
                {
                    "error": "Unauthorized WiFi network"
                },
                status=403
            )



    # BLE classroom validation

    if not session.classroom:
        return Response(
        {
            "error": "No classroom beacon configured for this session"
        },
        status=403
    )


    expected_beacon = BLEBeacon.objects.filter(classroom=session.classroom).first()


    if not expected_beacon:
        return Response(
        {
            "error": "No BLE beacon assigned to this classroom"
        },
        status=403
    )


    if beacon_id != expected_beacon.beacon_id:
        return Response(
        {
            "error": "Wrong classroom BLE beacon detected"
        },
        status=403
    )


    state, _ = UserSessionState.objects.get_or_create(
    user=user
)


    if state.current_state not in [
    "ATTENDANCE_GRANTED",
    "CHECKED_IN"
    ]:
        return Response(
        {
            "error": "Fingerprint verification required",
            "state": state.current_state
        },
        status=403
    )



    checkout_time = timezone.now()


    attendance.check_out_time = checkout_time



    # Calculate attendance percentage

    if session.start_time and session.end_time:

        session_duration = (

            session.end_time -

            session.start_time

        ).total_seconds()



        attended_duration = (

            checkout_time -

            attendance.check_in_time

        ).total_seconds()



        if session_duration > 0:

            attendance.attendance_percentage = min(
            (attended_duration / session_duration) * 100,
            100
            )
            
        if attendance.attendance_percentage < 80:
           attendance.status = "PARTIAL_ATTENDANCE"
        else:
            attendance.status = calculate_attendance_status(attendance)



    attendance.save()
    
    Notification.objects.create(
    student=student,
    title="Checkout successful",
    message=f"Attendance completed with {attendance.attendance_percentage:.0f}% attendance."
)



    state.current_state = "IDLE"
    state.save()



    return Response(
        {
            "message": "Checked-out successfully",

            "status": attendance.status,

            "check_out_time": checkout_time,

            "attendance_percentage":
                attendance.attendance_percentage
        }
    )





# ======================================================
# END SESSION
# LECTURER
# ======================================================

@api_view(["POST"])
@permission_classes([IsLecturer])
def end_session(request):

    session_id = request.data.get("session_id")

    session = AttendanceSession.objects.filter(
        id=session_id,
        lecturer=request.user,
        is_active=True
    ).first()

    if not session:
        return Response(
            {
                "error": "Active session not found"
            },
            status=404
        )

    session.is_active = False

    session.end_time = timezone.now()

    session.ended_at = timezone.now()

    session.checkout_deadline = (
    session.end_time + timedelta(minutes=10)
    )

    session.save()
    
    original_start, original_end = timetable_window(session)

    record_session_change(
        session,
        "END",
        changed_by=request.user,
        reason="",
        original_start=original_start,
        original_end=original_end,
        actual_start=session.start_time,
        actual_end=session.end_time,
    )

    open_records = Attendance.objects.filter(
    session=session,
    check_out_time__isnull=True
)


    for attendance in open_records:

       attendance.check_out_time = session.end_time

       duration = (
        attendance.check_out_time -
        attendance.check_in_time
       ).total_seconds()


       total = (
        session.end_time -
        session.start_time
        ).total_seconds()


       attendance.attendance_percentage = min(
        (duration / total) * 100,
        100
       )


       attendance.status = (
        "PARTIAL_ATTENDANCE"
        if attendance.attendance_percentage < 80
        else "PRESENT"
       )


       attendance.save()


    students = Student.objects.filter(
    course=session.course
)


    # Create ABSENT records for students who never checked in
    for student in students:

        Attendance.objects.get_or_create(
            student=student,
            session=session,
            defaults={
                "status": "ABSENT",
                "attendance_percentage": 0
            }
        )


    # Notify all students
    for student in students:

        Notification.objects.create(
            student=student,
            title="Session ended",
            message=f"{session.subject.name} session has ended."
        )


    return Response(
        {
            "message": "Session ended successfully",
            "session_id": session.id
        }
    )
# ======================================================
# LECTURER DASHBOARD
# ======================================================

@api_view(["GET"])
@permission_classes([IsLecturer])
def lecturer_dashboard(request):

    sessions = AttendanceSession.objects.filter(
        lecturer=request.user
    ).order_by("-start_time")


    data = []


    for session in sessions:


        records = Attendance.objects.filter(
            session=session
        )

        present = records.filter(
            status="PRESENT"
        ).count()

        late = records.filter(
            status="LATE"
        ).count()

        absent = records.filter(
            status="ABSENT"
        ).count()

        # Percentage of students uses every student enrolled in the course as
        # the denominator so it matches the mobile app and the HOD views.
        total, attended, percentage = session_attendance_summary(session)

        data.append({

            "session_id": session.id,

            "course": session.course.name,

            "subject": session.subject.name,

            "date": session.date,

            "active": session.is_active,

            "total_students": total,

            "attended": attended,

            "present": present,

            "late": late,

            "absent": absent,

            "percentage": percentage

        })



    return Response(
        {
            "sessions": data
        }
    )





# ======================================================
# ATTENDANCE REPORT
# ======================================================

@api_view(["GET"])
@permission_classes([IsLecturer])
def attendance_report(request):

    sessions = AttendanceSession.objects.filter(
        lecturer=request.user
    ).order_by("-start_time")


    result = []


    for session in sessions:


        records = Attendance.objects.filter(
            session=session
        )

        present = records.filter(
            status="PRESENT"
        ).count()

        total, attended, percentage = session_attendance_summary(session)

        result.append({

            "session_id": session.id,

            "course": session.course.name,

            "subject": session.subject.name,

            "total": total,

            "present": present,

            "late": records.filter(status="LATE").count(),

            "attended": attended,

            "absent": records.filter(status="ABSENT").count(),

            "percentage": percentage

        })


    return Response(
        {
            "sessions": result
        }
    )





# ======================================================
# SINGLE SESSION REPORT
# ======================================================

@api_view(["GET"])
@permission_classes([IsLecturer])
def session_report(request, session_id):

    session = AttendanceSession.objects.filter(
        id=session_id,
        lecturer=request.user
    ).first()



    if not session:

        return Response(
            {
                "error": "Session not found"
            },
            status=404
        )



    records = Attendance.objects.filter(
        session=session
    ).select_related(
        "student"
    )



    return Response({

        "session_id": session.id,

        "course": session.course.name,

        "subject": session.subject.name,


        "records": [

            {

                "student_id": record.student.id,

                "name": record.student.full_name,

                "registration":
                    record.student.reg_number,

                "status": record.status,

                "check_in":
                    record.check_in_time,

                "check_out":
                    record.check_out_time

            }

            for record in records

        ]

    })





def _session_attendance_payload(session):
    """Class-wide session attendance, identical to the web reports."""
    total_students, attended_students, percentage = session_attendance_summary(session)
    return {
        "total_students": total_students,
        "attended_students": attended_students,
        "session_percentage": percentage,
    }


# ======================================================
# STUDENT ACTIVE SESSION
# ======================================================
@api_view(["GET"])
@permission_classes([IsStudent])
def active_session(request):
    

    try:
        student = request.user.student

    except Student.DoesNotExist:
        return Response(
            {"error": "Student profile not found"},
            status=404
        )

    # Student currently checked in
    attendance = Attendance.objects.filter(
        student=student,
        check_in_time__isnull=False,
        check_out_time__isnull=True,
        status__in=[
            "PRESENT",
            "LATE",
            "PARTIAL_ATTENDANCE"
        ]
    ).select_related("session").first()

    if attendance:
        session = attendance.session

        return Response({
            "session_exists": True,
            "session_id": session.id,
            "session_active": session.is_active,
            "session_ended": not session.is_active,
            "course": session.course.name,
            "subject": session.subject.name,
            **_session_attendance_payload(session),
            "attendance_state": "CHECKED_IN",
            "checked_in": True,
            "checked_out": False,
            "can_check_in": False,
            "can_check_out": (
            not session.is_active and
            timezone.now() <= session.checkout_deadline
        )
        })

    # Student already checked out
    completed = Attendance.objects.filter(
        student=student,
        check_in_time__isnull=False,
        check_out_time__isnull=False
    ).select_related(
        "session"
    ).order_by(
        "-check_out_time"
    ).first()

    if completed:
        session = completed.session

        return Response({
            "session_exists": True,
            "session_id": session.id,
            "session_active": False,
            "session_ended": True,
            "checkout_deadline": session.checkout_deadline,
            "percentage": completed.attendance_percentage,
            "course": session.course.name,
            "subject": session.subject.name,
            **_session_attendance_payload(session),
            "attendance_state": "CHECKED_OUT",
            "checked_in": True,
            "checked_out": True,
            "can_check_in": False,
            "can_check_out": False,
            "auto_closed": session.auto_closed,
            
        })
        
        
    # Recently ended session waiting for checkout

    ended_session = AttendanceSession.objects.filter(
    course=student.course,
    is_active=False,
    checkout_deadline__gte=timezone.now()
    ).order_by("-end_time").first()


    if ended_session:

        return Response({
        "session_exists": True,
        "session_id": ended_session.id,
        "session_active": False,
        "session_ended": True,
        "course": ended_session.course.name,
        "subject": ended_session.subject.name,
        **_session_attendance_payload(ended_session),
        "attendance_state": "SESSION_ENDED",
        "can_check_in": False,
        "can_check_out": True
    })
        
    # Ended session waiting for checkout

    pending_checkout = Attendance.objects.filter(
    student=student,
    check_in_time__isnull=False,
    check_out_time__isnull=True,
    session__is_active=False
).select_related(
    "session"
).order_by(
    "-session__end_time"
).first()


    if pending_checkout:

        session = pending_checkout.session

        return Response({

        "session_exists": True,

        "session_id": session.id,

        "session_active": False,

        "session_ended": True,

        "course": session.course.name,

        "subject": session.subject.name,

        **_session_attendance_payload(session),

        "attendance_state": "SESSION_ENDED",

        "checked_in": True,

        "checked_out": False,

        "can_check_in": False,

        "can_check_out": (
            timezone.now() <= session.checkout_deadline
        )

    })

    # Active lecturer session available
    session = AttendanceSession.objects.filter(
        course=student.course,
        is_active=True
    ).order_by(
        "-start_time"
    ).first()

    if session:

        distance = None

        return Response({
        "session_exists": True,
        "distance": distance,
        "session_id": session.id,
        "session_active": True,
        "session_ended": False,
        "auto_closed": session.auto_closed,
        "checkout_deadline": session.checkout_deadline,
        "course": session.course.name,
        "subject": session.subject.name,
        **_session_attendance_payload(session),
        "attendance_state": "NOT_CHECKED_IN",
        "checked_in": False,
        "checked_out": False,
        "can_check_in": True,
        "can_check_out": False,
        "beacon_id": (
            session.classroom.beacon.beacon_id
            if session.classroom and hasattr(session.classroom, "beacon")
            else None
        ),
    })


    return Response({
        "session_exists": False,
        "attendance_state": "NOT_CHECKED_IN",
        "checked_in": False,
        "checked_out": False
    })


def auto_close_expired_sessions():

    now = timezone.localtime()

    active_sessions = AttendanceSession.objects.filter(
        is_active=True
    )

    for session in active_sessions:

        # ==============================
        # POSTPONED / OVERRIDE SESSION
        # ==============================

        if session.is_override:

            if session.end_time:

                session_end = session.end_time

            else:

                session_end = (
                    session.start_time +
                    timedelta(minutes=session.override_duration_minutes or 120)
                )


        # ==============================
        # NORMAL TIMETABLE SESSION
        # ==============================

        else:

            timetable = session.timetable

            if not timetable:
                continue


            session_end = session.start_time.replace(
                hour=timetable.end_time.hour,
                minute=timetable.end_time.minute,
                second=0,
                microsecond=0
            )


            # Fix case where timetable end becomes before start
            if session_end <= session.start_time:

                session_end = (
                    session.start_time +
                    timedelta(hours=2)
                )


        # ==============================
        # AUTO CLOSE
        # ==============================

        if now >= session_end:

            session.is_active = False

            session.end_time = session_end

            session.ended_at = now

            session.auto_closed = True

            session.checkout_deadline = (
                now + timedelta(minutes=10)
            )

            session.save()

            original_start, original_end = timetable_window(session)

            record_session_change(
                session,
                "AUTO_CLOSE",
                changed_by=None,
                reason="Session automatically closed when its scheduled end time passed.",
                original_start=original_start,
                original_end=original_end,
                actual_start=session.start_time,
                actual_end=session.end_time,
            )


            students = Student.objects.filter(
                course=session.course
            )


            for student in students:

                Notification.objects.create(
                    student=student,
                    title="Session automatically ended",
                    message=(
                        f"{session.subject.name} session "
                        "was automatically closed. "
                        "Checkout is available for 10 minutes."
                    )
                )
                
# ======================================================
# ATTENDANCE STATUS CALCULATION
# ======================================================

def calculate_attendance_status(attendance):


    if not attendance.check_in_time:

        return "INVALID_ATTEMPT"



    if attendance.attendance_percentage >= 80:


        grace_time = (

            attendance.session.start_time +

            timedelta(minutes=15)

        )



        if attendance.check_in_time > grace_time:

            return "LATE"



        return "PRESENT"



    return "PARTIAL_ATTENDANCE"

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def location_update(request):

    student = Student.objects.get(
        user=request.user
    )

    session = AttendanceSession.objects.filter(
        is_active=True
    ).first()


    if not session:
        return Response(
            {
                "message": "No active session"
            },
            status=400
        )
    attendance = Attendance.objects.filter(
      student=student,
      session=session,
      check_in_time__isnull=False
    ).first()


    if not attendance:
        return Response(
        {
            "message": "Fingerprint verification required"
        },
        status=403
        ) 
        
    distance = calculate_distance(
    request.data.get("latitude"),
    request.data.get("longitude"),
    session.latitude,
    session.longitude
)

    inside_geofence = distance <= session.radius_meters 


    MovementLog.objects.create(
    student=student,
    session=session,
    latitude=request.data.get("latitude"),
    longitude=request.data.get("longitude"),
    inside_geofence=inside_geofence,
    wifi_valid=request.data.get("wifi_valid", False),
    beacon_valid=request.data.get("beacon_valid", False)
    )


    return Response(
        {
            "message":"Movement recorded",
            "distance": round(distance, 2),
            "inside_geofence": inside_geofence
        }
    )


# ======================================================
# ADMIN ATTENDANCE REPORT (ALL SESSIONS)
# ======================================================

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_report(request):
    sessions = AttendanceSession.objects.select_related(
        "course", "subject", "lecturer"
    ).order_by("-start_time")

    course_id = request.query_params.get("course_id")
    if course_id and str(course_id).isdigit():
        sessions = sessions.filter(course_id=int(course_id))

    lecturer_id = request.query_params.get("lecturer_id")
    if lecturer_id and str(lecturer_id).isdigit():
        sessions = sessions.filter(lecturer_id=int(lecturer_id))

    day = request.query_params.get("day")
    if day:
        sessions = sessions.filter(date=day)

    start_date = parse_date(request.query_params.get("start_date") or "")
    if start_date:
        sessions = sessions.filter(date__gte=start_date)

    end_date = parse_date(request.query_params.get("end_date") or "")
    if end_date:
        sessions = sessions.filter(date__lte=end_date)

    result = []
    total_records = 0
    total_present = 0

    for session in sessions:
        records = Attendance.objects.filter(session=session)

        present = records.filter(status="PRESENT").count()
        late = records.filter(status="LATE").count()
        absent = records.filter(status="ABSENT").count()

        # Enrolled students are the denominator, matching mobile and HOD views.
        total, attended, percentage = session_attendance_summary(session)

        total_records += total
        total_present += attended

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
            "present": present,
            "late": late,
            "absent": absent,
            "attended": attended,
            "percentage": percentage,
        })

    overview = {
        "total_sessions": len(result),
        "active_sessions": sum(1 for item in result if item["active"]),
        "total_records": total_records,
        "total_present": total_present,
        "overall_percentage": (
            round((total_present / total_records) * 100, 2)
            if total_records else 0
        ),
    }

    return Response({
        "overview": overview,
        "sessions": result,
    })


# ======================================================
# SESSION CHANGE HISTORY
# ======================================================

def change_log_to_dict(log):
    session = log.session
    return {
        "id": log.id,
        "session_id": session.id,
        "course": session.course.name,
        "course_code": session.course.code,
        "subject": session.subject.name,
        "lecturer": session.lecturer.get_full_name() or session.lecturer.username,
        "change_type": log.change_type,
        "change_type_display": log.get_change_type_display(),
        "original_start_time": log.original_start_time,
        "original_end_time": log.original_end_time,
        "actual_start_time": log.actual_start_time,
        "actual_end_time": log.actual_end_time,
        "reason": log.reason,
        "changed_by": (
            log.changed_by.get_full_name() or log.changed_by.username
        ) if log.changed_by else "System",
        "changed_at": log.changed_at,
    }


def session_change_logs(request):
    logs = SessionChangeLog.objects.select_related(
        "session",
        "session__course",
        "session__subject",
        "session__lecturer",
        "changed_by",
    )

    session_id = request.query_params.get("session_id")
    if session_id and str(session_id).isdigit():
        logs = logs.filter(session_id=int(session_id))

    change_type = request.query_params.get("change_type")
    if change_type:
        logs = logs.filter(change_type=change_type.upper())

    course_id = request.query_params.get("course_id")
    if course_id and str(course_id).isdigit():
        logs = logs.filter(session__course_id=int(course_id))

    lecturer_id = request.query_params.get("lecturer_id")
    if lecturer_id and str(lecturer_id).isdigit():
        logs = logs.filter(session__lecturer_id=int(lecturer_id))

    return [change_log_to_dict(log) for log in logs]


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def session_history(request):
    return Response(session_change_logs(request))


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def session_history_detail(request, session_id):
    if not AttendanceSession.objects.filter(id=session_id).exists():
        return Response({"detail": "Session not found."}, status=404)

    logs = SessionChangeLog.objects.select_related(
        "session",
        "session__course",
        "session__subject",
        "session__lecturer",
        "changed_by",
    ).filter(session_id=session_id)

    return Response([change_log_to_dict(log) for log in logs])


# ======================================================
# LECTURER STUDENT ATTENDANCE (% OF ALL STUDENTS IN COURSE + SUBJECT)
# ======================================================

@api_view(["GET"])
@permission_classes([IsLecturer])
def lecturer_scope(request):
    """Courses (with subjects) the lecturer is assigned to, for report filters."""
    user = request.user
    if user.is_staff or user.is_superuser:
        courses = Course.objects.all().order_by("name")
    else:
        courses = Course.objects.filter(
            lecturercourse__lecturer=user
        ).distinct().order_by("name")

    payload = []
    for course in courses:
        subjects = Subject.objects.filter(course=course).order_by("name")
        if not (user.is_staff or user.is_superuser):
            assigned = LecturerSubject.objects.filter(
                lecturer=user,
                subject__course=course
            )
            if assigned.exists():
                subjects = subjects.filter(id__in=assigned.values("subject_id"))

        payload.append({
            "id": course.id,
            "name": course.name,
            "code": course.code,
            "subjects": [
                {
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code,
                }
                for subject in subjects
            ],
        })

    return Response(payload)


@api_view(["GET"])
@permission_classes([IsLecturer])
def lecturer_students(request):
    from students.models import Student
    from django.utils.dateparse import parse_date

    user = request.user

    course_id = request.query_params.get("course_id")
    subject_id = request.query_params.get("subject_id")

    if not course_id or not str(course_id).isdigit():
        return Response(
            {"detail": "course_id is required."},
            status=400,
        )

    course_id = int(course_id)
    subject_id = (
        int(subject_id) if subject_id and str(subject_id).isdigit() else None
    )

    # Lecturers may only report on the courses they are assigned to.
    if not user.is_staff and not user.is_superuser:
        allowed = LecturerCourse.objects.filter(
            lecturer=user, course_id=course_id
        ).exists()
        if not allowed:
            return Response(
                {"detail": "You are not assigned to this course."},
                status=403,
            )

    course = Course.objects.filter(id=course_id).first()
    if not course:
        return Response({"detail": "Course not found."}, status=404)

    subject = None
    if subject_id:
        subject = Subject.objects.filter(id=subject_id, course=course).first()
        if not subject:
            return Response({"detail": "Subject not found."}, status=404)

    sessions = AttendanceSession.objects.filter(course=course)
    if subject_id:
        sessions = sessions.filter(subject_id=subject_id)

    start_date = parse_date(request.query_params.get("start_date") or "")
    if start_date:
        sessions = sessions.filter(date__gte=start_date)

    end_date = parse_date(request.query_params.get("end_date") or "")
    if end_date:
        sessions = sessions.filter(date__lte=end_date)

    session_list = list(sessions)

    students = Student.objects.filter(course=course).select_related("course")

    rows = []
    for student in students:
        attended, total, percentage = student_attendance_stats(student, session_list)
        rows.append({
            "student_id": student.id,
            "name": student.full_name,
            "registration": student.reg_number,
            "course": course.name,
            "course_code": course.code,
            "attended": attended,
            "total_sessions": total,
            "percentage": percentage,
            "status": attendance_status_label(percentage),
        })

    average = (
        round(sum(row["percentage"] for row in rows) / len(rows), 2) if rows else 0.0
    )

    return Response({
        "course": course.name,
        "course_code": course.code,
        "subject": subject.name if subject else None,
        "subject_id": subject.id if subject else None,
        "students": rows,
        "summary": {
            "total_students": len(rows),
            "total_sessions": len(session_list),
            "average_percentage": average,
            "critical_students": len([r for r in rows if r["status"] == "Critical"]),
        },
    })

