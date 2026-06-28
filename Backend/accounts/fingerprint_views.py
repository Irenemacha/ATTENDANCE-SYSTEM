from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from accounts.models import UserSessionState
from accounts.models import OTP







@api_view(["POST"])
@permission_classes([IsAuthenticated])
def fingerprint_verify(request):

    state = UserSessionState.objects.filter(user=request.user).first()

    if not state:
        return Response({"error": "No session state"}, status=400)

    # increase attempts
    state.fingerprint_attempts += 1

    # SIMULATION (real fingerprint comes from Flutter later)
    success = request.data.get("success", False)

    if success:
        state.fingerprint_verified = True
        state.current_state = "FINGERPRINT_OK"
        state.save()

        return Response({"message": "Fingerprint verified"})

        

    # if failed and attempts >= 3 → OTP fallback allowed
    if state.fingerprint_attempts >= 3:
        state.current_state = "OTP_REQUIRED"
        state.save()

        return Response({
            "error": "Fingerprint failed. OTP required now"
        }, status=403)

    state.save()

    return Response({"error": "Fingerprint failed"}, status=400)
