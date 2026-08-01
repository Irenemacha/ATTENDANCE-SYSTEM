import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:mobile_app/core/constants/api_constants.dart';

class NotificationService {

  Future<Map<String,dynamic>> getNotifications(String token) async {

    final url = Uri.parse(
      "${ApiConstants.baseUrl}students/notifications/"
    );


    final response = await http.get(
      url,
      headers:{
        "Authorization":"Bearer $token",
        "Content-Type":"application/json",
      }
    );


    if(response.statusCode == 200){

      return jsonDecode(response.body);

    }


    return {
      "unread_count":0,
      "notifications":[]
    };

  }



  Future<void> markAsRead(
      String token,
      int notificationId
  ) async {

    final url = Uri.parse(
      "${ApiConstants.baseUrl}students/notifications/$notificationId/read/"
    );


    await http.patch(
      url,
      headers:{
        "Authorization":"Bearer $token",
        "Content-Type":"application/json",
      },
    );

  }

}