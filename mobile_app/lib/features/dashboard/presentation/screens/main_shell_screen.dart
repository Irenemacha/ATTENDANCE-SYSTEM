import 'package:flutter/material.dart';
import 'package:location/location.dart';
import 'package:mobile_app/core/storage/storage_service.dart';
import 'package:mobile_app/features/attendance/data/attendance_service.dart';
import 'package:mobile_app/services/auth_service.dart';

const _green = Color(0xFF25D366);
const _darkGreen = Color(0xFF075E54);
const _surface = Color(0xFFF2F5F3);

class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int currentIndex = 0;
  bool isLoading = true;
  Map<String, dynamic>? user;
  final location = Location();
  final attendanceService = AttendanceService();

  @override
  void initState() {
    super.initState();
    loadUser();
  }

  Future<void> loadUser() async {
    final result = await AuthService().fetchCurrentUser();
    if (!mounted) return;
    if (result['success'] == true) {
      setState(() {
        user = Map<String, dynamic>.from(result['user']);
        isLoading = false;
      });
      return;
    }
    await StorageService.clearSession();
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, '/login');
  }

  Future<void> startCheckIn() async {
    final sessionId = await _askSessionId();
    if (sessionId == null) return;

    try {
      var enabled = await location.serviceEnabled();
      if (!enabled) enabled = await location.requestService();
      if (!enabled) throw Exception('Location service is disabled');

      var permission = await location.hasPermission();
      if (permission == PermissionStatus.denied) {
        permission = await location.requestPermission();
      }
      if (permission != PermissionStatus.granted) {
        throw Exception('Location permission denied');
      }

      final current = await location.getLocation();
      final latitude = current.latitude;
      final longitude = current.longitude;
      if (latitude == null || longitude == null) {
        throw Exception('Could not read current GPS location');
      }

      final result = await attendanceService.checkIn(
        sessionId: sessionId,
        latitude: latitude,
        longitude: longitude,
      );
      if (!mounted) return;
      final data = Map<String, dynamic>.from(result['data']);
      if (result['success'] == true && data['requires_fingerprint'] == true) {
        Navigator.pushNamed(context, '/fingerprint', arguments: {'session_id': sessionId});
      } else if (result['success'] == true) {
        _snack(data['message'] ?? 'Check-in successful');
      } else if (result['statusCode'] == 401) {
        await StorageService.clearSession();
        if (!mounted) return;
        Navigator.pushReplacementNamed(context, '/login');
      } else {
        throw Exception(data['error'] ?? data['detail'] ?? 'Check-in failed');
      }
    } catch (error) {
      if (!mounted) return;
      _snack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<int?> _askSessionId() async {
    final controller = TextEditingController();
    return showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Quick check-in'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Session ID'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, int.tryParse(controller.text.trim())),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      HomeTab(user: user),
      AttendanceTab(onCheckIn: startCheckIn),
      const NotificationsTab(),
      ProfileTab(user: user, onRefresh: loadUser),
    ];
    return Scaffold(
      backgroundColor: _surface,
      appBar: AppBar(
        title: const Text('Attendance'),
        backgroundColor: _darkGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: isLoading ? const Center(child: CircularProgressIndicator()) : tabs[currentIndex],
      floatingActionButton: FloatingActionButton(
        backgroundColor: _green,
        foregroundColor: Colors.white,
        onPressed: startCheckIn,
        child: const Icon(Icons.add),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentIndex,
        selectedItemColor: _darkGreen,
        unselectedItemColor: const Color(0xFF6B7D78),
        type: BottomNavigationBarType.fixed,
        onTap: (index) => setState(() => currentIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.fact_check_outlined), label: 'Attendance'),
          BottomNavigationBarItem(icon: Icon(Icons.notifications_outlined), label: 'Notifications'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}

class HomeTab extends StatelessWidget {
  const HomeTab({super.key, required this.user});
  final Map<String, dynamic>? user;

  @override
  Widget build(BuildContext context) {
    final name = _fullName(user);
    final role = user?['role_display'] ?? 'not yet';
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _HeaderCard(
          title: 'Hi, $name',
          subtitle: 'Role: $role',
          icon: Icons.waving_hand_outlined,
        ),
        const SizedBox(height: 12),
        const _InfoTile(
          icon: Icons.event_available_outlined,
          title: 'Today',
          subtitle: 'Use the quick action button to check in to an active session.',
        ),
      ],
    );
  }
}

class AttendanceTab extends StatelessWidget {
  const AttendanceTab({super.key, required this.onCheckIn});
  final VoidCallback onCheckIn;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _HeaderCard(
          title: 'Attendance',
          subtitle: 'Check in with location and fingerprint verification.',
          icon: Icons.fact_check_outlined,
          action: FilledButton.icon(
            onPressed: onCheckIn,
            icon: const Icon(Icons.my_location),
            label: const Text('Check in'),
          ),
        ),
      ],
    );
  }
}

