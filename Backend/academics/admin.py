from django.contrib import admin

from .models import Holiday, Semester


class HolidayInline(admin.TabularInline):
    model = Holiday
    extra = 0


@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ("name", "academic_year", "start_date", "end_date", "teaching_weeks", "is_current")
    list_filter = ("is_current", "academic_year")
    search_fields = ("name", "academic_year")
    inlines = [HolidayInline]


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ("name", "date", "semester")
    list_filter = ("semester",)
    search_fields = ("name",)
