from django.db import models
from django.conf import settings
user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
from django.contrib.auth import get_user_model
User = get_user_model()


# ========================
# DEPARTMENT MODELS
# ========================
class Department(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


# ========================
# COURSE MODEL
# ========================
class Course(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ========================
# SUBJECT MODEL
# ========================
class Subject(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="subjects")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20)

    def __str__(self):
        return f"{self.name} ({self.course.name})"
    

class LecturerSubject(models.Model):
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'lecturer'})
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('lecturer', 'subject')


# ========================
# LECTURER ASSIGNMENT
# ========================
class LecturerAssignment(models.Model):
    lecturer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.lecturer.username} -> {self.subject.name}"


# ========================
# ENROLLMENT (STUDENTS)
# ========================
class Enrollment(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.student.username} enrolled in {self.subject.name}"
    

class LecturerCourse(models.Model):
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    course = models.ForeignKey(
        'Course',
        on_delete=models.CASCADE
    )

    def __str__(self):
        return f"{self.lecturer.username} -> {self.course.name}"
    
class StudentCourse(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    course = models.ForeignKey(
        'Course',
        on_delete=models.CASCADE
    )

    def __str__(self):
        return f"{self.student.username} -> {self.course.name}"
    
    
class Timetable(models.Model):
    course = models.ForeignKey('Course', on_delete=models.CASCADE)

    DAYS = [
        ("MON", "Monday"),
        ("TUE", "Tuesday"),
        ("WED", "Wednesday"),
        ("THU", "Thursday"),
        ("FRI", "Friday"),
        ("SAT", "Saturday"),
        ("SUN", "Sunday"),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE)

    day = models.CharField(max_length=10, choices=DAYS)

    start_time = models.TimeField()
    end_time = models.TimeField()

    room = models.CharField(max_length=50)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.course} - {self.day} {self.start_time}"


