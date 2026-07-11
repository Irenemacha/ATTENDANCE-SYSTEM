from django.db import models
from django.conf import settings
from courses.models import Course


class Student(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student"
    )

    reg_number = models.CharField(max_length=50, unique=True)
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone_number = models.CharField(max_length=20, blank=True, null=True)

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE
    )

    year_of_study = models.IntegerField()

    def __str__(self):
        return f"{self.reg_number} - {self.full_name}"
    
class Notification(models.Model):
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE
    )

    title = models.CharField(max_length=200)
    message = models.TextField()

    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title