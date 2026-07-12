import 'dart:async';

import 'package:flutter/material.dart';
import 'package:location/location.dart';
import 'package:mobile_app/core/storage/storage_service.dart';
import 'package:mobile_app/features/attendance/data/attendance_service.dart';
import 'package:mobile_app/features/attendance/data/security_validation_service.dart';
import 'package:mobile_app/features/dashboard/data/dashboard_service.dart';
import 'package:mobile_app/services/auth_service.dart';

const _primary = Color(0xFF2563EB);
const _primaryDark = Color(0xFF0F172A);
const _surface = Color(0xFFF8FAFC);

enum AttendanceFlowState { notCheckedIn, checkedIn, checkedOut }

class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen>
    with WidgetsBindingObserver {
  int currentIndex = 0;
  bool isLoading = true;
  bool isSecurityLoading = false;
  bool fingerprintPassed = false;
  bool otpVerified = false;
  bool checkoutIdentityVerified = false;
  int fingerprintAttempts = 0;
  bool _routeArgsApplied = false;
  Timer? _sessionTimer;

  Map<String, dynamic>? user;
  Map<String, dynamic>? activeSession;
  Map<String, dynamic>? attendanceStats;
  AttendanceFlowState attendanceState = AttendanceFlowState.notCheckedIn;
  AttendanceSecuritySnapshot? securitySnapshot;

  final location = Location();
  final attendanceService = AttendanceService();
  final dashboardService = DashboardService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadInitialData();
    _sessionTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      refreshSessionStatus(showSnack: false);
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sessionTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      refreshSessionStatus(showSnack: false);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_routeArgsApplied) return;
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    if (args == null) return;

    final attempts = args['fingerprintAttempts'];
    if (args['fingerprintPassed'] == true ||
        args['otpVerified'] == true ||
        attempts is int) {
      _routeArgsApplied = true;
      setState(() {
        if (args['fingerprintPassed'] == true) fingerprintPassed = true;
        if (args['otpVerified'] == true) otpVerified = true;
        if (attempts is int) fingerprintAttempts = attempts;
      });
    }
  }

  Future<void> _loadInitialData() async {
    print("STEP 1: loadUser start");
    await loadUser();
    print("STEP 2: loadUser finished");

    print("STEP 5: refreshSessionStatus start");
    await refreshSessionStatus(showSnack: false);
    print("STEP 6: refreshSessionStatus finished");

    print("STEP 3: evaluateSecurity start");
    await evaluateSecurity();
    print("STEP 4: evaluateSecurity finished");

    print("STEP 7: loadAttendanceStats start");
    await loadAttendanceStats();
    print("STEP 8: loadAttendanceStats finished");

    print("STEP 9: setting isLoading false");

    if (mounted) {
    setState(() => isLoading = false);
    }
  }

  Future<void> loadUser() async {
    final result = await AuthService().fetchCurrentUser();
    if (!mounted) return;
    if (result['success'] == true) {
      setState(() => user = Map<String, dynamic>.from(result['user']));
      return;
    }
    await StorageService.clearSession();
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, '/login');
  }

  Future<void> loadAttendanceStats() async {
  final token = await StorageService.getAccessToken();
  if (token == null) return;

  final result = await dashboardService.getStudentDashboard(token);

  if (!mounted) return;

  final data = Map<String, dynamic>.from(result['data'] ?? {});
  final dashboardData = Map<String, dynamic>.from(data['data'] ?? data);

  if (attendanceState == AttendanceFlowState.checkedIn &&
      dashboardData['session_active'] != true) {

    setState(() {
      attendanceStats = dashboardData;
});

    return;
  }

  setState(() {
    attendanceStats = dashboardData;
  });
}

  Future<void> evaluateSecurity() async {
    setState(() => isSecurityLoading = true);
    final snapshot = await AttendanceSecurityService.evaluate(
      location: location,
      detectedBeaconId: activeSession?['beacon_id'],
    );
    if (!mounted) return;
    setState(() {
      securitySnapshot = snapshot;
      isSecurityLoading = false;
    });
  }

  Future<void> refreshSessionStatus({bool showSnack = true}) async {
    final result = await attendanceService.getActiveSession();
    if (!mounted) return;

    if (result['success'] != true) {
      setState(() {
        activeSession = null;
        attendanceState = AttendanceFlowState.notCheckedIn;
      });
      if (showSnack) _snack('No active attendance session available');
      return;
    }

    final data = Map<String, dynamic>.from(result['data'] ?? {});
    final hasSession = data['session_id'] != null;
    setState(() {
      activeSession = hasSession ? data : null;
      if(data['checked_out'] == true){
        attendanceState = AttendanceFlowState.checkedOut;
      }
        else if(data['checked_in'] == true){
         attendanceState = AttendanceFlowState.checkedIn;
        }
      else{
        attendanceState = AttendanceFlowState.notCheckedIn;
     }
      if (attendanceState == AttendanceFlowState.checkedIn &&
          data['active'] != true &&
          data['is_active'] != true) {
        // Checkout is a new high-risk action and needs a fresh identity proof.
        checkoutIdentityVerified = false;
      }
    });

    if (showSnack && !hasSession) {
      _snack(
        data['message']?.toString() ?? 'No active attendance session available',
      );
    }
  }

  int? get activeSessionId {
    final raw = activeSession?['session_id'];
    if (raw is int) return raw;
    return int.tryParse(raw?.toString() ?? '');
  }

  bool get hasActiveSession =>
    activeSessionId != null &&
    activeSession?['session_active'] == true;
  bool get hasOpenSessionForCheckout => activeSessionId != null;
  bool get identityVerified => fingerprintPassed || otpVerified;

  bool canCheckIn() {
 return activeSession?['can_check_in'] == true;
}

  bool canCheckOut() {
 return activeSession?['can_check_out'] == true;
}

  List<String> missingSecuritySteps({required bool forCheckout}) {
    final snapshot = securitySnapshot;
    final missing = <String>[];
    if (snapshot == null) {
      missing.add('GPS validation has not completed');
      return missing;
    }
    if (!snapshot.gpsValid) {
      missing.add('GPS validation');
    }
    if (!snapshot.geofenceValid) {
      missing.add('Geofence validation');
    }
    if (snapshot.wifiStatus != 'Trusted') {
      missing.add('WiFi validation (ARUSOPASUANET)');
    }
    if (!snapshot.bleDetected) {
      missing.add('BLE validation (Beacon 1C)');
    }
    if (!snapshot.timeWindowValid) {
      missing.add('Valid attendance time window');
    }
    if (forCheckout) {
      if (!hasOpenSessionForCheckout) {
        missing.add('Active or open attendance session');
      }
    } else if (!hasActiveSession) {
      missing.add('Active attendance session');
    }
    if (forCheckout && !checkoutIdentityVerified ||
        !forCheckout && !identityVerified) {
      missing.add('Fingerprint success or OTP fallback verification');
    }
    return missing;
  }

  Future<void> openFingerprintScan() async {
  
    await refreshSessionStatus(showSnack: false);
    if (!mounted) return;
    if(activeSession == null){
      _snack('No active attendance session available');
      return;
    }
    final verified = await Navigator.pushNamed<bool>(
      context,
      '/fingerprint-scan',
      arguments: {'fingerprintAttempts': fingerprintAttempts},
    );
    if (!mounted || verified != true) return;
    setState(() {
      fingerprintPassed = true;
      if (attendanceState == AttendanceFlowState.checkedIn && !hasActiveSession) {
        checkoutIdentityVerified = true;
      }
    });
    _snack('Identity Verified Successfully');
  }

  Future<LocationData> _currentLocation() async {
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
    return location.getLocation();
  }

  Future<void> startCheckIn() async {
    await refreshSessionStatus(showSnack: false);
    await evaluateSecurity();
    if (!canCheckIn()) {
      await showSecurityDialog(forCheckout: false);
      return;
    }

    try {
      final current = await _currentLocation();
      final latitude = current.latitude;
      final longitude = current.longitude;
      final sessionId = activeSessionId;
      if (latitude == null || longitude == null || sessionId == null) {
        throw Exception('Could not prepare attendance location/session');
      }

      final checkInResult = await attendanceService.checkIn(
        sessionId: sessionId,
        latitude: latitude,
        longitude: longitude,
      );
      if (!mounted) return;
      if (checkInResult['success'] != true) {
        final data = Map<String, dynamic>.from(checkInResult['data'] ?? {});
        throw Exception(data['detail'] ?? data['error'] ?? 'Check-in failed');
      }

      // check-in is the single authoritative attendance write on Django.
      // Do not call the legacy /attendance/mark/ endpoint afterwards.
      _snack('Checked-in successfully');
      setState(() => attendanceState = AttendanceFlowState.checkedIn);
      await Future.wait([
        refreshSessionStatus(showSnack: false),
        loadAttendanceStats(),
      ]);
    } catch (error) {
      if (mounted) _snack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> startCheckOut() async {
    await refreshSessionStatus(showSnack: false);
    if (!canCheckOut()) {
      await showSecurityDialog(forCheckout: true);
      return;
    }

    try {
      // The whole ordered validation must run again at checkout time.
      await evaluateSecurity();
      final snapshot = securitySnapshot;
      if (snapshot == null ||
          !snapshot.gpsValid ||
          !snapshot.geofenceValid ||
          snapshot.wifiStatus != 'Trusted' ||
          !snapshot.bleDetected ||
          !snapshot.timeWindowValid) {
        await showSecurityDialog(forCheckout: true);
        return;
      }
      final current = await _currentLocation();
      final sessionId = activeSessionId;
      if (sessionId == null || current.latitude == null || current.longitude == null) {
        throw Exception('No active attendance session available');
      }
      final result = await attendanceService.checkOut(
        sessionId: sessionId,
        latitude: current.latitude!,
        longitude: current.longitude!,
      );
      if (!mounted) return;
      if (result['success'] == true) {
        _snack('Checked-out successfully');
        setState(() => attendanceState = AttendanceFlowState.checkedOut);
        await Future.wait([
          refreshSessionStatus(showSnack: false),
          loadAttendanceStats(),
        ]);
      } else {
        final data = Map<String, dynamic>.from(result['data'] ?? {});
        throw Exception(data['detail'] ?? data['error'] ?? 'Check-out failed');
      }
    } catch (error) {
      if (mounted) _snack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> showSecurityDialog({required bool forCheckout}) async {
    final missing = missingSecuritySteps(forCheckout: forCheckout);
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          missing.isEmpty
              ? 'Security checks complete'
              : 'Security checks pending',
        ),
        content: missing.isEmpty
            ? const Text(
                'All required checks passed. Attendance actions are enabled.',
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Complete these steps first:'),
                  const SizedBox(height: 12),
                  for (final step in missing)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline,
                            color: Colors.orange,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(child: Text(step)),
                        ],
                      ),
                    ),
                ],
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          if ((forCheckout ? !checkoutIdentityVerified : !identityVerified) &&
              activeSessionId != null)
            FilledButton(
              onPressed: () {
                Navigator.pop(context);
                openFingerprintScan();
              },
              child: const Text('Scan Fingerprint'),
            ),
        ],
      ),
    );
  }

  Future<void> refreshAll() async {
    await Future.wait([
      evaluateSecurity(),
      refreshSessionStatus(showSnack: false),
      loadAttendanceStats(),
    ]);
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
        stats: attendanceStats,
        securitySnapshot: securitySnapshot,
        activeSession: activeSession,
        attendanceState: attendanceState,
        fingerprintPassed: fingerprintPassed,
        otpVerified: otpVerified,
        canCheckIn: canCheckIn(),
        canCheckOut: canCheckOut(),
        isSecurityLoading: isSecurityLoading,
        onRefresh: refreshAll,
        onFingerprint: openFingerprintScan,
        onCheckIn: startCheckIn,
        onCheckOut: startCheckOut,
      ),
      AttendanceTab(
        onCheckIn: startCheckIn,
        onCheckOut: startCheckOut,
        canCheckIn: canCheckIn(),
        canCheckOut: canCheckOut(),
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
        tooltip: 'Security status check',
        onPressed: () => showSecurityDialog(
          forCheckout: attendanceState == AttendanceFlowState.checkedIn,
        ),
        child: const Icon(Icons.security_outlined),
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
            icon: Icon(Icons.notifications_active_outlined),
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
    required this.stats,
    required this.securitySnapshot,
    required this.activeSession,
    required this.attendanceState,
    required this.fingerprintPassed,
    required this.otpVerified,
    required this.canCheckIn,
    required this.canCheckOut,
    required this.isSecurityLoading,
    required this.onRefresh,
    required this.onFingerprint,
    required this.onCheckIn,
    required this.onCheckOut,
  });

  final Map<String, dynamic>? user;
  final Map<String, dynamic>? stats;
  final AttendanceSecuritySnapshot? securitySnapshot;
  final Map<String, dynamic>? activeSession;
  final AttendanceFlowState attendanceState;
  final bool fingerprintPassed;
  final bool otpVerified;
  final bool canCheckIn;
  final bool canCheckOut;
  final bool isSecurityLoading;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onFingerprint;
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;

  @override
  Widget build(BuildContext context) {
    final name = _fullName(user, stats);
    final statusLabel = _sessionStatusLabel(activeSession);
    final statusColor = _sessionStatusColor(statusLabel);
    final attendancePercent = _asDouble(stats?['percentage']);
    final attendanceStatus =
        stats?['status']?.toString() ??
        (attendancePercent >= 75 ? 'Fine' : 'Critical');
    final attendanceColor = attendanceStatus == 'Fine'
        ? Colors.green
        : Colors.redAccent;

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [_primary, _primaryDark]),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const CircleAvatar(
                      backgroundColor: Colors.white24,
                      child: Icon(Icons.school_outlined, color: Colors.white),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Hello, $name',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
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
                        value: statusLabel,
                        accent: statusColor,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _SummaryTile(
                        label: 'Attendance',
                        value: '${attendancePercent.toStringAsFixed(1)}%',
                        accent: attendanceColor,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _AttendanceStatsCard(
            stats: stats,
            status: attendanceStatus,
            color: attendanceColor,
          ),
          const SizedBox(height: 12),
          _SessionCard(
            session: activeSession,
            statusLabel: statusLabel,
            statusColor: statusColor,
            attendanceState: attendanceState,
          ),
          const SizedBox(height: 12),
          _GeoAttendStatusCard(
            snapshot: securitySnapshot,
            isLoading: isSecurityLoading,
          ),
          const SizedBox(height: 12),
          _ConnectivityStatusCard(snapshot: securitySnapshot),
          const SizedBox(height: 12),
          _IdentityVerificationCard(
            snapshot: securitySnapshot,
            sessionAvailable: activeSession?['session_id'] != null,
            verified: attendanceState == AttendanceFlowState.checkedIn &&
                    activeSession?['active'] != true &&
                    activeSession?['is_active'] != true
                ? false
                : fingerprintPassed || otpVerified,
            verifiedByOtp: otpVerified,
            onFingerprint: onFingerprint,
          ),
          const SizedBox(height: 12),
          _AttendanceOverviewCard(
            canCheckIn: canCheckIn,
            canCheckOut: canCheckOut,
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
    required this.canCheckIn,
    required this.canCheckOut,
  });
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;
  final bool canCheckIn;
  final bool canCheckOut;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _AttendanceOverviewCard(
          canCheckIn: canCheckIn,
          canCheckOut: canCheckOut,
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
  Widget build(BuildContext context) =>
      const Center(child: Text('No notifications'));
}

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key, required this.user, required this.onRefresh});
  final Map<String, dynamic>? user;
  final Future<void> Function() onRefresh;
  @override
  Widget build(BuildContext context) {
    final profile = Map<String, dynamic>.from(user?['profile'] ?? {});
    String value(String key, [String fallback = '-']) =>
        (profile[key] ?? user?[key])?.toString() ?? fallback;
    return ListView(
    padding: const EdgeInsets.all(16),
    children: [
      _GlassCard(
        title: 'Profile',
        icon: Icons.person_outline,
        accent: _primary,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _fullName(user, null),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(user?['email']?.toString() ?? ''),
            const SizedBox(height: 16),
            _MetricRow(label: 'Registration Number', value: value('reg_number')),
            _MetricRow(label: 'Email', value: value('email')),
            _MetricRow(label: 'Course', value: value('course')),
            _MetricRow(label: 'Department', value: value('department')),
            _MetricRow(label: 'Phone Number', value: value('phone_number')),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh profile'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () async {
                await AuthService().logout();
                if (context.mounted) {
                  Navigator.pushReplacementNamed(context, '/login');
                }
              },
              icon: const Icon(Icons.logout),
              label: const Text('Logout'),
            ),
          ],
        ),
      ),
    ],
  );
  }
}

