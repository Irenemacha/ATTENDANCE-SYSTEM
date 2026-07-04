import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:mobile_app/core/constants/api_constants.dart';
import 'package:mobile_app/core/storage/storage_service.dart';

class AttendanceService {
  Future<Map<String, dynamic>> checkIn({
    required int sessionId,
    required double latitude,
    required double longitude,
  }) async {
    final token = await StorageService.getToken();
    final response = await http.post(
      Uri.parse("${ApiConstants.baseUrl}attendance/check-in/"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
      body: jsonEncode({
        "session_id": sessionId,
        "latitude": latitude,
        "longitude": longitude,
      }),
    );

    final body = jsonDecode(response.body);
    return {
      "success": response.statusCode >= 200 && response.statusCode < 300,
      "statusCode": response.statusCode,
      "data": body,
    };
  }

  Future<Map<String, dynamic>> verifyFingerprint({
    required bool success,
  }) async {
    final token = await StorageService.getToken();
    final response = await http.post(
      Uri.parse("${ApiConstants.baseUrl}auth/fingerprint/verify/"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
      body: jsonEncode({"success": success}),
    );

    final body = jsonDecode(response.body);
    return {
      "success": response.statusCode >= 200 && response.statusCode < 300,
      "statusCode": response.statusCode,
      "data": body,
    };
  }

  Future<Map<String, dynamic>> checkOut({required int sessionId}) async {
    final token = await StorageService.getToken();
    final response = await http.post(
      Uri.parse("${ApiConstants.baseUrl}attendance/check-out/"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
      body: jsonEncode({"session_id": sessionId}),
    );

    final body = jsonDecode(response.body);
    return {
      "success": response.statusCode >= 200 && response.statusCode < 300,
      "statusCode": response.statusCode,
      "data": body,
    };
  }

  Future<Map<String, dynamic>> markAttendance({required int sessionId}) async {
    final token = await StorageService.getToken();
    final response = await http.post(
      Uri.parse("${ApiConstants.baseUrl}attendance/mark/"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
      body: jsonEncode({"session_id": sessionId}),
    );

    final body = jsonDecode(response.body);
    return {
      "success": response.statusCode >= 200 && response.statusCode < 300,
      "statusCode": response.statusCode,
      "data": body,
    };
  }
}
