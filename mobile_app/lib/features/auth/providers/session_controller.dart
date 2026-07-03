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

      return "/home";
    } catch (e) {
      // if anything fails → send to login
      return "/login";
    }
  }
}
