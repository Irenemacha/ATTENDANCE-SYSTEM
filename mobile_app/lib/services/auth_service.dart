import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile_app/core/constants/api_constants.dart';
import 'package:mobile_app/core/security/device_id.dart';

class AuthService {
  final String baseUrl = ApiConstants.baseUrl;

  String? _token;

  // ---------------- LOGIN ----------------
  Future<Map<String, dynamic>> login(String username, String password) async {
    final deviceId = await DeviceId.getDeviceId();
    final response = await http.post(
      Uri.parse("$baseUrl/auth/device-login/"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "username": username,
        "password": password,
        "device_id": deviceId,
      }),
    );

    final data = jsonDecode(response.body);

    if (response.statusCode == 200) {
      _token = data["access"];

      if (_token != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString("token", _token!);
      }

      return data;
    }

    return {
      "success": false,
      "message": data["detail"] ?? "Login failed"
    };
  }

  // ---------------- LOGOUT ----------------
  Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove("token");
  }

  // ---------------- VERIFY OTP ----------------
  Future<Map<String, dynamic>> verifyOtp(
    String username,
    String otp, {
    String? deviceId,
  }) async {
    final response = await http.post(
      Uri.parse("$baseUrl/auth/verify-device-otp/"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "username": username,
        "otp": otp,
        if (deviceId != null) "device_id": deviceId,
      }),
    );

    final data = jsonDecode(response.body);

    return {
      "success": response.statusCode == 200,
      "data": data,
    };
  }

  // ---------------- RESET PASSWORD ----------------
  Future<Map<String, dynamic>> resetPassword(
      String email, String password) async {
    final response = await http.post(
      Uri.parse("$baseUrl/auth/reset-password/"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "email": email,
        "password": password,
      }),
    );

    final data = jsonDecode(response.body);

    return {
      "success": response.statusCode == 200,
      "data": data,
    };
  }

  // ---------------- GET TOKEN ----------------
  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString("token");
    return _token;
  }
}
