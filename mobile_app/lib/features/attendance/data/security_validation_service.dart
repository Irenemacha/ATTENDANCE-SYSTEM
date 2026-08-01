import 'package:location/location.dart';
import 'package:mobile_app/core/security/geofence.dart';
import 'package:mobile_app/features/attendance/data/attendance_service.dart';
import 'package:mobile_app/services/auth_service.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart' as geo;

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
    required this.sessionEnded,
    required this.canCheckOut,
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
  final bool sessionEnded;
  final bool canCheckOut;
}

class AttendanceSecurityService {
  static const double sampleLat = -6.7924;
  static const double sampleLng = 39.2083;
  static const double sampleRadiusMeters = 20;
  /// Fixed values used by the demo validator. Replace the implementation,
  /// rather than these contracts, when device network/BLE scanning is added.
  static const String demoWifiSsid = 'ARUSOPASUANET';
  static const String demoBeaconId = 'Beacon 1C';

  static bool isTimeWindowValid({
  required DateTime? sessionStartTime,
  required DateTime? sessionEndTime,
  required bool sessionActive,
}) {
  // The backend only exposes an attendance session to students
  // when the lecturer's session is currently active.
  return sessionActive;
}

static bool isLate({
  required DateTime? sessionStartTime,
  DateTime? now,
}) {
  if (sessionStartTime == null) {
    return false;
  }

  final current = now ?? DateTime.now();

  final lateTime = sessionStartTime.add(
    const Duration(minutes: 30),
  );

    return !current.isBefore(lateTime);
}

  static String describeTimeWindow({
    required DateTime? sessionStartTime,
    required DateTime? sessionEndTime,
    required bool sessionActive,
    DateTime? now,
  }) {
    if (!sessionActive) {
      return 'Attendance session is not active.';
    }

    if (sessionStartTime == null || sessionEndTime == null) {
      return 'Session time unavailable.';
    }

    final current = now ?? DateTime.now();

    if (current.isBefore(sessionStartTime)) {
      return 'Attendance has not started yet.';
    }

    if (!current.isBefore(sessionEndTime)) {
      return 'Attendance window closed.';
    }

    final lateTime = sessionStartTime.add(
      const Duration(minutes: 30),
    );

    if (current.isBefore(lateTime)) {
      return 'On-time check-in allowed.';
    }

    return 'Late check-in allowed.';
  }

