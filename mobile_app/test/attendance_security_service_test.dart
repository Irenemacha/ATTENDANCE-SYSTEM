import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/features/attendance/data/security_validation_service.dart';

void main() {
  group('AttendanceSecurityService', () {
    test('accepts a normal attendance window', () {
      final valid = AttendanceSecurityService.isTimeWindowValid(
        DateTime(2024, 1, 1, 10, 0),
      );
      expect(valid, isTrue);
    });

    test('rejects an expired attendance window', () {
      final valid = AttendanceSecurityService.isTimeWindowValid(
        DateTime(2024, 1, 1, 18, 0),
      );
      expect(valid, isFalse);
    });
  });
}
