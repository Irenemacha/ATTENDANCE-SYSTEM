from accounts.models import UserSessionState


def get_or_create_state(user):
    state, _ = UserSessionState.objects.get_or_create(user=user)
    return state


def advance_user_state(user, event):
    state = get_or_create_state(user)

    if event == "device_success":
        state.device_verified = True
        state.current_state = "DEVICE_VERIFIED"

    elif event == "geofence_success":
        state.geofence_verified = True
        state.current_state = "GEOFENCE_PASSED"

    elif event == "fingerprint_fail":
        state.fingerprint_attempts += 1

        if state.fingerprint_attempts >= 3:
            state.current_state = "OTP_REQUIRED"
        else:
            state.current_state = "FINGERPRINT_REQUIRED"

    elif event == "fingerprint_success":
        state.fingerprint_verified = True
        state.current_state = "ATTENDANCE_GRANTED"

    elif event == "otp_success":
        state.otp_verified = True
        state.current_state = "ATTENDANCE_GRANTED"

    elif event == "attendance_success":
        state.current_state = "ATTENDANCE_GRANTED"

    state.save()
    return state

def can_mark_attendance(state):

    if not state.device_verified:
        return False, "Device not verified"

    if not state.geofence_verified:
        return False, "Outside allowed area"

    if not state.fingerprint_verified and not state.otp_verified:
        return False, "Fingerprint or OTP required"

    if state.current_state != "ATTENDANCE_GRANTED":
        return False, "Not ready for attendance"

    return True, "ACCESS GRANTED"

def evaluate_state(state):

    # 🚪 STEP 1: DEVICE
    if not state.device_verified:
        return False, "Device not verified"

    # 🚪 STEP 2: GEOFENCE
    if not state.geofence_verified:
        return False, "Outside classroom area"

    # 🚪 STEP 3: BIOMETRIC LAYER
    if not state.fingerprint_verified and not state.otp_verified:
        return False, "Fingerprint or OTP required"

    # 🚪 STEP 4: FINAL STATE CHECK
    if state.current_state != "READY_FOR_ATTENDANCE":
        return False, "Not ready for attendance"

    return True, "ACCESS GRANTED"

def sync_state(state):
    """
    kuhakikisha hakuna cheating ya state
    """

    if state.fingerprint_verified:
        state.current_state = "READY_FOR_ATTENDANCE"

    if state.otp_verified:
        state.current_state = "READY_FOR_ATTENDANCE"

    state.save()