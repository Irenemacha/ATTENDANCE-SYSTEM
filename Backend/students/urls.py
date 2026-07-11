from django.urls import path
from .views import student_dashboard
from .views import my_notifications

urlpatterns = [
    path("dashboard/", student_dashboard, name="student-dashboard"),
   
   
    path("notifications/",my_notifications,name="notifications"),
]
