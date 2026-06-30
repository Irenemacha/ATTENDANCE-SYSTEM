import 'token_storage.dart';

class AuthGuard {
  static Future<String> getInitialRoute() async {
    final token = await TokenStorage.getAccessToken();

    if (token != null) {
      return "/home";
    } else {
      return "/login";
    }
  }
}