from django.urls import path
from .views import assign_student_to_course, assign_lecturer_to_course
from . import views

urlpatterns = [
    path('', views.course_list_create,name='course_list_create'),
    path('<int:pk>/', views.course_detail, name='course_detail'),
    path('classrooms/', views.classroom_list_create, name='classroom_list_create'),
    path('classrooms/<int:pk>/', views.classroom_detail, name='classroom_detail'),
    path('assign-student/', assign_student_to_course, name='assign_student_to_course'),
    path('assign-lecturer/', assign_lecturer_to_course, name='assign_lecturer-to_course'),
    path('timetable/', views.timetable_list_create, name='timetable_list_create'),
    path('timetable/upload/', views.timetable_upload, name='timetable_upload'),
    path('timetable/<int:pk>/', views.timetable_detail, name='timetable_detail'),
    path('subjects/', views.subject_list_create, name='subject_list_create'),
    path('subjects/<int:pk>/', views.subject_detail, name='subject_detail'),
    path('enrollments/', views.enrollment_list_create, name='enrollment_list_create'),
    path('enrollments/<int:pk>/', views.enrollment_detail, name='enrollment_detail'),
]