import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';

class DeviceId {
  static final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  static Future<String> getDeviceId() async {
    if (kIsWeb) {
      return 'web_device';
    }

    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        final android = await _deviceInfo.androidInfo;
        return android.id;
      }

      if (defaultTargetPlatform == TargetPlatform.iOS) {
        final ios = await _deviceInfo.iosInfo;
        return ios.identifierForVendor ?? 'unknown_ios';
      }
    } catch (_) {
      // Fall back to a safe placeholder when device info is unavailable.
    }

    return 'unsupported_device';
  }
}