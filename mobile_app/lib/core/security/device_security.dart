import 'dart:io';

class DeviceSecurity {
  static bool isEmulator() {
    return Platform.isAndroid && (
      const bool.fromEnvironment('dart.vm.product') == false
    );
  }

  static bool isRealDevice() {
    return !isEmulator();
  }
}