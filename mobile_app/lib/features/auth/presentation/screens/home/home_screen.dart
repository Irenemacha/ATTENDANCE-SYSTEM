import 'package:flutter/material.dart';
import 'package:mobile_app/services/auth_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final AuthService _authService = AuthService();

  bool _loading = false;

  Future<void> logout() async {
    setState(() => _loading = true);

    try {
      await _authService.logout();

      if (!mounted) return;

      Navigator.pushReplacementNamed(context, "/login");
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Logout failed: $e")),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Home"),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _loading ? null : logout,
          ),
        ],
      ),
      body: const Center(
        child: Text(
          "Welcome Student 👋",
          style: TextStyle(fontSize: 20),
        ),
      ),
    );
  }
}