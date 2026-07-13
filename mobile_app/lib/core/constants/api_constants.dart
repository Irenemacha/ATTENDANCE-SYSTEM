class ApiConstants {
  static const String mode = "dev"; // dev | emulator | prod

  static String get baseUrl {
    switch (mode) {
      case "dev":
        return "http://72.20.10.2:8000/api/";
      case "emulator":
        return "http://10.0.2.2:8000/api/";
      case "prod":
        return "https://attendance.schoolsoft.online/api/";
      default:
        return "http://72.20.10.2:8000/api/";
    }
  }
}