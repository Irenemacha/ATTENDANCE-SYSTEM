import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:mobile_app/core/constants/api_constants.dart';
import 'package:mobile_app/core/storage/storage_service.dart';

class AuthService {
  Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await http.post(
      _url('auth/login/'),
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
        refresh: data['refresh']?.toString() ?? '',
        user: user,
      );
      return {'success': true, 'user': user};
    }
    return {
      'success': false,
      'message': _readableMessage(data, fallback: 'Login failed'),
    };
  }

  Future<Map<String, dynamic>> fetchCurrentUser() async {
    final token = await StorageService.getAccessToken();
    if (token == null) {
      return {'success': false, 'statusCode': 401, 'message': 'Missing token'};
    }

    final response = await http.get(
      _url('auth/me/'),
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
      'message': _readableMessage(data, fallback: 'Could not load profile'),
    };
  }

  Future<void> logout() => StorageService.clearSession();

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

  Uri _url(String path) {
    final base = ApiConstants.baseUrl.endsWith('/')
        ? ApiConstants.baseUrl
        : '${ApiConstants.baseUrl}/';
    return Uri.parse('$base$path');
  }

  String _readableMessage(Map<String, dynamic> data, {required String fallback}) {
    for (final key in ['detail', 'message', 'error', 'non_field_errors']) {
      final value = data[key];
      if (value == null) continue;
      if (value is List && value.isNotEmpty) return value.first.toString();
      final text = value.toString();
      if (text.isNotEmpty) return text;
    }
    return fallback;
  }
}
