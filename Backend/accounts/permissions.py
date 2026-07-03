from rest_framework.permissions import BasePermission


def has_group(user, group_name):
    return (
        user
        and user.is_authenticated
        and user.groups.filter(name__iexact=group_name).exists()
    )


def is_staff_or_superuser(user):
    return user and user.is_authenticated and (user.is_staff or user.is_superuser)


class HasGroupPermission(BasePermission):
    group_name = None

    def has_permission(self, request, view):
        return is_staff_or_superuser(request.user) or has_group(
            request.user,
            self.group_name,
        )


class IsStudent(HasGroupPermission):
    group_name = "Student"


class IsLecturer(HasGroupPermission):
    group_name = "Lecturer"


class IsAdminOrStaff(BasePermission):
    def has_permission(self, request, view):
        return is_staff_or_superuser(request.user)


class IsHOD(HasGroupPermission):
    group_name = "HOD"


class IsAdmin(IsAdminOrStaff):
    pass
