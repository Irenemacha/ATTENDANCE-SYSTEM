from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.utils import timezone
from django.utils import timezone
from math import radians, sin, cos, sqrt, atan2
from math import radians, sin, cos, sqrt, atan2
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from accounts.permissions import IsStudent, IsLecturer, IsAdmin

from .models import Attendance, AttendanceSession

@api_view(['POST'])
def check_in(request):

    student_lat = float(request.data.get("latitude"))
    student_lon = float(request.data.get("longitude"))

    session = AttendanceSession.objects.filter(is_active=True).first()

    if not session:
        return Response({"message": "No active session"}, status=400)

    distance = calculate_distance(
        student_lat,
        student_lon,
        session.latitude,
        session.longitude
    )

    if distance > session.radius_meters:
        return Response({
            "message": "Outside classroom range",
            "distance": round(distance, 2)
        }, status=400)

    attendance, created = Attendance.objects.get_or_create(
        student=request.user,
        session=session,
        defaults={"status": "PENDING"}
    )

    attendance.check_in_time = timezone.now()
    attendance.save()

    return Response({
        "message": "Checked in",
        "distance": round(distance, 2)
    })
    wifi_ssid = request.data.get("wifi_ssid")
    if session.allowed_wifi_ssid:
        
        if wifi_ssid != session.allowed_wifi_ssid:
            return Response({
            "message": "You are not connected to allowed WiFi",
            "required": session.allowed_wifi_ssid,
            "detected": wifi_ssid
            }, status=400)
         
@api_view(['POST'])
def check_out(request):

    attendance = Attendance.objects.filter(
        student=request.user,
        check_out_time__isnull=True
    ).first()

    if not attendance:
        return Response({"message": "No active check-in"}, status=400)

    attendance.check_out_time = timezone.now()

    session = attendance.session

    total_seconds = session.duration_minutes * 60

    spent_seconds = (attendance.check_out_time - attendance.check_in_time).seconds

    ratio = (spent_seconds / total_seconds) * 100

    # 🧠 STATE MACHINE LOGIC
    if ratio >= 75:
        attendance.status = "PRESENT"
    elif 50 <= ratio < 75:
        attendance.status = "LATE"
    else:
        attendance.status = "ABSENT"

    attendance.save()

    return Response({
        "status": attendance.status,
        "percentage": round(ratio, 2)
    })

@api_view(['POST'])
def start_session(request):

    # 🔴 HII NDIO PLACE SAHIHI
    if AttendanceSession.objects.filter(
        lecturer=request.user,
        is_active=True
    ).exists():
        return Response(
            {"message": "You already have an active session"},
            status=400
        )

    session = AttendanceSession.objects.create(
        lecturer=request.user,
        course="Default Course",
        is_active=True,
        start_time=timezone.now()
    )

    return Response({
        "message": "Session started",
        "session_id": session.id
    })

@api_view(['POST'])
def end_session(request):

    session = AttendanceSession.objects.filter(
        lecturer=request.user,
        is_active=True
    ).first()

    if not session:
        return Response({"message": "No active session"}, status=400)

    session.is_active = False
    session.end_time = timezone.now()
    session.save()

    return Response({"message": "Session ended"})
@api_view(['GET'])
@permission_classes([IsStudent])
def student_report(request):
    
    student = request.user

    # total sessions student ameingia
    total_attendance = Attendance.objects.filter(student=student).count()

    # sessions alizopresent
    present_count = Attendance.objects.filter(
        student=student,
        status="Present"
    ).count()

    if total_attendance == 0:
        return Response({
            "message": "No attendance records found"
        }, status=400)

    percentage = (present_count / total_attendance) * 100

    return Response({
        "student": student.username,
        "total_sessions": total_attendance,
        "present_sessions": present_count,
        "message": "Student report",
        "attendance_percentage": round(percentage, 2)
       
        
    })

@api_view(['GET'])
@permission_classes([IsLecturer])
def lecturer_session_report(request, session_id):

    session = AttendanceSession.objects.filter(id=session_id).first()

    if not session:
        return Response({"message": "Session not found"}, status=404)

    records = Attendance.objects.filter(session=session)

    total_students = records.count()
    present = records.filter(status="Present").count()
    late = records.filter(status="Late").count()
    absent = records.filter(status="Absent").count()

    return Response({
        "session_id": session.id,
        "course": session.course,
        "total_students": total_students,
        "present": present,
        "late": late,
        "absent": absent,
        "message": "Lecturer report"
    })
def auto_close_sessions():

    now = timezone.now()

    active_sessions = AttendanceSession.objects.filter(is_active=True)

    for session in active_sessions:

        if session.start_time and session.duration_minutes:

            end_time = session.start_time + timezone.timedelta(minutes=session.duration_minutes)

            if now >= end_time:

                session.is_active = False
                session.save()
                
                
def finalize_attendance(session):

    attendances = Attendance.objects.filter(session=session)

    for a in attendances:

        if not a.check_in_time:
            a.status = "ABSENT"

        elif not a.check_out_time:
            a.status = "ABSENT"

        a.save()
def calculate_distance(lat1, lon1, lat2, lon2):

    R = 6371000

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2

    c = 2 * atan2(sqrt(a), sqrt(1-a))

    return R * c