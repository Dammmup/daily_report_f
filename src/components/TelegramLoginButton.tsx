import { useEffect, useRef } from "react";
import { api, setToken } from "../api";
import type { Session } from "../session";

// Кнопка «Войти через Telegram» (Telegram Login Widget).
// Требует:
//  - VITE_TELEGRAM_BOT_USERNAME в окружении фронтенда (имя бота без @);
//  - привязанный домен у бота в BotFather (/setdomain → домен фронтенда);
//  - заданный TELEGRAM_BOT_TOKEN на бэкенде (для проверки подписи).
export function TelegramLoginButton({ onLogin, onError }: { onLogin: (session: Session) => void; onError: (message: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    (window as unknown as { onTelegramAuth?: (user: Record<string, unknown>) => void }).onTelegramAuth = async (user) => {
      try {
        const session = await api<Session>("/api/auth/telegram", { method: "POST", body: JSON.stringify(user) });
        setToken(session.token);
        onLogin(session);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Не удалось войти через Telegram");
      }
    };

    const container = containerRef.current;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [botUsername, onLogin, onError]);

  if (!botUsername) return null;
  return <div ref={containerRef} className="telegramLoginButton" />;
}
