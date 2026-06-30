from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from .services import advance_user_state
from accounts.device_service import check_device
import random
from accounts.models import UserSessionState
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer

from .models import UserDevice, OTP

User = get_user_model()

# -------------------------
# USER PROFILE
# -------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(["POST"])
def login(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(username=username, password=password)

    if user:
        refresh = RefreshToken.for_user(user)
        return Response({
            "success": True,
            "message": "Login successful",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        })

    return Response({
        "success": False,
        "message": "Invalid credentials"
    }, status=400)

# -------------------------
# REGISTER
# -------------------------
@api_view(["POST"])
def register(request):
    username = request.data.get("username")
    password = request.data.get("password")
    role = request.data.get("role")

    user = User.objects.create_user(
        username=username,
        password=password
    )

    return Response({
        "message": "User created successfully",
        "username": user.username,
        "role": role
    })


# -------------------------
# DEVICE LOGIN
# -------------------------
@api_view(["POST"])
def device_login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    device_id = request.data.get("device_id")

    user = User.objects.filter(username=username).first()

    if not user or not user.check_password(password):
        return Response({"error": "Invalid credentials"}, status=400)

    if not device_id:
        return Response({"error": "Device ID required"}, status=400)

    # check if device already verified
    device = UserDevice.objects.filter(
        user=user,
        device_id=device_id,
        is_verified=True
    ).first()

    if device:
        advance_user_state(user, "device_success")
        refresh = RefreshToken.for_user(user)
        return Response({
            "message": "Login successful (device already verified)",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "device_required": False,
        })

    # create or get device (NOT verified yet)
    device, created = UserDevice.objects.get_or_create(
        user=user,
        device_id=device_id
    )

    # generate OTP
    code = str(random.randint(100000, 999999))

    OTP.objects.create(
        user=user,
        code=code,
        purpose="device_verification",
        expires_at=timezone.now() + timedelta(minutes=5)
    )

    advance_user_state(user, "otp_sent")

    return Response({
        "message": "OTP generated and required for device verification",
        "device_required": True
    })


# -------------------------
# GENERATE OTP (TEST)
# -------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_otp(request):
    otp_code = random.randint(100000, 999999)

    OTP.objects.create(
        user=request.user,
        code=otp_code,
        purpose="device_verification",
        expires_at=timezone.now() + timedelta(minutes=5)
    )

    return Response({
        "message": "OTP generated"
    })


# -------------------------
# VERIFY OTP (DEVICE + FINGERPRINT FALLBACK SHARED)
# -------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_otp(request):
    otp_input = request.data.get("otp")
    device_id = request.data.get("device_id")
    user = request.user

    if not otp_input:
        return Response({"error": "OTP is required"}, status=400)

    otp_obj = OTP.objects.filter(user=user).order_by('-id').first()

    if not otp_obj:
        return Response({"error": "No OTP found"}, status=400)

    # check expiry
    if otp_obj.is_expired():
        otp_obj.delete()
        return Response({"error": "OTP expired"}, status=400)

    # check already used
    if otp_obj.is_used:
        return Response({"error": "OTP already used"}, status=400)

    # validate code
    if str(otp_obj.code) != str(otp_input):
        return Response({"error": "Invalid OTP"}, status=400)

    # mark OTP as used (DO NOT delete immediately)
    otp_obj.is_used = True
    otp_obj.save()

    # get or create state safely
    state, _ = UserSessionState.objects.get_or_create(user=user)

    # update state ONLY ONCE (no manual + engine conflict)
    state.otp_verified = True
    state.current_state = "ATTENDANCE_GRANTED"
    state.save()

    # device binding
    if device_id:
        UserDevice.objects.update_or_create(
            user=user,
            device_id=device_id,
            defaults={"is_verified": True}
        )

    # optional: keep engine ONLY if it matches same logic
    advance_user_state(user, "otp_success")

    return Response({
        "message": "OTP verified successfully",
        "state": state.current_state
    })

# -------------------------
# VERIFY DEVICE OTP (DEBUG VERSION CLEANED)
# -------------------------
@api_view(["POST"])
def verify_device_otp(request):
    username = request.data.get("username")
    otp_input = request.data.get("otp")
    device_id = request.data.get("device_id")

    user = User.objects.filter(username=username).first()

    if not user:
        return Response({"error": "User not found"}, status=400)

    otp_obj = OTP.objects.filter(user=user).order_by("-id").first()

    if not otp_obj:
        return Response({"error": "No OTP found"}, status=400)

    if str(otp_obj.code) != str(otp_input):
        return Response({"error": "Invalid OTP"}, status=400)

    if otp_obj.is_expired():
        otp_obj.delete()
        return Response({"error": "OTP expired"}, status=400)

    otp_obj.is_used = True
    otp_obj.save()

    if device_id:
        UserDevice.objects.update_or_create(
            user=user,
            device_id=device_id,
            defaults={"is_verified": True}
        )

    advance_user_state(user, "device_success")
    refresh = RefreshToken.for_user(user)

    return Response({
        "message": "OTP verified successfully",
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    })


# -------------------------
# TEST ENDPOINT
# -------------------------
@api_view(["GET"])
def test(request):
    print("TEST HIT")
    return Response({"message": "working"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def otp_fallback_verify(request):

    otp_input = request.data.get("otp")
    state = UserSessionState.objects.filter(user=request.user).first()

    if not state:
        return Response({"error": "No session state"}, status=400)

    # get latest OTP
    otp_obj = OTP.objects.filter(user=request.user).order_by("-id").first()

    if not otp_obj:
        return Response({"error": "No OTP found"}, status=400)

    if str(otp_obj.code) != str(otp_input):
        return Response({"error": "Invalid OTP"}, status=400)

    # mark success
    state.otp_verified = True
    state.current_state = "READY_FOR_ATTENDANCE"
    state.save()

    otp_obj.delete()

    return Response({"message": "OTP fallback verified"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def fingerprint_verify(request):
    success = request.data.get("success", True)
    state, _ = UserSessionState.objects.get_or_create(user=request.user)

    if success in [True, "true", "True", 1, "1"]:
        advance_user_state(request.user, "fingerprint_success")
        return Response({
            "message": "Fingerprint verified",
            "state": "ATTENDANCE_GRANTED",
        })

    state = advance_user_state(request.user, "fingerprint_fail")

    if state.current_state == "OTP_REQUIRED":
        OTP.objects.create(
            user=request.user,
            code=str(random.randint(100000, 999999)),
            purpose="device_verification",
            expires_at=timezone.now() + timedelta(minutes=5)
        )

    return Response({
        "message": "Fingerprint failed",
        "state": state.current_state,
        "otp_required": state.current_state == "OTP_REQUIRED",
    }, status=403)
