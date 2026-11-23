/**
 * Universal Fullscreen Utility
 * Provides cross-browser, cross-webview (WebKit, Blink, Gecko, WebView2, Tauri)
 * fullscreen toggle with automatic fallbacks.
 */

export async function requestFullscreenSafe(element: HTMLElement = document.documentElement): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  // 1. Try Tauri native window fullscreen if available
  try {
    const tauriWindow = (window as any).__TAURI__?.window?.getCurrentWindow?.();
    if (tauriWindow && typeof tauriWindow.setFullscreen === 'function') {
      await tauriWindow.setFullscreen(true);
      return true;
    }
  } catch {
    // Continue to standard DOM API
  }

  // 2. Try standard or vendor-prefixed DOM requestFullscreen
  try {
    const el = element as any;
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return true;
    } else if (el.mozRequestFullScreen) {
      await el.mozRequestFullScreen();
      return true;
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
      return true;
    }
  } catch (err) {
    console.warn('[Fullscreen] Native requestFullscreen blocked or unsupported:', err);
  }

  // Return false if native fullscreen could not be activated (caller can apply CSS fallback)
  return false;
}

export async function exitFullscreenSafe(): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  // 1. Try Tauri native window
  try {
    const tauriWindow = (window as any).__TAURI__?.window?.getCurrentWindow?.();
    if (tauriWindow && typeof tauriWindow.setFullscreen === 'function') {
      await tauriWindow.setFullscreen(false);
      return true;
    }
  } catch {
    // Continue to standard DOM API
  }

  // 2. Try standard or vendor-prefixed DOM exitFullscreen
  try {
    const doc = document as any;
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
      return true;
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
      return true;
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
      return true;
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
      return true;
    }
  } catch (err) {
    console.warn('[Fullscreen] Native exitFullscreen error:', err);
  }

  return false;
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}
