import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart' as geo;

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
  // ============================================================
  // DEMO SECURITY VALUES
  // ============================================================

  static const String demoWifiSsid = 'ARUSOPASUANET';
  static const String demoBeaconId = 'Beacon 1C';

  // ============================================================
  // TIME WINDOW
  // ============================================================

  static bool isTimeWindowValid({
    required DateTime? sessionStartTime,
    required DateTime? sessionEndTime,
    required bool sessionActive,
    required bool canCheckOut,
  }) {
    // Checkout remains allowed after lecturer ends session
    // when backend says checkout is still permitted.
    if (canCheckOut) {
      return true;
    }

    // Check-in requires active session.
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
    required bool canCheckOut,
    DateTime? now,
  }) {
    // Lecturer ended session but student can still check out.
    if (canCheckOut) {
      return 'Checkout period is open.';
    }

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

  // ============================================================
  // MAIN SECURITY EVALUATION
  // ============================================================

  static Future<AttendanceSecuritySnapshot> evaluate({
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
    bool gpsValid = false;
    String gpsMessage = 'Checking GPS…';

    double latitude = 0;
    double longitude = 0;
    double distanceMeters = 0;

    try {
      // ========================================================
      // 1. CHECK LOCATION SERVICE
      // ========================================================

if (!kIsWeb) {
  final locationEnabled =
      await geo.Geolocator.isLocationServiceEnabled();

  if (!locationEnabled) {
    return _failedSnapshot(
      gpsMessage: 'GPS is disabled.',
      latitude: latitude,
      longitude: longitude,
      distanceMeters: 0,
      radiusMeters: radiusMeters,
      sessionEnded: sessionEnded,
      canCheckOut: canCheckOut,
    );
  }
}

      // ========================================================
      // 2. CHECK LOCATION PERMISSION
      // ========================================================

      if (!kIsWeb) {
        var permission =
            await geo.Geolocator.checkPermission();

        if (permission == geo.LocationPermission.denied) {
          permission =
              await geo.Geolocator.requestPermission();
        }

        if (permission ==
            geo.LocationPermission.deniedForever) {
          return _failedSnapshot(
            gpsMessage:
                'Location permission permanently denied.',
            latitude: latitude,
            longitude: longitude,
            distanceMeters: 0,
            radiusMeters: radiusMeters,
            sessionEnded: sessionEnded,
            canCheckOut: canCheckOut,
          );
        }

        if (permission == geo.LocationPermission.denied) {
          return _failedSnapshot(
            gpsMessage: 'Location permission denied.',
            latitude: latitude,
            longitude: longitude,
            distanceMeters: 0,
            radiusMeters: radiusMeters,
            sessionEnded: sessionEnded,
            canCheckOut: canCheckOut,
          );
        }
      }

      // ========================================================
      // 3. GET ACTUAL PHONE GPS
      // ========================================================

      final position =
          await geo.Geolocator.getCurrentPosition(
        locationSettings: const geo.LocationSettings(
          accuracy: geo.LocationAccuracy.high,
          distanceFilter: 0,
        ),
      );

      print(
        'PHONE GPS: '
        '${position.latitude}, '
        '${position.longitude}',
      );

      print(
        'GPS ACCURACY: '
        '${position.accuracy} m',
      );

      

      // ========================================================
      // 4. ACCEPT GPS POSITION
      // ========================================================

        latitude = position.latitude;
        longitude = position.longitude;

        gpsValid = true;
        gpsMessage =
              'GPS location obtained '
              '(accuracy: ${position.accuracy.toStringAsFixed(1)} m)';

        print(
          'ACCEPTED PHONE GPS: '
          '$latitude, $longitude '
          'ACCURACY: ${position.accuracy}m',
       );
      // ========================================================
      // 6. VALIDATE SESSION COORDINATES
      // ========================================================

      if (sessionLatitude == null ||
          sessionLongitude == null) {
        print(
          'ERROR: Session classroom coordinates are null',
        );

        return _failedSnapshot(
          gpsMessage:
              'Session classroom coordinates are unavailable.',
          latitude: latitude,
          longitude: longitude,
          distanceMeters: 0,
          radiusMeters: radiusMeters,
          sessionEnded: sessionEnded,
          canCheckOut: canCheckOut,
        );
      }

      final classroomLatitude = sessionLatitude;
      final classroomLongitude = sessionLongitude;

      print(
        'SESSION CLASSROOM: '
        '$classroomLatitude, '
        '$classroomLongitude',
      );

      print(
        'SESSION RADIUS: '
        '$radiusMeters m',
      );

      // ========================================================
      // 7. CALCULATE DISTANCE ONCE
      // ========================================================

      distanceMeters = Geofence.distanceToCenter(
        latitude,
        longitude,
        centerLat: classroomLatitude,
        centerLng: classroomLongitude,
      );

      print(
        'REAL DISTANCE: '
        '${distanceMeters.toStringAsFixed(2)} meters',
      );

      // ========================================================
      // 8. GEOFENCE CHECK
      // ========================================================

      final geofenceValid =
          Geofence.isInsideWithRadius(
        latitude,
        longitude,
        centerLat: classroomLatitude,
        centerLng: classroomLongitude,
        radiusMeters: radiusMeters,
      );

      final geofenceMessage = geofenceValid
          ? 'Inside geofence boundary.'
          : 'Outside geofence boundary.';

      print(
        'GEOFENCE VALID: '
        '$geofenceValid',
      );

      // ========================================================
      // 9. STOP IF OUTSIDE GEOFENCE
      // ========================================================

      if (!geofenceValid) {
        return _failedSnapshot(
          gpsMessage: gpsMessage,
          geofenceValid: false,
          geofenceMessage: geofenceMessage,
          latitude: latitude,
          longitude: longitude,
          distanceMeters: distanceMeters,
          radiusMeters: radiusMeters,
          sessionEnded: sessionEnded,
          canCheckOut: canCheckOut,
        );
      }

      // ========================================================
      // 10. DEMO WIFI + BLE
      // ========================================================

      final securityContextValid =
          sessionActive || canCheckOut;

      final wifiStatus =
          securityContextValid
              ? 'Trusted'
              : 'Pending';

      final wifiLabel =
          securityContextValid
              ? 'SSID: $demoWifiSsid (Detected)'
              : 'SSID: $demoWifiSsid';

      final bleDetected = securityContextValid;

      final bleStatus =
          securityContextValid
              ? 'Beacon detected: $demoBeaconId'
              : 'No beacon detected';

      // ========================================================
      // 11. TIME WINDOW
      // ========================================================

      final timeWindowValid =
          isTimeWindowValid(
        sessionStartTime: sessionStartTime,
        sessionEndTime: sessionEndTime,
        sessionActive: sessionActive,
        canCheckOut: canCheckOut,
      );

      final timeWindowMessage =
          describeTimeWindow(
        sessionStartTime: sessionStartTime,
        sessionEndTime: sessionEndTime,
        sessionActive: sessionActive,
        canCheckOut: canCheckOut,
      );

      // ========================================================
      // 12. FINAL SECURITY SNAPSHOT
      // ========================================================

      return AttendanceSecuritySnapshot(
        gpsValid: gpsValid,
        gpsMessage: gpsMessage,

        geofenceValid: geofenceValid,
        geofenceMessage: geofenceMessage,

        latitude: latitude,
        longitude: longitude,

        distanceMeters: distanceMeters,
        radiusMeters: radiusMeters,

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

        sessionEnded: sessionEnded,
        canCheckOut: canCheckOut,
      );
    } catch (e) {
      print('GPS ERROR: $e');

      return _failedSnapshot(
        gpsMessage: 'GPS error: $e',
        latitude: latitude,
        longitude: longitude,
        distanceMeters: 0,
        radiusMeters: radiusMeters,
        sessionEnded: sessionEnded,
        canCheckOut: canCheckOut,
      );
    }
  }

  // ============================================================
  // FAILED SNAPSHOT
  // ============================================================

  static AttendanceSecuritySnapshot _failedSnapshot({
    required String gpsMessage,
    required double latitude,
    required double longitude,
    required double distanceMeters,
    required double radiusMeters,
    bool geofenceValid = false,
    String geofenceMessage =
        'Geofence check is pending.',
    bool sessionEnded = false,
    bool canCheckOut = false,
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

      sessionEnded: sessionEnded,
      canCheckOut: canCheckOut,
    );
  }

  // ============================================================
  // FINGERPRINT
  // ============================================================

  Future<Map<String, dynamic>> verifyFingerprint({
    required bool success,
  }) async {
    return AttendanceService().verifyFingerprint(
      success: success,
    );
  }

  // ============================================================
  // OTP
  // ============================================================

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

