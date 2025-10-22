/**
 * Haptic feedback utilities for mobile devices
 * Provides tactile feedback for user interactions
 */

export const haptics = {
  /**
   * Light haptic feedback for subtle interactions
   * Usage: Button taps, list item selections
   */
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium haptic feedback for important interactions
   * Usage: Toggle switches, confirmations
   */
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },

  /**
   * Success haptic pattern
   * Usage: Successful actions, completions
   */
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 10, 20]);
    }
  },

  /**
   * Error haptic pattern
   * Usage: Errors, failed actions
   */
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }
  },

  /**
   * Warning haptic pattern
   * Usage: Warnings, important notices
   */
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 20, 30]);
    }
  },

  /**
   * Selection haptic feedback
   * Usage: Selecting items, navigation
   */
  selection: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  },
};
