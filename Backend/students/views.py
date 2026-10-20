from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from students.models import Student, Notification
from rest_framework.permissions import IsAuthenticated

from .models import Notification
from .serializers import NotificationSerializer

from accounts.permissions import IsStudent
from .models import Student
from attendance.models import Attendance, AttendanceSession
from attendance.services import student_attendance_stats, attendance_status_label

@api_view(["GET"])
@permission_classes([IsStudent])
def student_dashboard(request):
    user = request.user

    try:
        # ✅ correct direction: User → Student
        student = Student.objects.get(user=user)

        course_sessions = AttendanceSession.objects.filter(
            course=student.course
        )
        total_sessions = course_sessions.count()

        attendance_records = Attendance.objects.filter(
            student=student
        )

        # Session-count based percentage shared with the web reports: a session
        # counts as attended once the student has checked in and is not absent.
        attended_sessions, total_sessions, percentage = student_attendance_stats(
            student, course_sessions
        )

        total_absent = attendance_records.filter(
            status="ABSENT"
        ).count()

        status = attendance_status_label(percentage)

        return Response({
            "success": True,
            "data": {
                "name": student.full_name,
                "course": student.course.name,
                "department": getattr(getattr(student.course, "department", None), "name", None),
                "year": student.year_of_study,
                "present": attended_sessions,
                "absent": total_absent,
                "total_sessions": total_sessions,
                "attended_sessions": attended_sessions,
                "percentage": percentage,
                "status": status
            }
        })

    except Student.DoesNotExist:
        return Response({
            "success": False,
            "message": "Student profile not found"
        }, status=404)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_notifications(request):

    student = request.user.student

    notifications = Notification.objects.filter(
        student=student
    ).order_by("-created_at")
    
    serializer = NotificationSerializer(
    notifications,
    many=True
)

    data = [
        {
            "title": n.title,
            "message": n.message,
            "read": n.is_read,
            "created": n.created_at
        }
        for n in notifications
    ]

    return Response(data)