class NotificationsTab extends StatelessWidget {
  const NotificationsTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: _InfoTile(
        icon: Icons.notifications_none,
        title: 'No notifications',
        subtitle: 'Updates from your classes will appear here.',
      ),
    );
  }
}

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key, required this.user, required this.onRefresh});
  final Map<String, dynamic>? user;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final groups = List<String>.from(user?['groups'] ?? const []);
    final profile = Map<String, dynamic>.from(user?['profile'] ?? {'profile_type': 'not yet'});
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _HeaderCard(
            title: _fullName(user),
            subtitle: user?['email']?.toString().isNotEmpty == true ? user!['email'] : 'No email',
            icon: Icons.person,
          ),
          const SizedBox(height: 12),
          _InfoTile(icon: Icons.alternate_email, title: 'Username', subtitle: user?['username'] ?? ''),
          _InfoTile(icon: Icons.badge_outlined, title: 'Role', subtitle: user?['role_display'] ?? 'not yet'),
          _InfoTile(
            icon: Icons.group_outlined,
            title: 'Groups',
            subtitle: groups.isEmpty ? 'not yet' : groups.join(', '),
          ),
          _ProfileDetails(profile: profile),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () async {
              await AuthService().logout();
              if (!context.mounted) return;
              Navigator.pushReplacementNamed(context, '/login');
            },
            icon: const Icon(Icons.logout),
            label: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}

class _ProfileDetails extends StatelessWidget {
  const _ProfileDetails({required this.profile});
  final Map<String, dynamic> profile;

  @override
  Widget build(BuildContext context) {
    if (profile['profile_type'] == 'not yet') {
      return const _InfoTile(
        icon: Icons.info_outline,
        title: 'Profile',
        subtitle: 'Profile not yet completed',
      );
    }
    return Column(
      children: [
        _InfoTile(icon: Icons.confirmation_number_outlined, title: 'Reg number', subtitle: profile['reg_number'] ?? ''),
        _InfoTile(icon: Icons.school_outlined, title: 'Course', subtitle: profile['course'] ?? ''),
        _InfoTile(icon: Icons.timeline_outlined, title: 'Year of study', subtitle: '${profile['year_of_study'] ?? ''}'),
        _InfoTile(icon: Icons.phone_outlined, title: 'Phone', subtitle: profile['phone_number'] ?? 'Not provided'),
      ],
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    this.action,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: _green.withOpacity(0.16),
              child: Icon(icon, color: _darkGreen),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF58706A))),
                  if (action != null) ...[
                    const SizedBox(height: 12),
                    action!,
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _surface,
          child: Icon(icon, color: _darkGreen),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
      ),
    );
  }
}

String _fullName(Map<String, dynamic>? user) {
  final fullName = user?['full_name']?.toString() ?? '';
  if (fullName.trim().isNotEmpty) return fullName;
  return user?['username']?.toString() ?? 'User';
}
