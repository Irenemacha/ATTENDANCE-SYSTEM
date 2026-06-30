import 'package:flutter/material.dart';
import 'package:mobile_app/core/security/token_storage.dart';

class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key});

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    await Future.delayed(const Duration(seconds: 2));

    final token = await TokenStorage.getAccessToken();
    final session = await TokenStorage.isSessionActive();

    if (!mounted) return;

    if (token != null && session == true) {
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, "/home");
    } else {
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, "/login");
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}