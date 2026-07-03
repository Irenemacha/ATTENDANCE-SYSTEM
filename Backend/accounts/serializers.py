from django.contrib.auth.models import Group, Permission, User
from rest_framework import serializers


def user_group_names(user):
    return list(user.groups.order_by("name").values_list("name", flat=True))


def user_role_display(user):
    groups = user_group_names(user)
    return groups[0] if groups else "not yet"


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
            "year_of_study": student.year_of_study,
        }
    return {"profile_type": "not yet"}


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
        ]
        read_only_fields = ["id"]

    def validate_groups(self, value):
        missing = [name for name in value if not Group.objects.filter(name=name).exists()]
        if missing:
            raise serializers.ValidationError(f"Unknown groups: {', '.join(missing)}")
        return value

    def create(self, validated_data):
        group_names = validated_data.pop("groups", [])
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        user.set_password(password or User.objects.make_random_password())
        user.save()
        user.groups.set(Group.objects.filter(name__in=group_names))
        return user

    def update(self, instance, validated_data):
        group_names = validated_data.pop("groups", None)
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        if group_names is not None:
            instance.groups.set(Group.objects.filter(name__in=group_names))
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
