import 'package:flutter/material.dart';
import 'package:mobile_app/core/security/device_id.dart';
import 'package:mobile_app/services/auth_service.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final TextEditingController otpController = TextEditingController();
  bool isLoading = false;

  Future<void> verifyOtp(String username, String otp) async {
    setState(() => isLoading = true);

    try {
      final deviceId = await DeviceId.getDeviceId();

      final success = await AuthService().verifyOtp(
        username: username,
        otp: otp,
        deviceId: deviceId,
      );

      if (!mounted) return;

      if (success) {
        Navigator.pushReplacementNamed(context, "/home");
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("OTP verification failed"),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("OTP verification failed: $e"),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final args =
        ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;

    final String username = args['username'];

    return Scaffold(
      appBar: AppBar(
        title: const Text("OTP Verification"),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text("Enter OTP sent to $username"),
            const SizedBox(height: 16),
            TextField(
              controller: otpController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: "OTP",
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: isLoading
                  ? null
                  : () => verifyOtp(
                        username,
                        otpController.text.trim(),
                      ),
              child: isLoading
                  ? const CircularProgressIndicator()
                  : const Text("Verify OTP"),
            ),
          ],
        ),
      ),
    );
  }
}