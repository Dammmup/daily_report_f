import { Bot } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { User } from "../api";

export function TelegramHelp({ user, compact = false }: { user: User; compact?: boolean }) {
  const [link, setLink] = useState<{ token: string; deeplink?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  async function createLink() {
    setLoading(true);
    try {
      setLink(await api<{ token: string; deeplink?: string | null }>("/api/me/telegram-link", { method: "POST" }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "telegramBox compact" : "telegramBox"}>
      <div>
        <Bot size={18} />
        <strong>Telegram</strong>
      </div>
      <span>{user.telegramLinked ? "Чат привязан" : "Создайте одноразовую ссылку для привязки:"}</span>
      {!user.telegramLinked && (
        <>
          <button className="secondaryButton" type="button" onClick={createLink} disabled={loading}>
            {loading ? "Создаю..." : "Создать ссылку"}
          </button>
          {link?.deeplink ? (
            <a className="telegramLinkButton" href={link.deeplink} target="_blank" rel="noreferrer">
              Открыть бота
            </a>
          ) : link?.token ? (
            <code>/start {link.token}</code>
          ) : null}
        </>
      )}
      {user.role === "intern" ? <code>/report вчера | план | блокеры</code> : <code>/summary</code>}
    </div>
  );
}
