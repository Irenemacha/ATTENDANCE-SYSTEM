class AuthResponse {
  final String access;

  AuthResponse({required this.access});

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      access: json['access'],
    );
  }
}