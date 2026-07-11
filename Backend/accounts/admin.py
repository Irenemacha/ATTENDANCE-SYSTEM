from django.contrib import admin

from accounts.models import OTP, UserDevice, UserSessionState


@admin.register(UserDevice)
class UserDeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "device_id", "is_verified", "created_at")
    search_fields = ("user__username", "device_id")
    list_filter = ("is_verified", "created_at")


@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ("user", "purpose", "is_used", "created_at", "expires_at")
    search_fields = ("user__username", "purpose")
    list_filter = ("purpose", "is_used", "created_at")


@admin.register(UserSessionState)
class UserSessionStateAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "current_state",
        "device_verified",
        "geofence_verified",
        "fingerprint_verified",
        "otp_verified",
        "updated_at",
    )
    search_fields = ("user__username",)
    list_filter = ("current_state", "device_verified", "geofence_verified", "otp_verified")
    