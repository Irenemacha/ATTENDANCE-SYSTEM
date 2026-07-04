import 'package:flutter/material.dart';
import 'package:location/location.dart';
import 'package:local_auth/local_auth.dart';
import 'package:mobile_app/core/storage/storage_service.dart';
import 'package:mobile_app/features/attendance/data/attendance_service.dart';
import 'package:mobile_app/features/attendance/data/security_validation_service.dart';
import 'package:mobile_app/services/auth_service.dart';

const _primary = Color(0xFF2563EB);
const _primaryDark = Color(0xFF0F172A);
const _surface = Color(0xFFF8FAFC);

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
  final securityService = AttendanceSecurityService();
  final LocalAuthentication _localAuth = LocalAuthentication();
  AttendanceSecuritySnapshot? securitySnapshot;
  bool isSecurityLoading = false;
  bool fingerprintPassed = false;
  bool otpVerified = false;
  bool isFingerprintLoading = false;
  bool isOtpLoading = false;
  final TextEditingController otpController = TextEditingController();
  String? otpError;

  @override
  void initState() {
    super.initState();
    loadUser();
    evaluateSecurity();
  }

  @override
  void dispose() {
    otpController.dispose();
    super.dispose();
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

  Future<void> evaluateSecurity() async {
    setState(() => isSecurityLoading = true);
    final snapshot = await AttendanceSecurityService.evaluate(
      location: location,
    );
    if (!mounted) return;
    setState(() {
      securitySnapshot = snapshot;
      isSecurityLoading = false;
    });
  }

  Future<void> simulateFingerprintSuccess() async {
    setState(() => isFingerprintLoading = true);
    try {
      final result = await securityService.verifyFingerprint(success: true);
      if (!mounted) return;
      final data = Map<String, dynamic>.from(result['data'] ?? {});
      if (result['success'] == true) {
        setState(() {
          fingerprintPassed = true;
          otpError = null;
        });
        _snack(data['message'] ?? 'Fingerprint verified');
      } else {
        throw Exception(
          data['error'] ?? data['detail'] ?? 'Fingerprint verification failed',
        );
      }
    } catch (error) {
      if (!mounted) return;
      _snack(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => isFingerprintLoading = false);
      }
    }
  }

  Future<void> runFingerprintFlow() async {
    if (securitySnapshot == null ||
        !securitySnapshot!.gpsValid ||
        !securitySnapshot!.timeWindowValid) {
      _snack('GPS and time window must pass before fingerprint');
      return;
    }

    setState(() => isFingerprintLoading = true);
    try {
      final canAuthenticate =
          await _localAuth.canCheckBiometrics ||
          await _localAuth.isDeviceSupported();
      if (!canAuthenticate) {
        await simulateFingerprintSuccess();
        return;
      }

      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Verify fingerprint to complete attendance',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );

      final result = await securityService.verifyFingerprint(
        success: authenticated,
      );
      if (!mounted) return;
      final data = Map<String, dynamic>.from(result['data'] ?? {});
      if (result['success'] == true) {
        setState(() {
          fingerprintPassed = authenticated;
          otpError = null;
        });
        _snack(data['message'] ?? 'Fingerprint verified');
      } else {
        setState(
          () => otpError =
              data['error'] ??
              data['detail'] ??
              'Fingerprint verification failed',
        );
        _snack(
          data['error'] ?? data['detail'] ?? 'Fingerprint verification failed',
        );
      }
    } catch (error) {
      if (!mounted) return;
      _snack(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => isFingerprintLoading = false);
      }
    }
  }

  Future<void> verifyOtpFallback() async {
    if (user == null) return;
    final otp = otpController.text.trim();
    if (otp.isEmpty) {
      setState(() => otpError = 'Please enter the OTP');
      return;
    }

    setState(() => isOtpLoading = true);
    try {
      final success = await securityService.verifyOtp(
        username: user!['username'].toString(),
        otp: otp,
        deviceId: 'demo-device',
      );
      if (!mounted) return;
      if (success) {
        setState(() {
          otpVerified = true;
          otpError = null;
        });
        _snack('OTP verified successfully');
      } else {
        setState(() => otpError = 'OTP verification failed');
        _snack('OTP verification failed');
      }
    } catch (error) {
      if (!mounted) return;
      _snack(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => isOtpLoading = false);
      }
    }
  }

  Future<void> startCheckIn() async {
    if (!canEnableAttendance()) {
      _snack('Complete the security checks before attendance is allowed.');
      return;
    }

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
      if (result['success'] == true) {
        if (data['requires_fingerprint'] == true) {
          _snack(
            'Geo attend verified. Use the identity verification card to continue.',
          );
        } else {
          _snack(data['message'] ?? 'Check-in successful');
        }
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

  bool canEnableAttendance() {
    final snapshot = securitySnapshot;
    return snapshot != null &&
        snapshot.gpsValid &&
        snapshot.timeWindowValid &&
        (fingerprintPassed || otpVerified);
  }

  Future<void> startCheckOut() async {
    if (!canEnableAttendance()) {
      _snack('Complete the security checks before check out is allowed.');
      return;
    }

    final sessionId = await _askSessionId();
    if (sessionId == null) return;

    try {
      final result = await attendanceService.checkOut(sessionId: sessionId);
      if (!mounted) return;
      final data = Map<String, dynamic>.from(result['data'] ?? {});
      if (result['success'] == true) {
        _snack(data['message'] ?? 'Check-out successful');
      } else {
        throw Exception(data['error'] ?? data['detail'] ?? 'Check-out failed');
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
            onPressed: () =>
                Navigator.pop(context, int.tryParse(controller.text.trim())),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  void _snack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      HomeTab(
        user: user,
        securitySnapshot: securitySnapshot,
        isSecurityLoading: isSecurityLoading,
        onRefreshSecurity: evaluateSecurity,
        onFingerprint: runFingerprintFlow,
        onSimulateFingerprint: simulateFingerprintSuccess,
        onVerifyOtp: verifyOtpFallback,
        otpController: otpController,
        otpError: otpError,
        fingerprintPassed: fingerprintPassed,
        otpVerified: otpVerified,
        isFingerprintLoading: isFingerprintLoading,
        isOtpLoading: isOtpLoading,
        canProceed: canEnableAttendance(),
        onCheckIn: startCheckIn,
        onCheckOut: startCheckOut,
      ),
      AttendanceTab(
        onCheckIn: startCheckIn,
        onCheckOut: startCheckOut,
        canProceed: canEnableAttendance(),
      ),
      const NotificationsTab(),
      ProfileTab(user: user, onRefresh: loadUser),
    ];
    return Scaffold(
      backgroundColor: _surface,
      appBar: AppBar(
        title: const Text('GeoAttend'),
        backgroundColor: _primaryDark,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : tabs[currentIndex],
      floatingActionButton: FloatingActionButton(
        backgroundColor: _primary,
        foregroundColor: Colors.white,
        onPressed: startCheckIn,
        child: const Icon(Icons.touch_app_outlined),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentIndex,
        selectedItemColor: _primary,
        unselectedItemColor: const Color(0xFF6B7D78),
        type: BottomNavigationBarType.fixed,
        onTap: (index) => setState(() => currentIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.fact_check_outlined),
            label: 'Attendance',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.notifications_outlined),
            label: 'Notifications',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class HomeTab extends StatelessWidget {
  const HomeTab({
    super.key,
    required this.user,
    required this.securitySnapshot,
    required this.isSecurityLoading,
    required this.onRefreshSecurity,
    required this.onFingerprint,
    required this.onSimulateFingerprint,
    required this.onVerifyOtp,
    required this.otpController,
    required this.otpError,
    required this.fingerprintPassed,
    required this.otpVerified,
    required this.isFingerprintLoading,
    required this.isOtpLoading,
    required this.canProceed,
    required this.onCheckIn,
    required this.onCheckOut,
  });
  final Map<String, dynamic>? user;
  final AttendanceSecuritySnapshot? securitySnapshot;
  final bool isSecurityLoading;
  final Future<void> Function() onRefreshSecurity;
  final Future<void> Function() onFingerprint;
  final Future<void> Function() onSimulateFingerprint;
  final Future<void> Function() onVerifyOtp;
  final TextEditingController otpController;
  final String? otpError;
  final bool fingerprintPassed;
  final bool otpVerified;
  final bool isFingerprintLoading;
  final bool isOtpLoading;
  final bool canProceed;
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;

  @override
  Widget build(BuildContext context) {
    final name = _fullName(user);
    final role = user?['role_display'] ?? 'not yet';
    final sessionState = _sessionStatusLabel(securitySnapshot);
    final sessionColor = _sessionStatusColor(sessionState);

    return RefreshIndicator(
      onRefresh: onRefreshSecurity,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_primary, Color(0xFF0F172A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(
                        Icons.school_outlined,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Hello, $name',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Role: $role • GeoAttend ready',
                            style: const TextStyle(
                              color: Color(0xFFE2E8F0),
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _SummaryTile(
                        label: 'Session',
                        value: sessionState,
                        accent: sessionColor,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _SummaryTile(
                        label: 'Attendance',
                        value: canProceed ? 'Ready' : 'Pending',
                        accent: canProceed ? Colors.green : Colors.amber,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _GeoAttendStatusCard(
            snapshot: securitySnapshot,
            isLoading: isSecurityLoading,
          ),
          const SizedBox(height: 12),
          _ConnectivityStatusCard(snapshot: securitySnapshot),
          const SizedBox(height: 12),
          _SessionStatusCard(snapshot: securitySnapshot),
          const SizedBox(height: 12),
          _TimeWindowCard(snapshot: securitySnapshot),
          const SizedBox(height: 12),
          _IdentityVerificationCard(
            snapshot: securitySnapshot,
            onFingerprint: onFingerprint,
            onSimulateFingerprint: onSimulateFingerprint,
            onVerifyOtp: onVerifyOtp,
            otpController: otpController,
            otpError: otpError,
            fingerprintPassed: fingerprintPassed,
            otpVerified: otpVerified,
            isFingerprintLoading: isFingerprintLoading,
            isOtpLoading: isOtpLoading,
            canProceed: canProceed,
          ),
          const SizedBox(height: 12),
          _AttendanceOverviewCard(
            canProceed: canProceed,
            onCheckIn: onCheckIn,
            onCheckOut: onCheckOut,
          ),
        ],
      ),
    );
  }
}

class AttendanceTab extends StatelessWidget {
  const AttendanceTab({
    super.key,
    required this.onCheckIn,
    required this.onCheckOut,
    required this.canProceed,
  });
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;
  final bool canProceed;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _HeaderCard(
          title: 'Attendance',
          subtitle:
              'Geo attend, verify identity, and complete check in or check out safely.',
          icon: Icons.fact_check_outlined,
        ),
        const SizedBox(height: 12),
        _AttendanceOverviewCard(
          canProceed: canProceed,
          onCheckIn: onCheckIn,
          onCheckOut: onCheckOut,
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
    final profile = Map<String, dynamic>.from(
      user?['profile'] ?? {'profile_type': 'not yet'},
    );
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _HeaderCard(
            title: _fullName(user),
            subtitle: user?['email']?.toString().isNotEmpty == true
                ? user!['email']
                : 'No email',
            icon: Icons.person,
          ),
          const SizedBox(height: 12),
          _InfoTile(
            icon: Icons.alternate_email,
            title: 'Username',
            subtitle: user?['username'] ?? '',
          ),
          _InfoTile(
            icon: Icons.badge_outlined,
            title: 'Role',
            subtitle: user?['role_display'] ?? 'not yet',
          ),
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
        _InfoTile(
          icon: Icons.confirmation_number_outlined,
          title: 'Reg number',
          subtitle: profile['reg_number'] ?? '',
        ),
        _InfoTile(
          icon: Icons.school_outlined,
          title: 'Course',
          subtitle: profile['course'] ?? '',
        ),
        _InfoTile(
          icon: Icons.timeline_outlined,
          title: 'Year of study',
          subtitle: '${profile['year_of_study'] ?? ''}',
        ),
        _InfoTile(
          icon: Icons.phone_outlined,
          title: 'Phone',
          subtitle: profile['phone_number'] ?? 'Not provided',
        ),
      ],
    );
  }
}

class _GeoAttendStatusCard extends StatelessWidget {
  const _GeoAttendStatusCard({required this.snapshot, required this.isLoading});
  final AttendanceSecuritySnapshot? snapshot;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final isValid = snapshot?.gpsValid == true;
    final color = isValid
        ? Colors.green
        : (snapshot == null ? Colors.orange : Colors.redAccent);
    return _GlassCard(
      title: 'Geo Attend Status',
      icon: Icons.location_on_outlined,
      accent: color,
      child: isLoading
          ? const LinearProgressIndicator(minHeight: 3)
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MetricRow(
                  label: 'Status',
                  value: snapshot == null
                      ? 'Checking...'
                      : (isValid ? 'Inside geofence' : 'Outside geofence'),
                  valueColor: color,
                ),
                _MetricRow(
                  label: 'Coordinates',
                  value: snapshot == null
                      ? '--'
                      : '${snapshot!.latitude.toStringAsFixed(4)}, ${snapshot!.longitude.toStringAsFixed(4)}',
                ),
                _MetricRow(
                  label: 'Distance',
                  value: snapshot == null
                      ? '--'
                      : '${snapshot!.distanceMeters.toStringAsFixed(1)} m',
                ),
                _MetricRow(
                  label: 'Radius',
                  value: snapshot == null
                      ? '--'
                      : '${snapshot!.radiusMeters.toStringAsFixed(0)} m',
                ),
                const SizedBox(height: 8),
                Text(
                  snapshot?.gpsMessage ?? 'Waiting for location validation',
                  style: const TextStyle(color: Color(0xFF58706A)),
                ),
              ],
            ),
    );
  }
}

class _ConnectivityStatusCard extends StatelessWidget {
  const _ConnectivityStatusCard({required this.snapshot});
  final AttendanceSecuritySnapshot? snapshot;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      title: 'Connectivity',
      icon: Icons.wifi_outlined,
      accent: Colors.blue,
      child: Column(
        children: [
          _MetricRow(
            label: 'WiFi',
            value: snapshot?.wifiLabel ?? 'Campus WiFi',
          ),
          _MetricRow(
            label: 'BLE',
            value: snapshot?.bleStatus ?? 'Simulated mode',
          ),
          _MetricRow(
            label: 'Beacon',
            value: snapshot?.bleDetected == true ? 'Detected' : 'Not detected',
          ),
        ],
      ),
    );
  }
}

class _SessionStatusCard extends StatelessWidget {
  const _SessionStatusCard({required this.snapshot});
  final AttendanceSecuritySnapshot? snapshot;

  @override
  Widget build(BuildContext context) {
    final state = _sessionStatusLabel(snapshot);
    final color = _sessionStatusColor(state);
    return _GlassCard(
      title: 'Session Status',
      icon: Icons.event_available_outlined,
      accent: color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _MetricRow(label: 'State', value: state, valueColor: color),
          Text(
            snapshot?.timeWindowValid == true
                ? 'Attendance window is currently open.'
                : 'Session availability is currently restricted.',
            style: const TextStyle(color: Color(0xFF58706A)),
          ),
        ],
      ),
    );
  }
}

