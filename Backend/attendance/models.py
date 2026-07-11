from django.db import models
from django.utils import timezone
from students.models import Student
from courses.models import Course, Subject
from django.conf import settings


# =========================
# ATTENDANCE SESSION
# =========================
class AttendanceSession(models.Model):
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)

    date = models.DateField(default=timezone.now)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)

    latitude = models.FloatField()
    longitude = models.FloatField()
    radius_meters = models.IntegerField(default=100)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.course.name} - {self.subject.name}"
    
    allowed_wifi_bssid = models.CharField(
    max_length=255,
    blank=True,
    null=True
    )

    allowed_beacon_id = models.CharField(
    max_length=255,
    null=True,
    blank=True
    )


# =========================
# ATTENDANCE
# =========================
class Attendance(models.Model):

    STATUS_CHOICES = [
    ("PRESENT", "Present"),
    ("LATE", "Late"),
    ("PARTIAL_ATTENDANCE", "Partial Attendance"),
    ("INVALID_ATTEMPT", "Invalid Attempt"),
    ("ABSENT", "Absent"),
    
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE)

    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PRESENT"
    )
    attendance_percentage = models.DecimalField(
    max_digits=5,
    decimal_places=2,
    default=0
    )
class MovementLog(models.Model):

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="movement_logs"
    )

    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.CASCADE,
        related_name="movement_logs"
    )

    latitude = models.FloatField()

    longitude = models.FloatField()

    timestamp = models.DateTimeField(
        auto_now_add=True
    )

    inside_geofence = models.BooleanField(
        default=True
    )

    wifi_valid = models.BooleanField(
        default=False
    )

    beacon_valid = models.BooleanField(
        default=False
    )


    def __str__(self):
        return f"{self.student} - {self.timestamp}"