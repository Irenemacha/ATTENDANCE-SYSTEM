from django.contrib import admin
from .models import OTP
from .models import UserSessionState

admin.site.register(UserSessionState)

admin.site.register(OTP)

