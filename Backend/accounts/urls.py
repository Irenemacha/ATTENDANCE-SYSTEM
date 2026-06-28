from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import me
from .views import register
from .views import device_login, generate_otp, verify_otp, verify_device_otp
from .views import test


urlpatterns = [
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('me/', me, name='me'),
    path("register/", register, name='register'),
    path("device-login/", device_login, name='device_login'),
    path('generate-otp/', generate_otp, name='generate_otp'),
    path("verify-otp/", verify_otp, name='verify_otp'),
    path("verify-device-otp/", verify_device_otp, name='verify_device_otp'),
    path("test/", test, name='test'),
]