import 'package:flutter/material.dart';

import 'package:mobile_app/features/auth/presentation/screens/login_screen.dart';
import 'package:mobile_app/features/auth/presentation/screens/otp_screen.dart';
import 'package:mobile_app/features/attendance/presentation/screens/fingerprint_screen.dart';
import 'package:mobile_app/features/dashboard/presentation/screens/dashboard_screen.dart';


void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,

      // START HERE
      initialRoute: "/login",

      routes: {
        "/login": (context) => const LoginScreen(),
        "/otp": (context) => const OtpScreen(),
        "/home": (context) => const DashboardScreen(),
        "/fingerprint": (context) {
          final args =
              ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
          return FingerprintScreen(sessionId: args["session_id"] as int);
        },
      },
    );
  }
}
