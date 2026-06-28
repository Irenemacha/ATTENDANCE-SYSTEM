from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from geopy.distance import geodesic
from rest_framework.permissions import IsAuthenticated

from accounts.services import advance_user_state
from accounts.models import UserSessionState
from datetime import datetime

from accounts.permissions import IsLecturer, IsStudent

from courses.models import (
    Course,
    Subject,
    Timetable,
    LecturerCourse,
    LecturerSubject
)

from .models import AttendanceSession, Attendance
from .utils import calculate_distance

def is_within_geofence(student_lat, student_lng, session_lat, session_lng, radius):
    distance = geodesic(
        (student_lat, student_lng),
        (session_lat, session_lng)
    ).meters

    return distance <= radius


# =========================
# 1. START SESSION (LECTURER)
# =========================
@api_view(['POST'])
@permission_classes([IsLecturer])
def start_session(request):

    user = request.user

    course_id = request.data.get("course_id")
    subject_id = request.data.get("subject")
    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")
    radius = request.data.get("radius")

    # 1. check lecturer-course assignment
    if not LecturerCourse.objects.filter(
        lecturer=user,
        course_id=course_id
    ).exists():
        return Response(
            {"detail": "You are not assigned to this course"},
            status=403
        )

    # 2. validate subject belongs to course
    subject = Subject.objects.filter(
        id=subject_id,
        course_id=course_id
    ).first()

    if not subject:
        return Response(
            {"detail": "Invalid subject for this course"},
            status=400
        )

    # 3. check lecturer-subject permission
    if not LecturerSubject.objects.filter(
        lecturer=user,
        subject=subject
    ).exists():
        return Response(
            {"detail": "Not allowed to teach this subject"},
            status=403
        )

    # 4. create session
    session = AttendanceSession.objects.create(
        lecturer=user,
        course_id=course_id,
        subject=subject,
        latitude=latitude,
        longitude=longitude,
        radius_meters=radius,
        is_active=True
    )

    return Response({
        "message": "Session started successfully",
        "session_id": session.id
    })


# =========================
# 2. CHECK IN (STUDENT)
# =========================
@api_view(['POST'])
@permission_classes([IsStudent])
def check_in(request):

    student = request.user
    session_id = request.data.get("session_id")
    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")
    
    state = UserSessionState.objects.filter(user=student).first()

    if not state:
        return Response({"error": "No session state"}, status=400)

    session = AttendanceSession.objects.filter(
        id=session_id,
        is_active=True
    ).first()
    
    if not session:
        return Response({"detail": "Session not found"}, status=404)
    active_class = get_active_class()


    if not active_class:
        active_class = get_active_class()

    if not active_class:
        return Response({"error": "No active class right now"}, status=400)

    if session.course != active_class.course:
        return Response({"error": "This session is not for current class time"}, status=403)
  

    # geofence check
    distance = calculate_distance(
        latitude,
        longitude,
        session.latitude,
        session.longitude
    )
    
    if distance > session.radius_meters:
        return Response(
        {"detail": "You are outside allowed area"},
        status=403
    )

# ONLY UPDATE STATE AFTER SUCCESS
    state.geofence_verified = True
    state.save()
    
  
    

    if distance > session.radius_meters:
        return Response(
            {"detail": "You are outside allowed area"},
            status=403
        )

    # prevent duplicate check-in
    if Attendance.objects.filter(
        student=student,
        session=session
    ).exists():
        return Response(
            {"detail": "Already checked in"},
            status=400
        )

    Attendance.objects.create(
        student=student,
        session=session,
        status="PRESENT"
    )

    return Response({"message": "Check-in successful"})


# =========================
# 3. CHECK OUT (STUDENT)
# =========================
@api_view(['POST'])
@permission_classes([IsStudent])
def check_out(request):

    student = request.user
    session_id = request.data.get("session_id")

    attendance = Attendance.objects.filter(
        student=student,
        session_id=session_id
    ).first()

    if not attendance:
        return Response(
            {"detail": "You have not checked in"},
            status=404
        )

    attendance.check_out_time = timezone.now()
    attendance.save()

    return Response({"message": "Check-out successful"})


