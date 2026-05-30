import { Bot } from "lucide-react";
import type { User } from "../api";

export function TelegramHelp({ user, compact = false }: { user: User; compact?: boolean }) {
  return (
    <div className={compact ? "telegramBox compact" : "telegramBox"}>
      <div>
        <Bot size={18} />
        <strong>Telegram</strong>
      </div>
      <span>{user.telegramLinked ? "Чат привязан" : "Привяжите чат командой:"}</span>
      <code>/link {user.email}</code>
      {user.role === "intern" ? <code>/report вчера | план | блокеры</code> : <code>/summary</code>}
    </div>
  );
}
