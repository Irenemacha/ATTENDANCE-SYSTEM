from django.contrib import admin
from .models import Course, Subject, LecturerSubject

admin.site.register(Course)
admin.site.register(Subject)
admin.site.register(LecturerSubject)