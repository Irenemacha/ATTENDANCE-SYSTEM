from django.db import models
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model



from courses.models import Course, Subject


# =========================
# 1. ATTENDANCE SESSION
# =========================
class AttendanceSession(models.Model):
    User = get_user_model()
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE
    )

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


# =========================
# 2. ATTENDANCE (STUDENT CHECK-IN)
# =========================
class Attendance(models.Model):

    STATUS_CHOICES = [
        ("PRESENT", "Present"),
        ("LATE", "Late"),
        ("ABSENT", "Absent"),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'}
    )

    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.CASCADE,
        null=True,
        blank=True
)

    check_in_time = models.DateTimeField(auto_now_add=True)
    check_out_time = models.DateTimeField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PRESENT"
    )

    def __str__(self):
        return f"{self.student.username} - {self.session}"
    



