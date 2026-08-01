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
      return {"success": true, "data": jsonDecode(response.body)};
    }

    return {"success": false, "message": "Failed to load dashboard"};
  }

  Future<Map<String, dynamic>> getStudentDashboard(String token) async {
  final url = Uri.parse("${baseUrl}students/dashboard/");

  print("DASHBOARD URL: $url");

  final response = await http.get(
    url,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer $token",
    },
  );

  print("DASHBOARD STATUS: ${response.statusCode}");
  print("DASHBOARD BODY: ${response.body}");

  final body = response.body.isEmpty ? {} : jsonDecode(response.body);

  return {
    "success": response.statusCode >= 200 && response.statusCode < 300,
    "statusCode": response.statusCode,
    "data": body is Map<String, dynamic> ? body : {"data": body},
  };
}

Future<Map<String, dynamic>> getNotifications(String token) async {

  final url = Uri.parse(
    "${baseUrl}students/notifications/"
  );

  print("NOTIFICATION URL: $url");

  final response = await http.get(
    url,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer $token",
    },
  );


  print("NOTIFICATION STATUS: ${response.statusCode}");
  print("NOTIFICATION BODY: ${response.body}");


  if (response.statusCode == 200) {

    final body = jsonDecode(response.body);

    return {
      "success": true,
      "data": body,
    };

  }


  return {
    "success": false,
    "message": "Failed to load notifications",
    "statusCode": response.statusCode,
  };
}


Future<Map<String, dynamic>> markAllNotificationsRead(
    String token
) async {

  final url = Uri.parse(
    "${baseUrl}students/notifications/mark-all-read/"
  );


  print("MARK ALL READ URL: $url");


  final response = await http.patch(

    url,

    headers: {

      "Content-Type": "application/json",

      "Authorization": "Bearer $token",

    },

  );


  print("MARK READ STATUS: ${response.statusCode}");
  print("MARK READ BODY: ${response.body}");


  if (response.statusCode == 200) {

    return {
      "success": true,
      "data": jsonDecode(response.body),
    };

  }


  return {
    "success": false,
    "message": "Failed to mark notifications read",
    "statusCode": response.statusCode,
  };

}
}