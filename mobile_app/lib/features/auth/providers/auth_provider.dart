import 'package:mobile_app/services/auth_service.dart';

class AuthProvider {
  final AuthService _authService = AuthService();

  Future<bool> login(String username, String password) async {
    final result = await _authService.login(username, password);
    return result['success'] == true;
  }

  Future<Map<String, dynamic>?> getMe() async {
    final result = await _authService.fetchCurrentUser();
    if (result['success'] == true) {
      return Map<String, dynamic>.from(result['user']);
    }
    return null;
  }
}
