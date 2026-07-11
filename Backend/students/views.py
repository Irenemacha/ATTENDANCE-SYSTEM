from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from students.models import Student, Notification
from rest_framework.permissions import IsAuthenticated

from .models import Notification
from .serializers import NotificationSerializer

from accounts.permissions import IsStudent
from .models import Student
from django.db.models import Sum
from attendance.models import Attendance, AttendanceSession

@api_view(["GET"])
@permission_classes([IsStudent])
def student_dashboard(request):
    user = request.user

    try:
        # ✅ correct direction: User → Student
        student = Student.objects.get(user=user)

        total_sessions = AttendanceSession.objects.filter(
            course=student.course
        ).count()

        # A session counts as attended only after its matching check-in and
        # check-out have both been recorded. This keeps the percentage based
        # on total sessions versus completed attendance sessions.
        attendance_records = Attendance.objects.filter(
        student=student
        )


        attended_sessions = attendance_records.filter(
        check_in_time__isnull=False
        ).exclude(
          status="ABSENT"
        ).count()


        total_absent = attendance_records.filter(
        status="ABSENT"
        ).count()


# Calculate actual attendance percentage
        total_percentage = attendance_records.aggregate(
        total=Sum("attendance_percentage")
        )["total"] or 0


        percentage = round(
        total_percentage / total_sessions,
        2
        )   if total_sessions > 0 else 0 
        status = "Fine" if percentage >= 75 else "Critical"

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
