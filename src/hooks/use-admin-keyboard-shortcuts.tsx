import { useEffect, useCallback } from 'react';

interface AdminKeyboardShortcutsOptions {
  onApprove?: () => void;
  onReject?: () => void;
  onViewDocuments?: () => void;
  onNextItem?: () => void;
  onPrevItem?: () => void;
  onRefresh?: () => void;
  enabled?: boolean;
}

export function useAdminKeyboardShortcuts({
  onApprove,
  onReject,
  onViewDocuments,
  onNextItem,
  onPrevItem,
  onRefresh,
  enabled = true
}: AdminKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Ignore if modal is open (let modal handle its own shortcuts)
    if (document.querySelector('[role="dialog"]')) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'a':
        if (!e.ctrlKey && !e.metaKey && onApprove) {
          e.preventDefault();
          onApprove();
        }
        break;
      case 'r':
        if (e.shiftKey && onRefresh) {
          e.preventDefault();
          onRefresh();
        } else if (!e.ctrlKey && !e.metaKey && onReject) {
          e.preventDefault();
          onReject();
        }
        break;
      case 'v':
        if (!e.ctrlKey && !e.metaKey && onViewDocuments) {
          e.preventDefault();
          onViewDocuments();
        }
        break;
      case 'j':
      case 'arrowdown':
        if (onNextItem) {
          e.preventDefault();
          onNextItem();
        }
        break;
      case 'k':
      case 'arrowup':
        if (onPrevItem) {
          e.preventDefault();
          onPrevItem();
        }
        break;
    }
  }, [onApprove, onReject, onViewDocuments, onNextItem, onPrevItem, onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
