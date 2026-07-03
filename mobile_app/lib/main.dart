import 'package:flutter/material.dart';
import 'package:mobile_app/core/storage/storage_service.dart';
import 'package:mobile_app/features/attendance/presentation/screens/fingerprint_screen.dart';
import 'package:mobile_app/features/auth/presentation/screens/login_screen.dart';
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
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF25D366),
          primary: const Color(0xFF075E54),
        ),
        scaffoldBackgroundColor: const Color(0xFFF2F5F3),
        useMaterial3: true,
      ),
      home: const _StartupGate(),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const MainShellScreen(),
        '/fingerprint': (context) {
          final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
          return FingerprintScreen(sessionId: args['session_id'] as int);
        },
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
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snapshot.data == null ? const LoginScreen() : const MainShellScreen();
      },
    );
  }
}
