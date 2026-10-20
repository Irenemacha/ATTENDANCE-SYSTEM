from datetime import date, datetime

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdminOrStaff

from .models import Holiday, Semester


def parse_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value in (None, ""):
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def holiday_to_dict(holiday):
    return {
        "id": holiday.id,
        "name": holiday.name,
        "date": holiday.date.isoformat(),
    }


def semester_to_dict(semester):
    return {
        "id": semester.id,
        "name": semester.name,
        "academic_year": semester.academic_year,
        "start_date": semester.start_date.isoformat(),
        "end_date": semester.end_date.isoformat(),
        "teaching_weeks": semester.teaching_weeks,
        "is_current": semester.is_current,
        "holidays": [holiday_to_dict(item) for item in semester.holidays.all()],
    }


def validate_semester(data, instance=None):
    errors = []
    cleaned = {}

    name = str(data.get("name", instance.name if instance else "") or "").strip()
    academic_year = str(
        data.get("academic_year", instance.academic_year if instance else "") or ""
    ).strip()

    if not name:
        errors.append("name is required.")
    if not academic_year:
        errors.append("academic_year is required.")

    start_date = parse_date(data.get("start_date", instance.start_date if instance else None))
    end_date = parse_date(data.get("end_date", instance.end_date if instance else None))

    if not start_date:
        errors.append("start_date must be a valid date (YYYY-MM-DD).")
    if not end_date:
        errors.append("end_date must be a valid date (YYYY-MM-DD).")
    if start_date and end_date and end_date < start_date:
        errors.append("end_date must be on or after start_date.")

    teaching_weeks = data.get(
        "teaching_weeks", instance.teaching_weeks if instance else 0
    )
    try:
        teaching_weeks = int(teaching_weeks)
        if teaching_weeks < 0:
            errors.append("teaching_weeks cannot be negative.")
    except (TypeError, ValueError):
        errors.append("teaching_weeks must be a whole number.")

    holidays = data.get("holidays")
    parsed_holidays = None
    if holidays is not None:
        if not isinstance(holidays, list):
            errors.append("holidays must be a list of {name, date} objects.")
        else:
            parsed_holidays = []
            for index, item in enumerate(holidays, start=1):
                if not isinstance(item, dict):
                    errors.append(f"holiday #{index} must be an object with name and date.")
                    continue
                holiday_name = str(item.get("name", "") or "").strip()
                holiday_date = parse_date(item.get("date"))
                if not holiday_name:
                    errors.append(f"holiday #{index} is missing a name.")
                if not holiday_date:
                    errors.append(f"holiday #{index} has an invalid date (YYYY-MM-DD).")
                if holiday_name and holiday_date:
                    parsed_holidays.append({"name": holiday_name, "date": holiday_date})

    if errors:
        return errors, None

    cleaned = {
        "name": name,
        "academic_year": academic_year,
        "start_date": start_date,
        "end_date": end_date,
        "teaching_weeks": teaching_weeks,
    }
    if parsed_holidays is not None:
        cleaned["holidays"] = parsed_holidays
    return errors, cleaned


def apply_current_flag(semester):
    if semester.is_current:
        Semester.objects.exclude(id=semester.id).filter(is_current=True).update(
            is_current=False
        )


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def semester_list_create(request):
    if request.method == "GET":
        semesters = Semester.objects.prefetch_related("holidays").all()
        return Response([semester_to_dict(semester) for semester in semesters])

    errors, cleaned = validate_semester(request.data)
    if errors:
        return Response({"errors": [{"row": None, "errors": errors}]}, status=status.HTTP_400_BAD_REQUEST)

    holidays = cleaned.pop("holidays", [])
    with transaction.atomic():
        semester = Semester.objects.create(
            is_current=bool(request.data.get("is_current", False)),
            **cleaned,
        )
        for holiday in holidays:
            Holiday.objects.create(semester=semester, **holiday)
        apply_current_flag(semester)

    return Response(semester_to_dict(semester), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAdminOrStaff])
def semester_detail(request, pk):
    semester = Semester.objects.prefetch_related("holidays").filter(id=pk).first()
    if not semester:
        return Response({"detail": "Semester not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(semester_to_dict(semester))

    if request.method == "PATCH":
        errors, cleaned = validate_semester(request.data, instance=semester)
        if errors:
            return Response({"errors": [{"row": None, "errors": errors}]}, status=status.HTTP_400_BAD_REQUEST)

        holidays = cleaned.pop("holidays", None)
        with transaction.atomic():
            for field, value in cleaned.items():
                setattr(semester, field, value)
            if "is_current" in request.data:
                semester.is_current = bool(request.data.get("is_current"))
            semester.save()

            if holidays is not None:
                semester.holidays.all().delete()
                for holiday in holidays:
                    Holiday.objects.create(semester=semester, **holiday)

            apply_current_flag(semester)

        return Response(semester_to_dict(semester))

    semester.delete()
    return Response({"message": "Semester deleted"}, status=status.HTTP_200_OK)