  static Future<AttendanceSecuritySnapshot> evaluate({
  required Location location,
  required bool sessionActive,
  required bool sessionEnded,
  required bool canCheckOut,
  String? detectedBeaconId,
  required double radiusMeters,
  required double? sessionLatitude,
  required double? sessionLongitude,
  required DateTime? sessionStartTime,
  required DateTime? sessionEndTime,
}) async {
  const fallbackLat = sampleLat;
  const fallbackLng = sampleLng;

  bool gpsValid = false;
  String gpsMessage = 'Checking GPS…';

  double latitude = fallbackLat;
  double longitude = fallbackLng;

  double distanceMeters = 0;

try {
  final enabled = await geo.Geolocator.isLocationServiceEnabled();

if (!enabled) {
  return _failedSnapshot(
    gpsMessage: 'GPS is disabled',
    latitude: latitude,
    longitude: longitude,
    distanceMeters: distanceMeters,
    radiusMeters: radiusMeters,
  );
}

  if (!kIsWeb) {
  geo.LocationPermission permission =
      await geo.Geolocator.checkPermission();

  if (permission == geo.LocationPermission.denied) {
    permission = await geo.Geolocator.requestPermission();
  }

  if (permission == geo.LocationPermission.deniedForever) {
    return _failedSnapshot(
      gpsMessage: 'Location permission permanently denied',
      latitude: latitude,
      longitude: longitude,
      distanceMeters: distanceMeters,
      radiusMeters: radiusMeters,
    );
  }
}

  final position = await geo.Geolocator.getCurrentPosition(
  locationSettings: const geo.LocationSettings(
    accuracy: geo.LocationAccuracy.high,
  ),
);

  latitude = position.latitude;
  longitude = position.longitude;

  print('PHONE GPS: $latitude, $longitude');

  // The lecturer's active session must provide
  // the classroom coordinates.
  if (sessionLatitude == null || sessionLongitude == null) {
    print('ERROR: Session classroom coordinates are null');

    return _failedSnapshot(
      gpsMessage: 'Session classroom coordinates are unavailable.',
      latitude: latitude,
      longitude: longitude,
      distanceMeters: 0,
      radiusMeters: radiusMeters,
    );
  }

  final double classroomLatitude = sessionLatitude;
  final double classroomLongitude = sessionLongitude;

  print(
    'SESSION CLASSROOM: '
    '$classroomLatitude, $classroomLongitude',
  );

  print('SESSION RADIUS: $radiusMeters');

  // REAL DISTANCE FROM PHONE TO SELECTED CLASSROOM
  distanceMeters = Geofence.distanceToCenter(
    latitude,
    longitude,
    centerLat: classroomLatitude,
    centerLng: classroomLongitude,
  );

  print('REAL DISTANCE: $distanceMeters meters');

  gpsValid = true;
  gpsMessage = 'GPS location obtained';
} catch (e) {
  gpsMessage = 'GPS error: $e';

  print('GPS ERROR: $e');
}






// GPS MUST PASS FIRST
if (!gpsValid) {
  return _failedSnapshot(
    gpsMessage: gpsMessage,
    latitude: latitude,
    longitude: longitude,
    distanceMeters: distanceMeters,
    radiusMeters: radiusMeters,
  );
}


// SESSION COORDINATES ARE ALREADY VALIDATED ABOVE
final double classroomLatitude = sessionLatitude!;
final double classroomLongitude = sessionLongitude!;


// GEOFENCE CHECK
final geofenceValid = Geofence.isInsideWithRadius(
  latitude,
  longitude,
  centerLat: classroomLatitude,
  centerLng: classroomLongitude,
  radiusMeters: radiusMeters,
);

final geofenceMessage = geofenceValid
    ? 'Inside geofence boundary.'
    : 'Outside geofence boundary.';


// Stop if outside classroom
if (!geofenceValid) {
  return _failedSnapshot(
    gpsMessage: gpsMessage,
    geofenceValid: false,
    geofenceMessage: geofenceMessage,
    latitude: latitude,
    longitude: longitude,
    distanceMeters: distanceMeters,
    radiusMeters: radiusMeters,
  );
}





  // ============================
  // DEMO WIFI AND BLE STATUS
  // ============================


  final wifiStatus =
      sessionActive
      ? 'Trusted'
      : 'Pending';


  final wifiLabel =
      sessionActive
      ? 'SSID: $demoWifiSsid (Detected)'
      : 'SSID: $demoWifiSsid';



  final bleDetected =
      sessionActive;


  final bleStatus =
      sessionActive
      ? 'Beacon detected: $demoBeaconId'
      : 'No beacon detected';



  final timeWindowValid = isTimeWindowValid(
  sessionStartTime: sessionStartTime,
  sessionEndTime: sessionEndTime,
  sessionActive: sessionActive,
);

  final timeWindowMessage = describeTimeWindow(
  sessionStartTime: sessionStartTime,
  sessionEndTime: sessionEndTime,
  sessionActive: sessionActive,
);

    return AttendanceSecuritySnapshot(
    gpsValid: gpsValid,
    gpsMessage: gpsMessage,

    geofenceValid: geofenceValid,
    geofenceMessage: geofenceMessage,

    latitude: latitude,
    longitude: longitude,

    distanceMeters: distanceMeters,
    radiusMeters: radiusMeters,

   // DEMO WIFI
    wifiStatus: wifiStatus,
    wifiLabel: wifiLabel,

    // DEMO BLE
    bleStatus: bleStatus,
    bleDetected: bleDetected,

    timeWindowValid: timeWindowValid,
    timeWindowMessage: timeWindowMessage,

    fingerprintPassed: false,
    otpVerified: false,

    canProceed: false,
    biometricAvailable: false,

    sessionEnded: sessionEnded,
    canCheckOut: canCheckOut,
  );
}

static AttendanceSecuritySnapshot _failedSnapshot({
  required String gpsMessage,
  required double latitude,
  required double longitude,
  required double distanceMeters,
  required double radiusMeters,
  bool geofenceValid = false,
  String geofenceMessage = 'Geofence check is pending.',
}) {
  return AttendanceSecuritySnapshot(
    gpsValid: false,
    gpsMessage: gpsMessage,

    geofenceValid: geofenceValid,
    geofenceMessage: geofenceMessage,

    latitude: latitude,
    longitude: longitude,

    distanceMeters: distanceMeters,
    radiusMeters: radiusMeters,

    // Demo mode: do not allow security layers before GPS/geofence pass
    wifiStatus: 'Pending',
    wifiLabel: 'SSID: $demoWifiSsid',

    bleStatus: 'Pending',
    bleDetected: false,

    timeWindowValid: false,
    timeWindowMessage:
        'Complete the earlier security checks first.',

    fingerprintPassed: false,
    otpVerified: false,

    canProceed: false,
    biometricAvailable: false,

    sessionEnded: false,
    canCheckOut: false,
    
  );
}
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
