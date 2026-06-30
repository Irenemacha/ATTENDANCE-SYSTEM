import 'auth_provider.dart';

class SessionController {
  final AuthProvider _authProvider = AuthProvider();

  /// This function decides where the user should go after app launch
  Future<String> resolveUserRoute() async {
    try {
      // 🔐 CALL BACKEND (/auth/me)
      final user = await _authProvider.getMe();

      // ❌ No user found → go login
      if (user == null) {
        return "/login";
      }

      // 📊 Read user state from backend
      final String state = user["state"] ?? "UNKNOWN";

      // 🧠 ROUTING LOGIC (BASED ON YOUR SYSTEM DESIGN)

      if (state == "REGISTERED") {
        // logged in but not fully activated (or first stage)
        return "/home";
      }

      if (state == "OTP_PENDING") {
        // must verify device/email OTP
        return "/otp";
      }

      if (state == "DEVICE_NOT_BOUND") {
        // new device detected → OTP required
        return "/otp";
      }

      if (state == "ACTIVE") {
        // fully verified user
        return "/home";
      }

      // 🚨 fallback safety
      return "/login";
    } catch (e) {
      // if anything fails → send to login
      return "/login";
    }
  }
}