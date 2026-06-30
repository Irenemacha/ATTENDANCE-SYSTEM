import 'dart:async';

class AuthService {
  // simulate storage (in real app this should be SharedPreferences or secure storage)
  String? _token;

  /// Delete stored token (logout simulation)
  Future<void> deleteToken() async {
    _token = null;
  }

  /// OTP verification (mock logic for now)
  Future<bool> verifyOtp({
    required String username,
    required String otp,
    required String deviceId,
  }) async {
    await Future.delayed(const Duration(milliseconds: 500));

    // mock rule (replace with API later)
    if (otp == "123456") {
      _token = "mock_token_$username";
      return true;
    }
    return false;
  }

  /// Request password reset (mock validation)
  Future<bool> requestPasswordReset({
    required String email,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));

    return email.contains("@");
  }

  /// Reset password (mock validation)
  Future<bool> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));

    return token.isNotEmpty && newPassword.length >= 6;
  }

  /// Logout helper (important for your HomeScreen error)
  Future<void> logout() async {
    await deleteToken();
  }
}