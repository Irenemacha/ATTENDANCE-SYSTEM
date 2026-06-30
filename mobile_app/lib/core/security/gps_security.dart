import 'package:location/location.dart';

class GpsSecurity {
  static final Location _location = Location();

  // Check if GPS is enabled
  static Future<bool> isGpsEnabled() async {
    return await _location.serviceEnabled();
  }

  // Check permission
  static Future<bool> hasPermission() async {
    final permission = await _location.hasPermission();
    return permission == PermissionStatus.granted;
  }

  // Detect mock location (Android only)
  static Future<bool> isMockLocation() async {
    final locationData = await _location.getLocation();

    // Simple heuristic (Flutter limitation)
    if (locationData.isMock == true) {
      return true;
    }

    return false;
  }
}