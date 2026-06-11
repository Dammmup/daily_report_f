import { useEffect, useState } from "react";
import { Webhook } from "lucide-react";
import { api } from "../api";

type WebhookInfo = {
  secretConfigured: boolean;
  botMode: string;
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage?: string;
};

// Админ-панель статуса Telegram-вебхука: показывает, подключён ли вебхук, и даёт переустановить его.
// На Vercel бот работает через вебхук (polling недоступен), поэтому без регистрации бот молчит.
export function TelegramWebhookPanel() {
  const [info, setInfo] = useState<WebhookInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      setInfo(await api<WebhookInfo>("/api/telegram/webhook/info"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось получить статус вебхука");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setup() {
    setBusy(true);
    setMessage("");
    try {
      await api("/api/telegram/webhook/setup", { method: "POST" });
      setMessage("Вебхук переустановлен. Бот должен начать получать сообщения.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось настроить вебхук");
    } finally {
      setBusy(false);
    }
  }

  const connected = Boolean(info?.url);

  return (
    <section className="panel telegramGroupsPanel">
      <div className="sectionTitleLine">
        <div>
          <span>Telegram</span>
          <h2>Вебхук бота</h2>
        </div>
        <Webhook size={20} />
      </div>
      <p className="mutedText">
        На Vercel бот получает сообщения через вебхук (polling недоступен). Если бот не отвечает — переустановите вебхук.
      </p>

      {loading ? (
        <small>Загружаю статус...</small>
      ) : info ? (
        <div className="telegramGroupCard">
          <div className="tagLine">
            <span>{connected ? "вебхук подключён" : "вебхук не настроен"}</span>
            <span>секрет: {info.secretConfigured ? "задан" : "не задан"}</span>
            <span>в очереди: {info.pendingUpdateCount}</span>
          </div>
          {info.url ? <small>{info.url}</small> : null}
          {info.lastErrorMessage ? <small>Последняя ошибка: {info.lastErrorMessage}</small> : null}
        </div>
      ) : null}

      <button className="secondaryButton" type="button" onClick={setup} disabled={busy}>
        {busy ? "Настраиваю..." : connected ? "Переустановить вебхук" : "Подключить вебхук"}
      </button>
      {message ? <small>{message}</small> : null}
    </section>
  );
}
