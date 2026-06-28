from django.urls import path
from .views import assign_student_to_course, assign_lecturer_to_course
from . import views

urlpatterns = [
    path('', views.course_list_create,name='course_list_create'),
    path('assign-student/', assign_student_to_course, name='assign_student_to_course'),
    path('assign-lecturer/', assign_lecturer_to_course, name='assign_lecturer-to_course'),
]