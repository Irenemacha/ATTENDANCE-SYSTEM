import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:mobile_app/features/attendance/data/attendance_service.dart';

class FingerprintScreen extends StatefulWidget {
  final int sessionId;

  const FingerprintScreen({
    super.key,
    required this.sessionId,
  });

  @override
  State<FingerprintScreen> createState() => _FingerprintScreenState();
}

class _FingerprintScreenState extends State<FingerprintScreen> {
  final LocalAuthentication _localAuth = LocalAuthentication();
  final AttendanceService _attendanceService = AttendanceService();
  bool _isLoading = false;

  Future<void> _verifyAndMarkAttendance() async {
    setState(() => _isLoading = true);

    try {
      final canAuthenticate = await _localAuth.canCheckBiometrics ||
          await _localAuth.isDeviceSupported();

      if (!canAuthenticate) {
        throw Exception("Biometric authentication is not available");
      }

      final authenticated = await _localAuth.authenticate(
        localizedReason: "Verify fingerprint to complete attendance",
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );

      final fingerprintResult = await _attendanceService.verifyFingerprint(
        success: authenticated,
      );

      if (!authenticated || fingerprintResult["success"] != true) {
        final data = Map<String, dynamic>.from(fingerprintResult["data"]);
        throw Exception(data["message"] ?? "Fingerprint verification failed");
      }

      final markResult = await _attendanceService.markAttendance(
        sessionId: widget.sessionId,
      );

      if (!mounted) return;

      if (markResult["success"] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Attendance marked successfully")),
        );
        Navigator.pushReplacementNamed(context, "/home");
      } else {
        final data = Map<String, dynamic>.from(markResult["data"]);
        throw Exception(data["error"] ?? data["detail"] ?? "Attendance failed");
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst("Exception: ", ""))),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    print("I AM USING IDENTITY CARD");
    return Scaffold(
      appBar: AppBar(title: const Text("Fingerprint")),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.fingerprint, size: 96),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _isLoading ? null : _verifyAndMarkAttendance,
                icon: const Icon(Icons.verified_user),
                label: _isLoading
                    ? const Text("Verifying...")
                    : const Text("Verify Fingerprint"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
