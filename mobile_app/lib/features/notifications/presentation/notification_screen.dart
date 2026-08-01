import 'package:flutter/material.dart';
import 'package:mobile_app/features/dashboard/data/dashboard_service.dart';
import 'package:mobile_app/core/storage/storage_service.dart';


class NotificationScreen extends StatefulWidget {

  const NotificationScreen({super.key});


  @override
  State<NotificationScreen> createState() =>
      _NotificationScreenState();

}


class _NotificationScreenState extends State<NotificationScreen> {


  List<dynamic> notifications = [];

  int unreadCount = 0;

  bool isLoading = true;



  @override
void initState() {

  super.initState();

  initializeNotifications();

}


Future<void> initializeNotifications() async {

  await markAllRead();

  loadNotifications();

}

  Future<void> markAllRead() async {

    final token = await StorageService.getAccessToken();

    if (token == null) {
      return;
    }


    await DashboardService()
        .markAllNotificationsRead(token);

  }




  Future<void> loadNotifications() async {

  setState(() {
    isLoading = true;
  });

  final token = await StorageService.getAccessToken();

  if (token == null) {
    setState(() {
      isLoading = false;
    });
    return;
  }


  final result =
      await DashboardService()
          .getNotifications(token);


  if (!mounted) return;


  if(result["success"] == true){

    final data = result["data"] as Map<String,dynamic>;


    setState(() {

      unreadCount = data["unread_count"] ?? 0;

      notifications =
          List<dynamic>.from(
            data["notifications"] ?? []
          );

      isLoading = false;

    });


  } else {

    setState(() {
      isLoading = false;
    });

  }

}

  @override
  Widget build(BuildContext context) {


    return Scaffold(

      appBar: AppBar(

        title: const Text(
        "Notifications"
        ),

      ),


      body: isLoading

          ? const Center(
              child:
              CircularProgressIndicator(),
            )


          : notifications.isEmpty

              ? const Center(
                  child:
                  Text(
                    "No notifications"
                  ),
                )


              : ListView.builder(

                  itemCount:
                      notifications.length,


                  itemBuilder:
                      (context,index){


                    final item =
                        notifications[index];


                    return Card(

                      child: ListTile(

                        leading: const Icon(
                        Icons.notifications,
                        color: Colors.blue,  ),


                        title: Text(
                        item["title"]?.toString() ?? '',
                        ),

                        subtitle: Text(
                        item["message"]?.toString() ?? '',
                        ),

                      ),

                    );


                  },

                ),


    );

  }

}