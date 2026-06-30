import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _accessKey = "access_token";
  static const String _refreshKey = "refresh_token";
  static const String _sessionKey = "session_active";

  // SAVE TOKENS
  static Future<void> saveTokens({
    required String access,
    required String refresh,
  }) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  // GET ACCESS TOKEN
  static Future<String?> getAccessToken() async {
    return await _storage.read(key: _accessKey);
  }

  // GET REFRESH TOKEN
  static Future<String?> getRefreshToken() async {
    return await _storage.read(key: _refreshKey);
  }

  // SESSION ACTIVE
  static Future<void> setSessionActive(bool value) async {
    await _storage.write(
      key: _sessionKey,
      value: value ? "true" : "false",
    );
  }

  static Future<bool> isSessionActive() async {
    final value = await _storage.read(key: _sessionKey);
    return value == "true";
  }

  // CLEAR ALL
  static Future<void> clear() async {
    await _storage.deleteAll();
  }
}