import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:mobile_app/core/constants/api_constants.dart';
import 'package:mobile_app/core/security/token_storage.dart';

class ApiClient {
  static final String _baseUrl = ApiConstants.baseUrl;

  // GET REQUEST
  static Future<http.Response> get(String endpoint) async {
    final token = await TokenStorage.getAccessToken();

    final response = await http.get(
      Uri.parse(_url(endpoint)),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
    );

    return response;
  }

  // POST REQUEST
  static Future<http.Response> post(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    final token = await TokenStorage.getAccessToken();

    final response = await http.post(
      Uri.parse(_url(endpoint)),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
      body: jsonEncode(body),
    );

    return response;
  }

  static String _url(String endpoint) {
    final path = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return "$_baseUrl$path";
  }
}
