from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from geopy.distance import geodesic
from students.models import Notification
from students.models import Student

from accounts.models import UserSessionState
from accounts.permissions import IsLecturer, IsStudent
from accounts.services import advance_user_state

from courses.models import (
    Subject,
    Timetable,
    LecturerCourse,
    LecturerSubject,
    Classroom
)

from students.models import Student

from .models import AttendanceSession, Attendance, MovementLog
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
    is_override = request.data.get(
        "is_override",
         False
    )

    override_reason = request.data.get(
        "override_reason"
    )

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


    today = timezone.localtime().weekday()


    timetable = Timetable.objects.filter(
    course_id=course_id,
    lecturer=user,
    day=days[today]
    ).first()


    if not timetable and not is_override:

        return Response(
        {
            "error": "No timetable found. Use override with reason if this is a postponed/replacement class."
        },
        status=400
    )


    if is_override and not override_reason:

        return Response(
        {
            "error": "Override reason is required"
        },
        status=400
    )

    # Fixed, explicit values for the current demo environment.
    allowed_wifi = "ARUSOPASUANET"
    


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


    # Lecturer subject permission

    if not user.is_staff and not user.is_superuser:

        allowed_subject = LecturerSubject.objects.filter(
            lecturer=user,
            subject=subject
        ).exists()


        if not allowed_subject:
            return Response(
                {
                    "error": "You are not allowed to teach this subject"
                },
                status=403
            )
     
    session = AttendanceSession.objects.create(

    lecturer=user,

    course_id=course_id,

    subject=subject,

    classroom=classroom,

    timetable=timetable,

    latitude=classroom.latitude,

    longitude=classroom.longitude,

    radius_meters=classroom.radius_meters,

    allowed_wifi_bssid=allowed_wifi,

    start_time=timezone.now(),

    is_active=True,

    is_override=is_override,

    override_reason=override_reason
)
    
    students = Student.objects.all()

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
    expected_beacon = session.classroom.beacon
    
    # DEMO BLE SCANNER RESULT
    detected_beacon_id = "Beacon 1C"


    if detected_beacon_id != expected_beacon.beacon_id:

        return Response(
        {
            "error":"Wrong classroom beacon detected",
            "expected": expected_beacon.beacon_id,
            "detected": detected_beacon_id
        },
        status=400
    )



    if not session:

        return Response(
            {
                "error": "Active session not found"
            },
            status=404
        )



    state, _ = UserSessionState.objects.get_or_create(
    user=user
    )



    # GPS validation

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

    # BLE classroom validation

    if session.classroom:

       expected_beacon = session.classroom.beacon

    if beacon_id != expected_beacon.beacon_id:

        return Response(
            {
                "error": "Wrong classroom BLE beacon detected"
            },
            status=403
        )

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

    if session.classroom:

        expected_beacon = session.classroom.beacon

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


    if state.current_state != "ATTENDANCE_GRANTED":

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
           if attendance.attendance_percentage <80
           else "PRESENT")


        attendance.save()
        
    Notification.objects.create(
    student=attendance.student,
    title="Session ended",
    message=f"{session.subject.name} session has ended."
)
    

    students = Student.objects.filter(
        course=session.course
    )

    for student in students:

        Attendance.objects.get_or_create(
        student=student,
        session=session,
        defaults={
        "status": "ABSENT",
        "attendance_percentage": 0
    }
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


        total = records.count()

        present = records.filter(
            status="PRESENT"
        ).count()

        late = records.filter(
            status="LATE"
        ).count()

        absent = records.filter(
            status="ABSENT"
        ).count()



        percentage = (

            present / total * 100

        ) if total else 0



        data.append({

            "session_id": session.id,

            "course": session.course.name,

            "subject": session.subject.name,

            "date": session.date,

            "active": session.is_active,

            "total_students": total,

            "present": present,

            "late": late,

            "absent": absent,

            "percentage": round(
                percentage,
                2
            )

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


        total = records.count()


        present = records.filter(
            status="PRESENT"
        ).count()



        result.append({

            "session_id": session.id,

            "course": session.course.name,

            "subject": session.subject.name,

            "total": total,

            "present": present,

            "absent":
                records.filter(
                    status="ABSENT"
                ).count(),

            "percentage":
                round(
                    (present / total) * 100,
                    2
                )
                if total else 0

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





# ======================================================
# STUDENT ACTIVE SESSION
# ======================================================
@api_view(["GET"])
@permission_classes([IsStudent])
def active_session(request):
    auto_close_expired_sessions()

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
            "attendance_state": "CHECKED_OUT",
            "checked_in": True,
            "checked_out": True,
            "can_check_in": False,
            "can_check_out": False,
            "auto_closed": session.auto_closed,
            
        })

    # Active lecturer session available
    session = AttendanceSession.objects.filter(
        course=student.course,
        is_active=True
    ).order_by(
        "-start_time"
    ).first()

    if session:
        distance = 0
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
            "attendance_state": "NOT_CHECKED_IN",
            "checked_in": False,
            "checked_out": False,
            "can_check_in": True,
            "can_check_out": False,
            "beacon_id": session.classroom.beacon.beacon_id
    if session.classroom and hasattr(session.classroom, "beacon")
       else None,
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

        timetable = session.timetable

        if not timetable:
            continue


        session_end = timezone.datetime.combine(
            session.date,
            timetable.end_time
        )

        session_end = timezone.make_aware(
            session_end
        )


        if now > session_end:

            session.is_active = False

            session.end_time = session_end

            session.ended_at = now

            session.auto_closed = True

            session.checkout_deadline = (
                now + timedelta(minutes=10)
            )

            session.save()


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
                        "You can checkout within 10 minutes."
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
