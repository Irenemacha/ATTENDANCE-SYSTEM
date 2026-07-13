import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:mobile_app/features/attendance/data/attendance_service.dart';

class FingerprintScanScreen extends StatefulWidget {
  const FingerprintScanScreen({super.key});

  @override
  State<FingerprintScanScreen> createState() => _FingerprintScanScreenState();
}

class _FingerprintScanScreenState extends State<FingerprintScanScreen> {
  @override
  void initState() {
  super.initState();
  print("🔥 FINGERPRINT SCREEN CREATED");
  }
  final LocalAuthentication _localAuth = LocalAuthentication();
  final AttendanceService _attendanceService = AttendanceService();

  int fingerprintAttempts = 0;
  bool isLoading = false;
  bool isBiometricallyVerified = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final attempts = args?['fingerprintAttempts'];
    if (attempts is int && fingerprintAttempts == 0) {
      fingerprintAttempts = attempts.clamp(0, 3).toInt();
    }
  }

  Future<void> _scanFingerprint() async {
    if (fingerprintAttempts >= 3) {
      _openOtpFallback();
      return;
    }

    setState(() => isLoading = true);

    try {
      final supported = await _localAuth.isDeviceSupported();
      if (!supported) {
        await _handleFailure(
          'Biometric authentication is not available on this device',
        );
        return;
      }

      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Verify fingerprint to continue attendance',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );

      final result = await _attendanceService.verifyFingerprint(
        success: authenticated,
      );
      if (!mounted) return;

      if (authenticated && result['success'] == true) {
        setState(() => isBiometricallyVerified = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Identity Verified Successfully')),
        );
        await Future<void>.delayed(const Duration(milliseconds: 450));
        if (!mounted) return;
        if (Navigator.canPop(context)) {
          Navigator.pop(context, true);
        } else {
          Navigator.pushReplacementNamed(context, '/home');
        }
        return;
      }

      final data = Map<String, dynamic>.from(result['data'] ?? {});
      await _handleFailure(
        data['message'] ?? data['error'] ?? 'Fingerprint verification failed',
      );
    } on MissingPluginException {
      await _handleFailure(
        'Biometric plugin is not ready. Fully restart the app and try again',
      );
    } on PlatformException catch (error) {
      await _handleFailure(error.message ?? 'Fingerprint verification failed');
    } catch (error) {
      await _handleFailure(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _handleFailure(Object message) async {
    if (!mounted) return;
    final nextAttempts = fingerprintAttempts + 1;
    setState(() => fingerprintAttempts = nextAttempts);

    if (nextAttempts >= 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fingerprint failed 3 times. Use OTP.')),
      );
      await Future<void>.delayed(const Duration(milliseconds: 350));
      if (mounted) _openOtpFallback();
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$message. Attempt $nextAttempts of 3.')),
    );
  }

  void _openOtpFallback() {
    Navigator.pushReplacementNamed(
      context,
      '/otp-fallback',
      arguments: {'fingerprintAttempts': fingerprintAttempts},
    );
  }

  void _goBack() {
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
    } else {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: _goBack),
        title: const Text('Fingerprint Scan'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const _StatusCard(
              icon: Icons.location_on_outlined,
              title: 'GPS',
              value: 'Inside Geofence confirmed',
              color: Color(0xFF16A34A),
            ),
            const SizedBox(height: 12),
            const _StatusCard(
              icon: Icons.wifi_outlined,
              title: 'WiFi',
              value: 'Campus network confirmed',
              color: Color(0xFF16A34A),
            ),
            const SizedBox(height: 12),
            _StatusCard(
              icon: Icons.fingerprint,
              title: 'Biometrics',
              value: isBiometricallyVerified
                  ? 'Verified'
                  : fingerprintAttempts == 0
                  ? 'Fingerprint pending'
                  : 'Attempt $fingerprintAttempts of 3 failed',
              color: isBiometricallyVerified
                  ? const Color(0xFF16A34A)
                  : const Color(0xFFF59E0B),
            ),
            const SizedBox(height: 28),
            Center(
              child: SizedBox(
                width: 156,
                height: 156,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: const CircleBorder(),
                  ),
                  onPressed: isLoading ? null : _scanFingerprint,
                  child: isLoading
                      ? const SizedBox(
                          width: 34,
                          height: 34,
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.fingerprint, size: 76),
                ),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Place your finger on the scanner to verify your identity before attendance actions are enabled.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: color.withValues(alpha: 0.12),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(value, style: const TextStyle(color: Color(0xFF64748B))),
                ],
              ),
            ),
            Icon(Icons.check_circle, color: color),
          ],
        ),
      ),
    );
  }
}
