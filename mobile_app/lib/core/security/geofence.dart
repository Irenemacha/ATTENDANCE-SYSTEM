import 'dart:math';

class Geofence {
  static const double classroomLat = -6.7924;
  static const double classroomLng = 39.2083;
  static const double allowedRadiusMeters = 100;

  static double _distance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    const R = 6371000;

    final dLat = _degToRad(lat2 - lat1);
    final dLon = _degToRad(lon2 - lon1);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_degToRad(lat1)) *
            cos(_degToRad(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);

    final c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return R * c;
  }

  static double _degToRad(double deg) => deg * (pi / 180);

  static bool isInside(double lat, double lng) {
    return isInsideWithRadius(lat, lng, radiusMeters: allowedRadiusMeters);
  }

  static bool isInsideWithRadius(double lat, double lng, {double radiusMeters = allowedRadiusMeters}) {
    final distance = _distance(lat, lng, classroomLat, classroomLng);
    return distance <= radiusMeters;
  }

  static double distanceToCenter(double lat, double lng) {
    return _distance(lat, lng, classroomLat, classroomLng);
  }
}