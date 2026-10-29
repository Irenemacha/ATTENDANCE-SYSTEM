from django.contrib.auth.models import Group, Permission, User
from rest_framework import serializers

_UNSET = object()


def user_group_names(user):
    return list(user.groups.order_by("name").values_list("name", flat=True))


def user_role_display(user):
    groups = user_group_names(user)
    return groups[0] if groups else "not yet"


def user_department(user):
    profile = getattr(user, "staff_profile", None)
    return profile.department if profile and profile.department_id else None


def user_profile_payload(user):
    student = getattr(user, "student", None)
    if student:
        return {
            "profile_type": "student",
            "reg_number": student.reg_number,
            "full_name": student.full_name,
            "email": student.email,
            "phone_number": student.phone_number,
            "course": student.course.name if student.course_id else None,
            "course_id": student.course_id,
            "department": (
                student.course.department.name
                if student.course_id and student.course.department_id
                else None
            ),
            "department_id": (
                student.course.department_id if student.course_id else None
            ),
            "year_of_study": student.year_of_study,
        }
    department = user_department(user)
    return {
        "profile_type": "staff" if user.groups.exists() else "not yet",
        "department": department.name if department else None,
        "department_id": department.id if department else None,
    }


class UserMeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    groups = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "groups",
            "role_display",
            "is_staff",
            "is_superuser",
            "profile",
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_groups(self, obj):
        return user_group_names(obj)

    def get_role_display(self, obj):
        return user_role_display(obj)

    def get_profile(self, obj):
        return user_profile_payload(obj)


class UserListSerializer(UserMeSerializer):
    pass


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    groups = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        default=list,
    )
    department_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )
    reg_number = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )
    course_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )
    year_of_study = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_superuser",
            "groups",
            "department_id",
            "reg_number",
            "course_id",
            "year_of_study",
        ]
        read_only_fields = ["id"]

    def validate_groups(self, value):
        missing = [name for name in value if not Group.objects.filter(name=name).exists()]
        if missing:
            raise serializers.ValidationError(f"Unknown groups: {', '.join(missing)}")
        return value

    def validate_department_id(self, value):
        if value in (None, ""):
            return None
        from courses.models import Department

        if not Department.objects.filter(id=value).exists():
            raise serializers.ValidationError("Unknown department.")
        return value

    def validate_course_id(self, value):
        if value in (None, ""):
            return None
        from courses.models import Course

        if not Course.objects.filter(id=value).exists():
            raise serializers.ValidationError("Unknown course.")
        return value

    def _sync_student_profile(
        self, user, reg_number, course_id, year_of_study, full_name, email
    ):
        from courses.models import Course
        from students.models import Student

        if not (reg_number and course_id and year_of_study):
            return
        course = Course.objects.filter(id=course_id).first()
        if not course:
            return
        Student.objects.update_or_create(
            user=user,
            defaults={
                "reg_number": reg_number,
                "full_name": full_name or user.get_full_name() or user.username,
                "email": email or user.email,
                "course": course,
                "year_of_study": year_of_study,
            },
        )

    def _sync_department(self, user, department_id):
        if department_id is _UNSET:
            return
        from .models import StaffProfile

        if department_id in (None, ""):
            StaffProfile.objects.filter(user=user).update(department=None)
            return
        StaffProfile.objects.update_or_create(
            user=user, defaults={"department_id": department_id}
        )

    def create(self, validated_data):
        group_names = validated_data.pop("groups", [])
        password = validated_data.pop("password", None)
        department_id = validated_data.pop("department_id", None)
        reg_number = validated_data.pop("reg_number", "")
        course_id = validated_data.pop("course_id", None)
        year_of_study = validated_data.pop("year_of_study", None)

        if not password:
            raise serializers.ValidationError(
                {"password": "This field is required."}
            )

        is_student = any(name.lower() == "student" for name in group_names)
        if is_student:
            missing = {
                field: "This field is required for Student users."
                for field, value in {
                    "reg_number": reg_number,
                    "course_id": course_id,
                    "year_of_study": year_of_study,
                }.items()
                if not value
            }
            if missing:
                raise serializers.ValidationError(missing)

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        user.groups.set(Group.objects.filter(name__in=group_names))
        self._sync_department(user, department_id)
        if is_student:
            self._sync_student_profile(
                user,
                reg_number,
                course_id,
                year_of_study,
                user.get_full_name(),
                user.email,
            )
        return user

    def update(self, instance, validated_data):
        group_names = validated_data.pop("groups", None)
        password = validated_data.pop("password", None)
        department_id = validated_data.pop("department_id", _UNSET)
        reg_number = validated_data.pop("reg_number", None)
        course_id = validated_data.pop("course_id", None)
        year_of_study = validated_data.pop("year_of_study", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        if group_names is not None:
            instance.groups.set(Group.objects.filter(name__in=group_names))
        self._sync_department(instance, department_id)

        is_student = instance.groups.filter(name__iexact="Student").exists()
        if is_student and (reg_number or course_id or year_of_study):
            profile = getattr(instance, "student", None)
            self._sync_student_profile(
                instance,
                reg_number or getattr(profile, "reg_number", ""),
                course_id or getattr(profile, "course_id", None),
                year_of_study or getattr(profile, "year_of_study", None),
                instance.get_full_name(),
                instance.email,
            )
        return instance


class GroupSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        required=False,
    )

    class Meta:
        model = Group
        fields = ["id", "name", "permissions"]


class PermissionSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source="content_type.app_label", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)

    class Meta:
        model = Permission
        fields = ["id", "name", "codename", "app_label", "model"]