class _AttendanceStatsCard extends StatelessWidget {
  const _AttendanceStatsCard({
    required this.stats,
    required this.status,
    required this.color,
  });
  final Map<String, dynamic>? stats;
  final String status;
  final Color color;
  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      title: 'Attendance Status',
      icon: Icons.bar_chart_outlined,
      accent: color,
      child: Column(
        children: [
          _MetricRow(
            label: 'Attendance Percentage',
            value: '${_asDouble(stats?['percentage']).toStringAsFixed(1)}%',
            valueColor: color,
          ),
          _MetricRow(label: 'Status', value: status, valueColor: color),
          _MetricRow(
            label: 'Total Sessions',
            value: (stats?['total_sessions'] ?? 0).toString(),
          ),
          _MetricRow(
            label: 'Attended Sessions',
            value: (stats?['attended_sessions'] ?? stats?['present'] ?? 0)
                .toString(),
          ),
        ],
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    required this.session,
    required this.statusLabel,
    required this.statusColor,
    required this.attendanceState,
  });
  final Map<String, dynamic>? session;
  final String statusLabel;
  final Color statusColor;
  final AttendanceFlowState attendanceState;
  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      title: 'Session Status',
      icon: Icons.event_available_outlined,
      accent: statusColor,
      child: Column(
        children: [
          _MetricRow(
            label: 'Current session',
            value: statusLabel,
            valueColor: statusColor,
          ),
          _MetricRow(
            label: 'Subject',
            value:
                session?['subject']?.toString() ??
                'No active attendance session available',
          ),
          _MetricRow(
            label: 'Course',
            value: session?['course']?.toString() ?? '-',
          ),
          _MetricRow(
            label: 'Your state',
            value: _attendanceStateLabel(attendanceState),
          ),
        ],
      ),
    );
  }
}

