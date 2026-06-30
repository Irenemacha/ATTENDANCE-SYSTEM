import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:mobile_app/core/constants/api_constants.dart';

class DashboardService {
  final String baseUrl = ApiConstants.baseUrl;

  Future<Map<String, dynamic>> getDashboardData(String token) async {
    final url = Uri.parse("$baseUrl/auth/me/");

    final response = await http.get(
      url,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
    );

    if (response.statusCode == 200) {
      return {
        "success": true,
        "data": jsonDecode(response.body),
      };
    } else {
      return {
        "success": false,
        "message": "Failed to load dashboard"
      };
    }
  }
}
