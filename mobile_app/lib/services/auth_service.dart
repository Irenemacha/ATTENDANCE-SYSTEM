import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:mobile_app/core/constants/api_constants.dart';
import 'package:mobile_app/core/storage/storage_service.dart';

class AuthService {
  Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await http.post(
      Uri.parse('${ApiConstants.baseUrl}/auth/login/'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'username': username,
        'password': password,
      }),
    );
    final data = _decodeBody(response.body);
    if (response.statusCode == 200 && data['access'] != null) {
      final user = Map<String, dynamic>.from(data['user'] ?? {});
      await StorageService.saveAuthSession(
        access: data['access'] as String,
        refresh: data['refresh'] as String,
        user: user,
      );
      return {'success': true, ...data};
    }
    return {
      'success': false,
      'message': data['detail'] ?? data['message'] ?? 'Login failed',
    };
  }

  Future<Map<String, dynamic>> fetchCurrentUser() async {
    final token = await StorageService.getAccessToken();
    if (token == null) {
      return {'success': false, 'statusCode': 401, 'message': 'Missing token'};
    }

    final response = await http.get(
      Uri.parse('${ApiConstants.baseUrl}/auth/me/'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );
    final data = _decodeBody(response.body);
    if (response.statusCode == 200) {
      await StorageService.saveUser(data);
      return {'success': true, 'user': data};
    }
    if (response.statusCode == 401) {
      await StorageService.clearSession();
    }
    return {
      'success': false,
      'statusCode': response.statusCode,
      'message': data['detail'] ?? 'Could not load profile',
    };
  }

  Future<void> logout() => StorageService.clearSession();

  Future<Map<String, dynamic>> verifyDeviceOtp(
    String username,
    String otp, {
    String? deviceId,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiConstants.baseUrl}/auth/verify-device-otp/'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'username': username,
        'otp': otp,
        if (deviceId != null) 'device_id': deviceId,
      }),
    );
    final data = _decodeBody(response.body);
    if (response.statusCode == 200 && data['access'] != null) {
      await StorageService.saveAuthSession(
        access: data['access'] as String,
        refresh: data['refresh'] as String,
        user: Map<String, dynamic>.from(data['user'] ?? {}),
      );
    }
    return {
      'success': response.statusCode == 200,
      'data': data,
    };
  }

  Future<bool> verifyOtp({
    required String username,
    required String otp,
    required String deviceId,
  }) async {
    final result = await verifyDeviceOtp(username, otp, deviceId: deviceId);
    return result['success'] == true;
  }

  Future<bool> requestPasswordReset({required String email}) async {
    return email.contains('@');
  }

  Future<bool> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    return token.isNotEmpty && newPassword.length >= 6;
  }

  Map<String, dynamic> _decodeBody(String body) {
    if (body.isEmpty) return {};
    final decoded = jsonDecode(body);
    return decoded is Map<String, dynamic> ? decoded : {'data': decoded};
  }
}
