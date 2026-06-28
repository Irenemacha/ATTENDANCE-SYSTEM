from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from .models import Course, StudentCourse, LecturerCourse
from django.conf import settings
settings.AUTH_USER_MODEL


# ======================
# COURSE LIST / CREATE
# ======================
@api_view(['GET', 'POST'])
@permission_classes([IsAdmin])
def course_list_create(request):
    if request.method == 'GET':
        courses = Course.objects.all()
        data = [{"id": c.id, "name": c.name} for c in courses]
        return Response(data)

    elif request.method == 'POST':
        course = Course.objects.create(name=request.data.get('name'))
        return Response({"message": "Course created", "id": course.id})


# ======================
# ASSIGN STUDENT
# ======================
@api_view(['POST'])
@permission_classes([IsAdmin])
def assign_student_to_course(request):
    student_id = request.data.get('student_id')
    course_id = request.data.get('course_id')

    student = User.objects.get(id=student_id, role='student')
    course = Course.objects.get(id=course_id)

    StudentCourse.objects.create(student=student, course=course)

    return Response({"message": "Student assigned successfully"})


# ======================
# ASSIGN LECTURER
# ======================
@api_view(['POST'])
@permission_classes([IsAdmin])
def assign_lecturer_to_course(request):
    lecturer_id = request.data.get('lecturer_id')
    course_id = request.data.get('course_id')

    lecturer = User.objects.get(id=lecturer_id, role='lecturer')
    course = Course.objects.get(id=course_id)

    LecturerCourse.objects.create(lecturer=lecturer, course=course)

    return Response({"message": "Lecturer assigned successfully"})

@api_view(['POST'])
def create_timetable(request):
    Timetable.objects.create(
        course_id=request.data['course_id'],
        lecturer_id=request.data['lecturer_id'],
        day=request.data['day'],
        start_time=request.data['start_time'],
        end_time=request.data['end_time'],
        room=request.data['room']
    )

    return Response({"message": "Timetable created"})