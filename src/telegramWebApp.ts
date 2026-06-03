type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function initTelegramWebApp() {
  const webApp = window.Telegram?.WebApp;
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) event.preventDefault();
    },
    { passive: false }
  );

  if (!webApp) return;

  webApp.ready?.();
  webApp.expand?.();
  webApp.disableVerticalSwipes?.();
}

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData || "";
}
