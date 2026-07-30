let _isNative: boolean | null = null;

export function isNative(): boolean {
  if (_isNative !== null) return _isNative;
  try {
    _isNative = !!(window as Record<string, unknown>).Capacitor?.isNative;
  } catch {
    _isNative = false;
  }
  return _isNative;
}

export function isWeb(): boolean {
  return !isNative();
}