from rest_framework.permissions import BasePermission


class IsAuthenticatedUser(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        print("USER:", request.user)
        print("HAS PROFILE:", hasattr(request.user, "student_profile"))
        return (
            request.user.is_authenticated
            and hasattr(request.user, "student_profile")
        )


class IsLecturer(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            hasattr(request.user, "lecturer_profile")
        )

class IsHOD(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and hasattr(request.user, "hod_profile")
        )

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.is_staff
        )