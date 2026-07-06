from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsStudent
from .models import Student
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

        attended_sessions = Attendance.objects.filter(
            student=student,
            status="PRESENT"
        ).count()

        total_absent = max(total_sessions - attended_sessions, 0)
        percentage = round((attended_sessions / total_sessions) * 100, 2) if total_sessions > 0 else 0
        status = "Fine" if percentage >= 75 else "Critical"

        return Response({
            "success": True,
            "data": {
                "name": student.full_name,
                "course": student.course.name,
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

