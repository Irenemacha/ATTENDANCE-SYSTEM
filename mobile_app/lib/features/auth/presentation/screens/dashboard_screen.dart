import 'package:flutter/material.dart';
import 'package:mobile_app/features/dashboard/data/dashboard_service.dart';
import 'package:mobile_app/core/storage/storage_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool isLoading = true;
  bool isError = false;

  Map<String, dynamic>? dashboardData;

  final DashboardService service = DashboardService();

  @override
  void initState() {
    super.initState();
    fetchDashboard();
  }

  Future<void> fetchDashboard() async {
    setState(() {
      isLoading = true;
      isError = false;
    });

    try {
      final token = await StorageService.getToken();

      if (token == null) {
        setState(() {
          isLoading = false;
          isError = true;
        });
        return;
      }

      final res = await service.getDashboardData(token);

      if (!mounted) return;

      if (res['success'] == true) {
        setState(() {
          dashboardData = Map<String, dynamic>.from(res['data']);
          isLoading = false;
        });
      } else {
        setState(() {
          isLoading = false;
          isError = true;
        });
      }
    } catch (e) {
      setState(() {
        isLoading = false;
        isError = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        title: const Text("GeoAttend Dashboard"),
        centerTitle: true,
        automaticallyImplyLeading: false,
      ),

      body: RefreshIndicator(
        onRefresh: fetchDashboard,
        child: isLoading
            ? const Center(child: CircularProgressIndicator())
            : isError
                ? _buildError()
                : _buildDashboard(),
      ),
    );
  }

  // ================= ERROR UI =================
  Widget _buildError() {
    return ListView(
      children: [
        const SizedBox(height: 120),
        const Icon(Icons.error_outline, size: 80, color: Colors.red),
        const SizedBox(height: 10),
        const Center(
          child: Text(
            "Failed to load dashboard",
            style: TextStyle(fontSize: 16),
          ),
        ),
        const SizedBox(height: 20),
        Center(
          child: ElevatedButton(
            onPressed: fetchDashboard,
            child: const Text("Retry"),
          ),
        )
      ],
    );
  }

  // ================= DASHBOARD UI =================
  Widget _buildDashboard() {
    final username = dashboardData?['username'] ?? 'Unknown';
    final email = dashboardData?['email'] ?? '';
    final role = dashboardData?['role'] ?? 'student';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildHeaderCard(username, email),
        const SizedBox(height: 16),
        _buildInfoGrid(role),
        const SizedBox(height: 16),
        _buildStatsCard(),
      ],
    );
  }

  // ================= HEADER =================
  Widget _buildHeaderCard(String username, String email) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Colors.indigo, Colors.blue],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 28,
            backgroundColor: Colors.white,
            child: Icon(Icons.person, color: Colors.indigo),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                username,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                email,
                style: const TextStyle(color: Colors.white70),
              ),
            ],
          )
        ],
      ),
    );
  }

  // ================= INFO GRID =================
  Widget _buildInfoGrid(String role) {
    return Row(
      children: [
        Expanded(
          child: _infoCard(Icons.verified_user, "Role", role),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _infoCard(Icons.school, "System", "GeoAttend"),
        ),
      ],
    );
  }

  Widget _infoCard(IconData icon, String title, String value) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(icon, color: Colors.indigo),
          const SizedBox(height: 8),
          Text(title),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  // ================= STATS (PLACEHOLDER FOR ATTENDANCE) =================
  Widget _buildStatsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Attendance Overview",
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 10),
          Text("• Present: --"),
          Text("• Absent: --"),
          Text("• Late: --"),
          SizedBox(height: 10),
          Text(
            "Connect attendance API to enable real stats",
            style: TextStyle(color: Colors.grey),
          ),
        ],
      ),
    );
  }
}