class _TimeWindowCard extends StatelessWidget {
  const _TimeWindowCard({required this.snapshot});
  final AttendanceSecuritySnapshot? snapshot;

  @override
  Widget build(BuildContext context) {
    final valid = snapshot?.timeWindowValid == true;
    final color = valid ? Colors.green : Colors.orange;
    return _GlassCard(
      title: 'Time Window',
      icon: Icons.access_time_outlined,
      accent: color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _MetricRow(label: 'Allowed range', value: '08:00 - 17:00'),
          _MetricRow(
            label: 'Current status',
            value: valid ? 'Valid' : 'Expired / Not yet started',
            valueColor: color,
          ),
          Text(
            snapshot?.timeWindowMessage ?? 'Checking...',
            style: const TextStyle(color: Color(0xFF58706A)),
          ),
        ],
      ),
    );
  }
}

class _IdentityVerificationCard extends StatelessWidget {
  const _IdentityVerificationCard({
    required this.snapshot,
    required this.onFingerprint,
    required this.onSimulateFingerprint,
    required this.onVerifyOtp,
    required this.otpController,
    required this.otpError,
    required this.fingerprintPassed,
    required this.otpVerified,
    required this.isFingerprintLoading,
    required this.isOtpLoading,
    required this.canProceed,
  });