# =========================
# 4. END SESSION (LECTURER)
# =========================
@api_view(['POST'])
@permission_classes([IsLecturer])
def end_session(request):

    session_id = request.data.get("session_id")

    session = AttendanceSession.objects.filter(
        id=session_id,
        is_active=True
    ).first()

    if not session:
        return Response(
            {"detail": "Session not found"},
            status=404
        )

    session.is_active = False
    session.end_time = timezone.now()
    session.save()

    return Response({"message": "Session ended successfully"})


# =========================
# 5. LECTURER DASHBOARD (BASIC)
# =========================
@api_view(['GET'])
@permission_classes([IsLecturer])
def lecturer_dashboard(request):

    lecturer = request.user

    sessions = AttendanceSession.objects.filter(
        lecturer=lecturer
    ).order_by('-start_time')

    data = []

    for session in sessions:

        attendance_qs = Attendance.objects.filter(session=session)

        total = attendance_qs.count()
        present = attendance_qs.filter(status="PRESENT").count()
        late = attendance_qs.filter(status="LATE").count()
        absent = attendance_qs.filter(status="ABSENT").count()
        percentage = (present / total * 100) if total > 0 else 0

        data.append({
            "session_id": session.id,
            "course": session.course.name,
            "subject": session.subject.name,
            "date": session.date,
            "is_active": session.is_active,

            # 🔥 ATTENDANCE STATS
            "total_students": total,
            "present": present,
            "late": late,
            "absent": absent,
            "percentage": percentage,
        })

    return Response({
        "lecturer": lecturer.username,
        "sessions": data
    })
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_attendance(request):
    user = request.user
    session_id = request.data.get("session_id")
    
    session = AttendanceSession.objects.filter(
    id=session_id,
    is_active=True
).first()
    
    if request.user.is_anonymous:
       return Response({"error": "Unauthorized"}, status=403)
   
    if not state:
        return Response({"error": "No session state found"}, status=400)

    if not session:
       return Response({"error": "Invalid or inactive session"}, status=404)

    state = UserSessionState.objects.filter(user=user).first()
    
    from accounts.services import can_mark_attendance

    allowed, message = can_mark_attendance(state) 

    if not allowed:
        return Response({"error": message}, status=403)
    
    # 🛡️ FINAL AUTH LOCK (FINGERPRINT + OTP CHECK)
    if not state.fingerprint_verified and not state.otp_verified:
       return Response({"error": "Authentication incomplete"}, status=403)
    
    # 🛡️ SECURITY LOCK (STATE ENGINE CHECK)
    allowed, message = can_mark_attendance(state)

    if not allowed:
        return Response({"error": message}, status=403)

    if not state:
        return Response({"error": "No session state"}, status=400)

    # 🛡️ ANTI-BYPASS CHECKS (VERY IMPORTANT)
    if not state.device_verified:
        return Response({"error": "Device not verified"}, status=403)

    if not state.geofence_verified:
        return Response({"error": "Not inside class area"}, status=403)

    if state.current_state != "ATTENDANCE_GRANTED":
        return Response({"error": "Fingerprint/OTP not completed"}, status=403)


    # 🟢 FINAL SUCCESS
    state.current_state = "ATTENDANCE_GRANTED"
    state.save()

    advance_user_state(user, "attendance_success")
    
    Attendance.objects.create(
    student=request.user,
    session_id=request.data.get("session_id"),  
    status="PRESENT"
)

    return Response({
        "message": "Attendance marked successfully"
    })
    
    
def get_active_class():
    now = datetime.now()

    day_map = {
        0: "MON",
        1: "TUE",
        2: "WED",
        3: "THU",
        4: "FRI",
        5: "SAT",
        6: "SUN",
    }

    today = day_map[now.weekday()]
    current_time = now.time()

    return Timetable.objects.filter(
        day=today,
        start_time__lte=current_time,
        end_time__gte=current_time
    ).first()