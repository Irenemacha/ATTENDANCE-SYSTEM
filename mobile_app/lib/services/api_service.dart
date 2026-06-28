import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = "https://attendance-backend-uy75.onrender.com";

  static Future<Map<String, dynamic>> login(
      String username, String password) async {

    final url = Uri.parse("$baseUrl/api/auth/login/");

    final response = await http.post(
      url,
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonEncode({
        "username": username,
        "password": password,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception("Login failed: ${response.body}");
    }
  }
}