  final AttendanceSecuritySnapshot? snapshot;
  final Future<void> Function() onFingerprint;
  final Future<void> Function() onSimulateFingerprint;
  final Future<void> Function() onVerifyOtp;
  final TextEditingController otpController;
  final String? otpError;
  final bool fingerprintPassed;
  final bool otpVerified;
  final bool isFingerprintLoading;
  final bool isOtpLoading;
  final bool canProceed;

  @override
  Widget build(BuildContext context) {
    final verified = fingerprintPassed || otpVerified;
    final color = verified ? Colors.green : Colors.amber;
    final enabled =
        snapshot?.gpsValid == true && snapshot?.timeWindowValid == true;

    return _GlassCard(
      title: 'Identity Verification',
      icon: Icons.verified_user_outlined,
      accent: color,
      child: Column(
        children: [
          _MetricRow(
            label: 'Status',
            value: verified ? 'Verified' : 'Pending',
            valueColor: color,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: enabled && !isFingerprintLoading
                      ? () => onFingerprint()
                      : null,
                  icon: const Icon(Icons.fingerprint),
                  label: const Text('Fingerprint'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: enabled && !isFingerprintLoading
                      ? () => onSimulateFingerprint()
                      : null,
                  icon: const Icon(Icons.auto_fix_high),
                  label: const Text('Simulate success'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: otpController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'OTP fallback',
              hintText: 'Enter OTP for fallback',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              errorText: otpError,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: enabled && !isOtpLoading ? () => onVerifyOtp() : null,
              icon: const Icon(Icons.sms_outlined),
              label: const Text('Verify OTP fallback'),
            ),
          ),
        ],
      ),
    );
  }
}

class _AttendanceOverviewCard extends StatelessWidget {
  const _AttendanceOverviewCard({
    required this.canProceed,
    required this.onCheckIn,
    required this.onCheckOut,
  });
  final bool canProceed;
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      title: 'Attendance Actions',
      icon: Icons.touch_app_outlined,
      accent: _primary,
      child: Column(
        children: [
          Text(
            canProceed
                ? 'All validations are ready. You can proceed with geo attend actions.'
                : 'Complete GPS, session, time, and identity checks before using the actions.',
            style: const TextStyle(color: Color(0xFF58706A)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: canProceed ? onCheckIn : null,
                  icon: const Icon(Icons.my_location),
                  label: const Text('Check In (geo attend)'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: canProceed ? onCheckOut : null,
                  icon: const Icon(Icons.logout),
                  label: const Text('Check Out'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GlassCard extends StatelessWidget {
  const _GlassCard({
    required this.title,
    required this.icon,
    required this.accent,
    required this.child,
  });
  final String title;
  final IconData icon;
  final Color accent;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: accent, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final IconData icon;

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
              backgroundColor: _primary.withValues(alpha: 0.14),
              child: Icon(icon, color: _primary),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(color: Color(0xFF58706A)),
                  ),
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
          child: Icon(icon, color: _primary),
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

String _sessionStatusLabel(AttendanceSecuritySnapshot? snapshot) {
  if (snapshot == null) return 'Session Not Started';
  if (!snapshot.timeWindowValid) return 'Session Ended';
  return 'Session Active';
}

Color _sessionStatusColor(String label) {
  switch (label) {
    case 'Session Active':
      return Colors.green;
    case 'Session Ended':
      return Colors.redAccent;
    default:
      return Colors.orange;
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.accent,
  });
  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 12),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(color: accent, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({required this.label, required this.value, this.valueColor});
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 86,
            child: Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: Color(0xFF58706A),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: valueColor ?? const Color(0xFF1F2937),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
