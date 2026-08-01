
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/features/attendance/data/security_validation_service.dart';

void main() {
  group('AttendanceSecurityService', () {
    final sessionStart = DateTime(2024, 1, 1, 8, 0);
    final sessionEnd = DateTime(2024, 1, 1, 10, 0);

    test('accepts active attendance session', () {
      final valid = AttendanceSecurityService.isTimeWindowValid(
        sessionActive: true,
        sessionStartTime: sessionStart,
        sessionEndTime: sessionEnd,
      );

      expect(valid, isTrue);
    });

    test('rejects inactive attendance session', () {
      final valid = AttendanceSecurityService.isTimeWindowValid(
        sessionActive: false,
        sessionStartTime: sessionStart,
        sessionEndTime: sessionEnd,
      );

      expect(valid, isFalse);
    });

    test('student is not late within first 30 minutes', () {
      final late = AttendanceSecurityService.isLate(
        sessionStartTime: sessionStart,
        now: DateTime(2024, 1, 1, 8, 20),
      );

      expect(late, isFalse);
    });

    test('student becomes late after 30 minutes', () {
      final late = AttendanceSecurityService.isLate(
        sessionStartTime: sessionStart,
        now: DateTime(2024, 1, 1, 8, 31),
      );

      expect(late, isTrue);
    });

    test('student is late exactly at 30 minutes', () {
      final late = AttendanceSecurityService.isLate(
        sessionStartTime: sessionStart,
        now: DateTime(2024, 1, 1, 8, 30),
      );

      expect(late, isTrue);
    });

    test('active two-hour session allows check-in', () {
      final valid = AttendanceSecurityService.isTimeWindowValid(
        sessionActive: true,
        sessionStartTime: sessionStart,
        sessionEndTime: sessionEnd,
      );

      expect(valid, isTrue);
    });

    test('inactive session rejects check-in', () {
      final valid = AttendanceSecurityService.isTimeWindowValid(
        sessionActive: false,
        sessionStartTime: sessionStart,
        sessionEndTime: sessionEnd,
      );

      expect(valid, isFalse);
    });
  });
}

