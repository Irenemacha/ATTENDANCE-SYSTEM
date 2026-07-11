import 'package:flutter/material.dart';
import 'package:mobile_app/services/auth_service.dart';

class ForgotPasswordRequest extends StatefulWidget {
  const ForgotPasswordRequest({super.key});

  @override
  State<ForgotPasswordRequest> createState() => _ForgotPasswordRequestState();
}

class _ForgotPasswordRequestState extends State<ForgotPasswordRequest> {
  final emailController = TextEditingController();
  bool isLoading = false;

  Future<void> _next() async {
    final email = emailController.text.trim();
    if (!email.contains('@')) {
      _snack('Enter a valid registered email');
      return;
    }
    setState(() => isLoading = true);
    final accepted = await AuthService().requestPasswordReset(email: email);
    if (!mounted) return;
    setState(() => isLoading = false);
    if (!accepted) {
      _snack('We could not start password verification.');
      return;
    }
    Navigator.pushNamed(context, '/forgot-password/verify', arguments: email);
  }

  void _snack(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)));

  @override
  void dispose() {
    emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Forgot Password')),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Enter your registered email',
                        style: TextStyle(fontSize: 18)),
                    const SizedBox(height: 20),
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: isLoading ? null : _next,
                      child: isLoading
                          ? const CircularProgressIndicator()
                          : const Text('Next'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}
