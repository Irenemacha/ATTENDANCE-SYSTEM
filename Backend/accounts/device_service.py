from .models import UserDevice

def check_device(user, device_id):
    device = UserDevice.objects.filter(user=user, device_id=device_id).first()

    if not device:
        return False, "NEW_DEVICE"

    if not device.is_verified:
        return False, "DEVICE_NOT_VERIFIED"

    return True, "DEVICE_OK"