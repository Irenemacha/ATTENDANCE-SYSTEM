from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdminOrStaff, IsLecturer, is_staff_or_superuser
from courses.models import Course, LecturerCourse, StudentCourse, Timetable, Classroom, Subject

User = get_user_model()


def course_to_dict(course):
    return {
        "id": course.id,
        "name": course.name,
        "code": course.code,
        "department": course.department_id,
        "department_name": course.department.name,
    }


def classroom_to_dict(classroom):
    return {
        "id": classroom.id,
        "room_name": classroom.room_name,
        "room_number": classroom.room_number,
        "latitude": classroom.latitude,
        "longitude": classroom.longitude,
        "radius_meters": classroom.radius_meters,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff | IsLecturer])
def course_list_create(request):
    if request.method == "GET":
        courses = Course.objects.select_related("department").all()
        return Response([course_to_dict(course) for course in courses])

    if not is_staff_or_superuser(request.user):
        return Response(
            {"detail": "Only admins can create courses."},
            status=status.HTTP_403_FORBIDDEN,
        )

    course = Course.objects.create(
        name=request.data.get("name"),
        code=request.data.get("code"),
        department_id=request.data.get("department_id"),
    )
    return Response({"message": "Course created", "id": course.id}, status=201)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAdminOrStaff | IsLecturer])
def course_detail(request, pk):
    course = Course.objects.filter(id=pk).select_related("department").prefetch_related("subjects").first()
    if not course:
        return Response({"detail": "Course not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        data = course_to_dict(course)
        data["subjects"] = [
            {"id": subject.id, "name": subject.name, "code": subject.code}
            for subject in course.subjects.all()
        ]
        return Response(data)

    if not is_staff_or_superuser(request.user):
        return Response(
            {"detail": "Only admins can modify courses."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == "PATCH":
        if "name" in request.data:
            course.name = request.data["name"]
        if "code" in request.data:
            course.code = request.data["code"]
        if "department_id" in request.data:
            course.department_id = request.data["department_id"]
        course.save()
        return Response(course_to_dict(course))

    course.delete()
    return Response({"message": "Course deleted"}, status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff | IsLecturer])
def classroom_list_create(request):
    if request.method == "GET":
        return Response([classroom_to_dict(c) for c in Classroom.objects.all()])

    if not is_staff_or_superuser(request.user):
        return Response(
            {"detail": "Only admins can create classrooms."},
            status=status.HTTP_403_FORBIDDEN,
        )

    classroom = Classroom.objects.create(
        room_name=request.data.get("room_name"),
        room_number=request.data.get("room_number"),
        latitude=request.data.get("latitude"),
        longitude=request.data.get("longitude"),
        radius_meters=request.data.get("radius_meters", 20),
    )
    return Response(classroom_to_dict(classroom), status=201)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAdminOrStaff | IsLecturer])
def classroom_detail(request, pk):
    classroom = Classroom.objects.filter(id=pk).first()
    if not classroom:
        return Response({"detail": "Classroom not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(classroom_to_dict(classroom))

    if not is_staff_or_superuser(request.user):
        return Response(
            {"detail": "Only admins can modify classrooms."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == "PATCH":
        for field in ("room_name", "room_number", "latitude", "longitude", "radius_meters"):
            if field in request.data:
                setattr(classroom, field, request.data[field])
        classroom.save()
        return Response(classroom_to_dict(classroom))

    classroom.delete()
    return Response({"message": "Classroom deleted"}, status=status.HTTP_204_NO_CONTENT)


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
