from django.db import models


class Semester(models.Model):
    name = models.CharField(max_length=100)
    academic_year = models.CharField(max_length=20)
    start_date = models.DateField()
    end_date = models.DateField()
    teaching_weeks = models.PositiveIntegerField(default=0)
    is_current = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "name"]

    def __str__(self):
        return f"{self.name} ({self.academic_year})"


class Holiday(models.Model):
    semester = models.ForeignKey(
        Semester,
        on_delete=models.CASCADE,
        related_name="holidays",
    )
    name = models.CharField(max_length=150)
    date = models.DateField()

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.name} ({self.date})"
