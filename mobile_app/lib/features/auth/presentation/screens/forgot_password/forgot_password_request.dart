import 'package:flutter/material.dart';

class ForgotPasswordRequest extends StatefulWidget {
  const ForgotPasswordRequest({super.key});

  @override
  State<ForgotPasswordRequest> createState() => _ForgotPasswordRequestState();
}

class _ForgotPasswordRequestState extends State<ForgotPasswordRequest> {
  final emailController = TextEditingController();

  bool isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          TextField(
            controller: emailController,
            decoration: const InputDecoration(labelText: "Email"),
          ),

          ElevatedButton(
            onPressed: () async {
              setState(() => isLoading = true);

              final email = emailController.text.trim();

              if (email.isEmpty) {
                setState(() => isLoading = false);
                return;
              }

              setState(() => isLoading = false);
            },
            child: const Text("Send OTP"),
          ),
        ],
      ),
    );
  }
}