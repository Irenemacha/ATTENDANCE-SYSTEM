from django.contrib import admin
from .models import Course, Subject, LecturerAssignment

admin.site.register(Course)
admin.site.register(Subject)
admin.site.register(LecturerAssignment)