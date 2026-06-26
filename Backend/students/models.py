from django.db import models
from courses.models import Course

class Student(models.Model):
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
