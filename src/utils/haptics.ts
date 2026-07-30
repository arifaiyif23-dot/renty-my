import { isNative } from '@/lib/platform';

async function nativeLight(): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* haptics not available */ }
}

async function nativeMedium(): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch { /* haptics not available */ }
}

async function nativeSuccess(): Promise<void> {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch { /* haptics not available */ }
}

async function nativeError(): Promise<void> {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Error });
  } catch { /* haptics not available */ }
}

async function nativeWarning(): Promise<void> {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Warning });
  } catch { /* haptics not available */ }
}

export const haptics = {
  light: (): void => {
    if (isNative()) { nativeLight(); return; }
    if ('vibrate' in navigator) navigator.vibrate(10);
  },

  medium: (): void => {
    if (isNative()) { nativeMedium(); return; }
    if ('vibrate' in navigator) navigator.vibrate(20);
  },

  success: (): void => {
    if (isNative()) { nativeSuccess(); return; }
    if ('vibrate' in navigator) navigator.vibrate([20, 10, 20]);
  },

  error: (): void => {
    if (isNative()) { nativeError(); return; }
    if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]);
  },

  warning: (): void => {
    if (isNative()) { nativeWarning(); return; }
    if ('vibrate' in navigator) navigator.vibrate([30, 20, 30]);
  },

  selection: (): void => {
    if (isNative()) { nativeLight(); return; }
    if ('vibrate' in navigator) navigator.vibrate(15);
  },
};