import 'package:flutter/material.dart';

class AttendanceHistoryScreen extends StatelessWidget {
  const AttendanceHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [

          const Text(
            'Attendance Summary',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 16),

          Card(
            child: ListTile(
              title: const Text('Overall Attendance'),
              trailing: const Text(
                '82%',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),

          const SizedBox(height: 20),

          const Text(
            'Subject Performance',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),

          Card(
            child: Column(
              children: const [

                ListTile(
                  title: Text('Computer Networks'),
                  trailing: Text('90%'),
                ),

                ListTile(
                  title: Text('Database Systems'),
                  trailing: Text('75%'),
                ),

                ListTile(
                  title: Text('Software Engineering'),
                  trailing: Text('60%'),
                ),

              ],
            ),
          ),

          const SizedBox(height: 20),

          const Text(
            'Recent Attendance',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),

          Card(
            child: Column(
              children: const [

                ListTile(
                  title: Text('Computer Networks'),
                  subtitle: Text('03 Aug 2026'),
                  trailing: Text(
                    'Present',
                    style: TextStyle(
                      color: Colors.green,
                    ),
                  ),
                ),

                ListTile(
                  title: Text('Database Systems'),
                  subtitle: Text('01 Aug 2026'),
                  trailing: Text(
                    'Late',
                    style: TextStyle(
                      color: Colors.orange,
                    ),
                  ),
                ),

              ],
            ),
          ),
        ],
      ),
    );
  }
}