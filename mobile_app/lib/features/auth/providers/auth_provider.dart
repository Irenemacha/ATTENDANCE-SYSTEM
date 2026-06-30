import 'dart:convert';
import 'package:http/http.dart' as http;

import '../../../core/constants/api_constants.dart';
import '../../../core/storage/storage_service.dart';

class AuthProvider {
  // =========================
  // LOGIN
  // =========================
  Future<bool> login(String regNo, String password) async {
    try {
      final response = await http.post(
        Uri.parse("${ApiConstants.baseUrl}/auth/login/"),
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonEncode({
          "username": regNo,
          "password": password,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data["access"] != null) {
        // ✅ FIXED: correct method name
        await StorageService.saveToken(data["access"]);

        return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  // =========================
  // GET USER PROFILE (/auth/me)
  // =========================
  Future<Map<String, dynamic>?> getMe() async {
    try {
      // ✅ FIXED: correct method name
      final token = await StorageService.getToken();

      if (token == null) return null;

      final response = await http.get(
        Uri.parse("${ApiConstants.baseUrl}/auth/me/"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }

      return null;
    } catch (e) {
      return null;
    }
  }
}
