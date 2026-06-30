import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io';

class DeviceId {
  static final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  static Future<String> getDeviceId() async {
    if (Platform.isAndroid) {
      final android = await _deviceInfo.androidInfo;
      return android.id; // clean (no ?? needed)
    }

    if (Platform.isIOS) {
      final ios = await _deviceInfo.iosInfo;
      return ios.identifierForVendor ?? "unknown_ios";
    }

    return "unsupported_device";
  }
}