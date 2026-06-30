from django.urls import path
from .views import student_dashboard

urlpatterns = [
    path("dashboard/", student_dashboard, name="student-dashboard"),
]