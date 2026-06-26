
from django.contrib import admin
from .models import Student


class StudentAdmin(admin.ModelAdmin):
    list_display = (
        'reg_number',
        'full_name',
        'email',
        'phone_number',
        'course',
        'year_of_study'
    )

    search_fields = ('reg_number', 'full_name', 'email')
    list_filter = ('course', 'year_of_study')


admin.site.register(Student, StudentAdmin)
