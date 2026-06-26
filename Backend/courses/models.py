from django.db import models
from django.conf import settings

class LecturerSubject(models.Model):
    lecturer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    subject = models.ForeignKey('courses.Subject', on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.lecturer.username} -> {self.subject.name}"

class Course(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Subject(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='subjects'  # ✅ fixes reverse accessor conflict
    )
    name = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.name} ({self.course.name})"