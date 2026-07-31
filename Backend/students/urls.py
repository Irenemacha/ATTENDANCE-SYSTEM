from django.urls import path
from .views import mark_all_notifications_read, student_dashboard, my_notifications, mark_notification_read



urlpatterns = [
    path("dashboard/", student_dashboard, name="student-dashboard"),
   
   
    path("notifications/",my_notifications,name="notifications"),
    path("notifications/<int:notification_id>/read/", mark_notification_read,name="mark-notification-read"),
    path("mark-all-read/",mark_all_notifications_read,name="mark_all_notifications_read"),
    
]
