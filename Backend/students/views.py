from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsStudent
from .models import Student
from attendance.models import Attendance

@api_view(["GET"])
@permission_classes([IsStudent])
def student_dashboard(request):
    user = request.user

    try:
        # ✅ correct direction: User → Student
        student = Student.objects.get(user=user)

        total_present = Attendance.objects.filter(
            student=student,
            status="PRESENT"
        ).count()

        total_absent = Attendance.objects.filter(
            student=student,
            status="ABSENT"
        ).count()

        total = total_present + total_absent
        percentage = round((total_present / total) * 100, 2) if total > 0 else 0

        return Response({
            "success": True,
            "data": {
                "name": student.full_name,
                "course": student.course.name,
                "year": student.year_of_study,
                "present": total_present,
                "absent": total_absent,
                "percentage": percentage
            }
        })

    except Student.DoesNotExist:
        return Response({
            "success": False,
            "message": "Student profile not found"
        }, status=404)
