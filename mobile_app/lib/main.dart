import 'package:flutter/material.dart';
import 'package:mobile_app/core/storage/storage_service.dart';
import 'package:mobile_app/features/attendance/presentation/screens/fingerprint_scan_screen.dart';
import 'package:mobile_app/features/attendance/presentation/screens/otp_fallback_screen.dart';
import 'package:mobile_app/features/auth/presentation/screens/forgot_password/forgot_password_request.dart';
import 'package:mobile_app/features/auth/presentation/screens/forgot_password/forgot_password_verify_screen.dart';
import 'package:mobile_app/features/auth/presentation/screens/landing_screen.dart';
import 'package:mobile_app/features/auth/presentation/screens/login_screen.dart';
import 'package:mobile_app/features/auth/presentation/screens/otp_verification_screen.dart';
import 'package:mobile_app/features/dashboard/presentation/screens/main_shell_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'GeoAttend',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          primary: const Color(0xFF1D4ED8),
          secondary: const Color(0xFF0F172A),
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: const _StartupGate(),
      routes: {
        '/landing': (context) => const LandingScreen(),
        '/login': (context) => const LoginScreen(),
        '/forgot-password': (context) => const ForgotPasswordRequest(),
        '/forgot-password/verify': (context) => const ForgotPasswordVerifyScreen(),
        '/otp': (context) => const OtpVerificationScreen(),
        '/home': (context) => const MainShellScreen(),
        '/fingerprint-scan': (context) => const FingerprintScanScreen(),
        '/otp-fallback': (context) => const OtpFallbackScreen(),
      },
    );
  }
}

class _StartupGate extends StatelessWidget {
  const _StartupGate();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String?>(
      future: StorageService.getAccessToken(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return snapshot.data == null
            ? const LandingScreen()
            : const MainShellScreen();
      },
    );
  }
}
