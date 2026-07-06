import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_app/core/security/device_id.dart';
import 'package:mobile_app/core/storage/storage_service.dart';
import 'package:mobile_app/services/auth_service.dart';

class OtpFallbackScreen extends StatefulWidget {
  const OtpFallbackScreen({super.key});

  @override
  State<OtpFallbackScreen> createState() => _OtpFallbackScreenState();
}

class _OtpFallbackScreenState extends State<OtpFallbackScreen> {
  static const String _demoOtp = '123456';
  final List<TextEditingController> _controllers = List.generate(
    6,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  bool isLoading = false;

  String get _otp => _controllers.map((controller) => controller.text).join();

  Future<String?> _username() async {
    final user = await StorageService.getUser();
    return (user?['username'] ?? user?['email'])?.toString();
  }

  Future<void> _verifyOtp() async {
    final otp = _otp.trim();
    if (otp.length != 6) {
      _snack('Enter the 6-digit OTP');
      return;
    }

    setState(() => isLoading = true);
    try {
      final username = await _username();
      if (!mounted) return;
      if (username == null || username.isEmpty) {
        _snack('Could not resolve account for OTP verification');
        return;
      }

      final deviceId = await DeviceId.getDeviceId();
      var success = await AuthService().verifyAttendanceOtp(
        username: username,
        otp: otp,
        deviceId: deviceId,
      );

      if (!success && !kReleaseMode && otp == _demoOtp) {
        success = true;
      }

      if (!mounted) return;
      if (success) {
        Navigator.pushReplacementNamed(
          context,
          '/home',
          arguments: {'otpVerified': true, 'fingerprintAttempts': 3},
        );
      } else {
        _snack('Invalid or expired OTP');
      }
    } catch (error) {
      if (mounted) _snack('OTP error: $error');
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _goBack() {
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
    } else {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final focusNode in _focusNodes) {
      focusNode.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: _goBack),
        title: const Text('OTP Fallback'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(
                        Icons.lock_outline,
                        size: 48,
                        color: Color(0xFF2563EB),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Secure OTP Verification',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Enter the 6-digit code to complete authentication.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Color(0xFF64748B)),
                      ),
                      if (!kReleaseMode) ...[
                        const SizedBox(height: 16),
                        Text(
                          'Demo OTP: $_demoOtp',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
                      const SizedBox(height: 24),
                      Row(
                        children: List.generate(6, (index) {
                          return Expanded(
                            child: Padding(
                              padding: EdgeInsets.only(
                                right: index == 5 ? 0 : 8,
                              ),
                              child: TextField(
                                controller: _controllers[index],
                                focusNode: _focusNodes[index],
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                maxLength: 1,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                decoration: const InputDecoration(
                                  counterText: '',
                                  border: OutlineInputBorder(),
                                ),
                                onChanged: (value) {
                                  if (value.isNotEmpty && index < 5) {
                                    _focusNodes[index + 1].requestFocus();
                                  }
                                  if (value.isEmpty && index > 0) {
                                    _focusNodes[index - 1].requestFocus();
                                  }
                                },
                              ),
                            ),
                          );
                        }),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: isLoading
                              ? null
                              : () => _snack(
                                  'Use the latest OTP generated by the server.',
                                ),
                          child: const Text('Resend Code'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: isLoading ? null : _verifyOtp,
                        child: isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text('Verify OTP'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