class _GeoAttendStatusCard extends StatelessWidget {
  const _GeoAttendStatusCard({required this.snapshot, required this.isLoading});
  final AttendanceSecuritySnapshot? snapshot;
  final bool isLoading;
  @override
  Widget build(BuildContext context) {
    final valid = snapshot?.gpsValid == true;
    return _GlassCard(
      title: 'Geo Attend Status',
      icon: Icons.location_on_outlined,
      accent: valid ? Colors.green : Colors.orange,
      child: isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _MetricRow(
                  label: 'Coordinates',
                  value:
                      '${snapshot?.latitude.toStringAsFixed(5) ?? '-'}, ${snapshot?.longitude.toStringAsFixed(5) ?? '-'}',
                ),
                _MetricRow(
                  label: 'Radius',
                  value:
                      '${snapshot?.radiusMeters.toStringAsFixed(0) ?? '-'} m',
                ),
                _MetricRow(
                  label: 'Geofence status',
                  value: valid
                      ? 'Inside Geofence confirmed'
                      : 'Outside geofence',
                  valueColor: valid ? Colors.green : Colors.redAccent,
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
      title: 'Campus Network',
      icon: Icons.wifi_outlined,
      accent: Colors.green,
      child: Column(
        children: [
          _MetricRow(
            label: 'WiFi',
            value: snapshot?.wifiLabel ?? 'Campus network',
          ),
          _MetricRow(
            label: 'Status',
            value: snapshot?.wifiStatus ?? 'Trusted',
            valueColor: Colors.green,
          ),
        ],
      ),
    );
  }
}

class _IdentityVerificationCard extends StatelessWidget {
  const _IdentityVerificationCard({
    required this.snapshot,
    required this.sessionAvailable,
    required this.verified,
    required this.verifiedByOtp,
    required this.onFingerprint,
  });
  final AttendanceSecuritySnapshot? snapshot;
  final bool sessionAvailable;
  final bool verified;
  final bool verifiedByOtp;
  final Future<void> Function() onFingerprint;
  @override
  Widget build(BuildContext context) {
     
  
    
  final enabled = sessionAvailable && !verified;
        snapshot?.geofenceValid == true &&
        snapshot?.wifiStatus == 'Trusted' &&
        snapshot?.bleDetected == true &&
        sessionAvailable && !verified;


    return _GlassCard(
      title: 'Security Verification',
      icon: Icons.verified_user_outlined,
      accent: verified ? Colors.green : Colors.amber,
      child: Column(
        children: [
          _MetricRow(
            label: 'GPS',
            value: snapshot?.gpsValid == true ? 'Confirmed' : 'Pending',
            valueColor: snapshot?.gpsValid == true
                ? Colors.green
                : Colors.orange,
          ),
          _MetricRow(
            label: 'WiFi',
            value: snapshot?.wifiLabel ?? 'Pending',
            valueColor: snapshot?.wifiStatus == 'Trusted'
                ? Colors.green
                : Colors.orange,
          ),
          _MetricRow(
            label: 'BLE',
            value: snapshot?.bleStatus ?? 'Pending',
            valueColor: snapshot?.bleDetected == true
                ? Colors.green
                : Colors.orange,
          ),
          _MetricRow(
            label: 'Biometrics',
            value: verified
                ? (verifiedByOtp ? 'OTP verified' : 'Fingerprint verified')
                : 'Pending',
            valueColor: verified ? Colors.green : Colors.amber,
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: 128,
            height: 128,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: _primary,
                foregroundColor: Colors.white,
                shape: const CircleBorder(),
              ),
              onPressed: () async {
              print("Fingerprint button pressed");
              await onFingerprint();
              },
              child: Icon(
                verifiedByOtp ? Icons.sms_outlined : Icons.fingerprint,
                size: 64,
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: enabled
            ? () async {
            print("Scan Fingerprint pressed");
            await onFingerprint();
            }
            : null,
            icon: const Icon(Icons.fingerprint),
            label: Text(
            verified ? 'Identity Verified' : 'Scan Fingerprint',
          ),
          ),
        ],
      ),
    );
  }
}

class _AttendanceOverviewCard extends StatelessWidget {
  const _AttendanceOverviewCard({
    required this.canCheckIn,
    required this.canCheckOut,
    required this.onCheckIn,
    required this.onCheckOut,
  });
  final bool canCheckIn;
  final bool canCheckOut;
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;
  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      title: 'Attendance Actions',
      icon: Icons.touch_app_outlined,
      accent: _primary,
      child: Row(
        children: [
          Expanded(
            child: FilledButton.icon(
              onPressed: canCheckIn ? onCheckIn : null,
              icon: const Icon(Icons.login),
              label: const Text('Check In'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: canCheckOut ? onCheckOut : null,
              icon: const Icon(Icons.logout),
              label: const Text('Check Out'),
            ),
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
                CircleAvatar(
                  backgroundColor: accent.withValues(alpha: 0.12),
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
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: Color(0xFF64748B)),
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: valueColor ?? const Color(0xFF0F172A),
              ),
            ),
          ),
        ],
      ),
    );
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
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(14),
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
            style: TextStyle(
              color: accent == Colors.green
                  ? const Color(0xFFBBF7D0)
                  : Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

String _fullName(Map<String, dynamic>? user, Map<String, dynamic>? stats) {
  final statName = stats?['name']?.toString() ?? '';
  if (statName.trim().isNotEmpty) return statName;
  final fullName = user?['full_name']?.toString() ?? '';
  if (fullName.trim().isNotEmpty) return fullName;
  return user?['username']?.toString() ?? 'User';
}

String _sessionStatusLabel(Map<String, dynamic>? session) {
  if (session == null) return 'No Session';

  final state = session['attendance_state']?.toString();

  if (state == 'CHECKED_IN') {
    return 'Checked In';
  }

  if (state == 'CHECKED_OUT') {
    return 'Checked Out';
  }

  if (session['session_active'] == true) {
    return 'Active';
  }

  if (session['session_ended'] == true) {
    return 'Ended';
  }

  return 'No Session';
}

Color _sessionStatusColor(String label) {
  if (label == 'Checked In') return Colors.green;
  if (label == 'Checked Out') return Colors.blue;
  if (label == 'Pending') return Colors.orange;
  return Colors.orange;
}

String _attendanceStateLabel(AttendanceFlowState state) {
  switch (state) {
    case AttendanceFlowState.checkedIn:
      return 'Checked In';
    case AttendanceFlowState.checkedOut:
      return 'Checked Out';
    case AttendanceFlowState.notCheckedIn:
      return 'Pending';
  }
}

double _asDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}
