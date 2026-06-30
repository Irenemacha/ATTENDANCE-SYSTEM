import 'package:flutter/material.dart';
import 'package:location/location.dart';
import 'package:mobile_app/features/attendance/data/attendance_service.dart';
import 'package:mobile_app/features/dashboard/data/dashboard_service.dart';
import 'package:mobile_app/core/storage/storage_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool isLoading = true;
  Map<String, dynamic>? dashboardData;
  final Location location = Location();
  final AttendanceService attendanceService = AttendanceService();

  @override
  void initState() {
    super.initState();
    fetchDashboard();
  }

  Future<void> fetchDashboard() async {
    final token = await StorageService.getToken();

    if (token == null) {
      setState(() => isLoading = false);
      return;
    }

    final service = DashboardService();
    final res = await service.getDashboardData(token);

    if (res['success'] == true) {
      setState(() {
        dashboardData = res['data'];
        isLoading = false;
      });
    } else {
      setState(() => isLoading = false);
    }
  }

  Future<void> startCheckIn() async {
    final controller = TextEditingController();
    final sessionId = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Session ID"),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: "Enter session id"),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel"),
          ),
          ElevatedButton(
            onPressed: () {
              final value = int.tryParse(controller.text.trim());
              Navigator.pop(context, value);
            },
            child: const Text("Continue"),
          ),
        ],
      ),
    );

    if (sessionId == null) return;

    try {
      var serviceEnabled = await location.serviceEnabled();
      if (!serviceEnabled) {
        serviceEnabled = await location.requestService();
      }
      if (!serviceEnabled) {
        throw Exception("Location service is disabled");
      }

      var permission = await location.hasPermission();
      if (permission == PermissionStatus.denied) {
        permission = await location.requestPermission();
      }
      if (permission != PermissionStatus.granted) {
        throw Exception("Location permission denied");
      }

      final currentLocation = await location.getLocation();
      final latitude = currentLocation.latitude;
      final longitude = currentLocation.longitude;

      if (latitude == null || longitude == null) {
        throw Exception("Could not read current GPS location");
      }

      final result = await attendanceService.checkIn(
        sessionId: sessionId,
        latitude: latitude,
        longitude: longitude,
      );

      if (!mounted) return;

      final data = Map<String, dynamic>.from(result["data"]);
      if (result["success"] == true && data["requires_fingerprint"] == true) {
        Navigator.pushNamed(
          context,
          "/fingerprint",
          arguments: {"session_id": sessionId},
        );
      } else if (result["success"] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data["message"] ?? "Check-in successful")),
        );
      } else {
        throw Exception(data["error"] ?? data["detail"] ?? "Check-in failed");
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst("Exception: ", ""))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Dashboard")),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(dashboardData.toString()),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: startCheckIn,
                    icon: const Icon(Icons.my_location),
                    label: const Text("Check In"),
                  ),
                ],
              ),
            ),
    );
  }
}
