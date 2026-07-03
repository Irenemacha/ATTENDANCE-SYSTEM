import 'package:mobile_app/core/storage/storage_service.dart';

class TokenStorage {
  static Future<void> saveTokens({
    required String access,
    required String refresh,
  }) async {
    await StorageService.saveAuthSession(
      access: access,
      refresh: refresh,
      user: await StorageService.getUser() ?? <String, dynamic>{},
    );
  }

  static Future<String?> getAccessToken() => StorageService.getAccessToken();

  static Future<String?> getRefreshToken() => StorageService.getRefreshToken();

  static Future<void> setSessionActive(bool value) async {}

  static Future<bool> isSessionActive() async {
    return await StorageService.getAccessToken() != null;
  }

  static Future<void> clear() => StorageService.clearSession();
}
