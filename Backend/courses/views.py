from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdminOrStaff
from courses.models import Course, LecturerCourse, StudentCourse, Timetable

User = get_user_model()


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def course_list_create(request):
    if request.method == "GET":
        courses = Course.objects.select_related("department").all()
        return Response([
            {
                "id": course.id,
                "name": course.name,
                "code": course.code,
                "department": course.department.name,
            }
            for course in courses
        ])

    course = Course.objects.create(
        name=request.data.get("name"),
        code=request.data.get("code"),
        department_id=request.data.get("department_id"),
    )
    return Response({"message": "Course created", "id": course.id}, status=201)


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def assign_student_to_course(request):
    student_id = request.data.get("student_id")
    course_id = request.data.get("course_id")

    student = User.objects.filter(id=student_id, groups__name__iexact="Student").first()
    if not student:
        return Response({"detail": "Student user not found."}, status=status.HTTP_404_NOT_FOUND)

    course = Course.objects.filter(id=course_id).first()
    if not course:
        return Response({"detail": "Course not found."}, status=status.HTTP_404_NOT_FOUND)

    StudentCourse.objects.get_or_create(student=student, course=course)
    return Response({"message": "Student assigned successfully"})


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def assign_lecturer_to_course(request):
    lecturer_id = request.data.get("lecturer_id")
    course_id = request.data.get("course_id")

    lecturer = User.objects.filter(id=lecturer_id, groups__name__iexact="Lecturer").first()
    if not lecturer:
        return Response({"detail": "Lecturer user not found."}, status=status.HTTP_404_NOT_FOUND)

    course = Course.objects.filter(id=course_id).first()
    if not course:
        return Response({"detail": "Course not found."}, status=status.HTTP_404_NOT_FOUND)

    LecturerCourse.objects.get_or_create(lecturer=lecturer, course=course)
    return Response({"message": "Lecturer assigned successfully"})


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def create_timetable(request):
    Timetable.objects.create(
        course_id=request.data["course_id"],
        lecturer_id=request.data["lecturer_id"],
        day=request.data["day"],
        start_time=request.data["start_time"],
        end_time=request.data["end_time"],
        room=request.data["room"],
    )
    return Response({"message": "Timetable created"}, status=201)
