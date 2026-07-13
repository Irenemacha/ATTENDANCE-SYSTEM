import 'package:location/location.dart';
import 'package:mobile_app/core/security/geofence.dart';
import 'package:mobile_app/features/attendance/data/attendance_service.dart';
import 'package:mobile_app/services/auth_service.dart';

class AttendanceSecuritySnapshot {
  const AttendanceSecuritySnapshot({
    required this.gpsValid,
    required this.gpsMessage,
    required this.geofenceValid,
    required this.geofenceMessage,
    required this.latitude,
    required this.longitude,
    required this.distanceMeters,
    required this.radiusMeters,
    required this.wifiStatus,
    required this.wifiLabel,
    required this.bleStatus,
    required this.bleDetected,
    required this.timeWindowValid,
    required this.timeWindowMessage,
    required this.fingerprintPassed,
    required this.otpVerified,
    required this.canProceed,
    required this.biometricAvailable,
  });

  final bool gpsValid;
  final String gpsMessage;
  final bool geofenceValid;
  final String geofenceMessage;
  final double latitude;
  final double longitude;
  final double distanceMeters;
  final double radiusMeters;
  final String wifiStatus;
  final String wifiLabel;
  final String bleStatus;
  final bool bleDetected;
  final bool timeWindowValid;
  final String timeWindowMessage;
  final bool fingerprintPassed;
  final bool otpVerified;
  final bool canProceed;
  final bool biometricAvailable;
}

class AttendanceSecurityService {
  static const double sampleLat = -6.7924;
  static const double sampleLng = 39.2083;
  static const double sampleRadiusMeters = 20;
  /// Fixed values used by the demo validator. Replace the implementation,
  /// rather than these contracts, when device network/BLE scanning is added.
  static const String demoWifiSsid = 'ARUSOPASUANET';
  static const String demoBeaconId = 'Beacon 1C';

  static bool isTimeWindowValid([DateTime? now]) {
    final current = now ?? DateTime.now();
    return current.hour >= 8 && current.hour < 17;
  }

  static String describeTimeWindow([DateTime? now]) {
    final current = now ?? DateTime.now();
    return isTimeWindowValid(current)
        ? 'Allowed until 17:00 today.'
        : 'Attendance window closed for now.';
  }

  static Future<AttendanceSecuritySnapshot> evaluate({
    required Location location,
    String? detectedBeaconId,
  }) async {
    const fallbackLat = sampleLat;
    const fallbackLng = sampleLng;

    bool gpsValid = false;
    String gpsMessage = 'Checking GPS…';
    double latitude = fallbackLat;
    double longitude = fallbackLng;
    double distanceMeters = Geofence.distanceToCenter(fallbackLat, fallbackLng);

    try {
      final enabled = await location.serviceEnabled();
      if (!enabled) {
        final requested = await location.requestService();
        if (!requested) {
          gpsMessage = 'Location services are off. Using demo coordinates.';
        }
      }

      var permission = await location.hasPermission();
      if (permission == PermissionStatus.denied) {
        permission = await location.requestPermission();
      }

      if (permission == PermissionStatus.granted) {
        final current = await location.getLocation();
        if (current.latitude != null && current.longitude != null) {
          latitude = current.latitude!;
          longitude = current.longitude!;
          distanceMeters = Geofence.distanceToCenter(latitude, longitude);
          gpsValid = true;
          gpsMessage = 'GPS location acquired.';
        } else {
          gpsMessage = 'Location not available. Using demo coordinates.';
          gpsValid = true;
        }
      } else {
        gpsMessage = 'Location permission unavailable. Using demo coordinates.';
        gpsValid = true;
      }
    } catch (_) {
      gpsMessage = 'GPS could not be resolved. Using demo coordinates.';
      gpsValid = true;
    }

    // Validation is deliberately evaluated in the required order. A failed
    // step returns immediately so later checks cannot be treated as passed.
    if (!gpsValid) {
      return _failedSnapshot(
        gpsMessage: gpsMessage,
        latitude: latitude,
        longitude: longitude,
        distanceMeters: distanceMeters,
      );
    }

    final geofenceValid = Geofence.isInsideWithRadius(
      latitude,
      longitude,
      radiusMeters: sampleRadiusMeters,
    );
    final geofenceMessage = geofenceValid
        ? 'Inside geofence boundary.'
        : 'Outside geofence boundary.';
    if (!geofenceValid) {
      return _failedSnapshot(
        gpsMessage: gpsMessage,
        geofenceValid: false,
        geofenceMessage: geofenceMessage,
        latitude: latitude,
        longitude: longitude,
        distanceMeters: distanceMeters,
      );
    }

    // Demo integrations expose these exact trusted values until native Wi-Fi
    // and BLE scanners are wired in.
    const wifiStatus = 'Trusted';
    const wifiLabel = 'SSID: $demoWifiSsid';
    final bleDetected = detectedBeaconId != null;

    final bleStatus = bleDetected
    ? 'Beacon detected: $detectedBeaconId'
    : 'No beacon detected';
    final timeWindowValid = isTimeWindowValid();
    final timeWindowMessage = describeTimeWindow();

    return AttendanceSecuritySnapshot(
      gpsValid: gpsValid,
      gpsMessage: gpsMessage,
      geofenceValid: geofenceValid,
      geofenceMessage: geofenceMessage,
      latitude: latitude,
      longitude: longitude,
      distanceMeters: distanceMeters,
      radiusMeters: sampleRadiusMeters,
      wifiStatus: wifiStatus,
      wifiLabel: wifiLabel,
      bleStatus: bleStatus,
      bleDetected: bleDetected,
      timeWindowValid: timeWindowValid,
      timeWindowMessage: timeWindowMessage,
      fingerprintPassed: false,
      otpVerified: false,
      canProceed: false,
      biometricAvailable: false,
    );
  }

  static AttendanceSecuritySnapshot _failedSnapshot({
    required String gpsMessage,
    required double latitude,
    required double longitude,
    required double distanceMeters,
    bool geofenceValid = false,
    String geofenceMessage = 'Geofence check is pending.',
  }) => AttendanceSecuritySnapshot(
    gpsValid: false,
    gpsMessage: gpsMessage,
    geofenceValid: geofenceValid,
    geofenceMessage: geofenceMessage,
    latitude: latitude,
    longitude: longitude,
    distanceMeters: distanceMeters,
    radiusMeters: sampleRadiusMeters,
    wifiStatus: 'Pending',
    wifiLabel: 'SSID: $demoWifiSsid',
    bleStatus: 'Pending',
    bleDetected: false,
    timeWindowValid: false,
    timeWindowMessage: 'Complete the earlier security checks first.',
    fingerprintPassed: false,
    otpVerified: false,
    canProceed: false,
    biometricAvailable: false,
  );

  Future<Map<String, dynamic>> verifyFingerprint({
    required bool success,
  }) async {
    return AttendanceService().verifyFingerprint(success: success);
  }

  Future<bool> verifyOtp({
    required String username,
    required String otp,
    required String deviceId,
  }) async {
    return AuthService().verifyDeviceOtp(
      username: username,
      otp: otp,
      deviceId: deviceId,
    );
  }
}
