from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()

class AttendanceSession(models.Model):

    lecturer = models.ForeignKey(User, on_delete=models.CASCADE)
    course = models.CharField(max_length=100)

    is_active = models.BooleanField(default=True)

    start_time = models.DateTimeField(auto_now_add=True)
    duration_minutes = models.IntegerField(default=60)

    # 🧠 GPS LOCATION YA DARASA
    latitude = models.FloatField()
    longitude = models.FloatField()
    radius_meters = models.IntegerField(default=50)
    # 🧠 WIFI VALIDATION
    allowed_wifi_ssid = models.CharField(max_length=100, null=True, blank=True)

class Attendance(models.Model):

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("PRESENT", "Present"),
        ("LATE", "Late"),
        ("ABSENT", "Absent"),
        ("CHECKED_OUT", "Checked Out"),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE)
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE)

    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING"
    )