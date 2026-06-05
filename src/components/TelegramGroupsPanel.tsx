import { useEffect, useState } from "react";
import { MessageCircle, Star } from "lucide-react";
import { api, type TelegramDepartmentGroup } from "../api";

function formatDateTime(value?: string) {
  if (!value) return "активности нет";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "активности нет";
  return date.toLocaleString("ru-RU");
}

export function TelegramGroupsPanel({ compact = false }: { compact?: boolean }) {
  const [groups, setGroups] = useState<TelegramDepartmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      setGroups(await api<TelegramDepartmentGroup[]>("/api/telegram/groups"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setPrimary(group: TelegramDepartmentGroup) {
    setSavingId(group.id);
    setMessage("");
    try {
      const saved = await api<TelegramDepartmentGroup>(`/api/telegram/groups/${group.id}/primary`, { method: "POST" });
      setGroups((current) =>
        current.map((item) =>
          item.category === saved.category
            ? { ...item, isPrimary: item.id === saved.id, active: item.id === saved.id ? saved.active : item.active }
            : item
        )
      );
      setMessage(`Основной чат: ${saved.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось выбрать основной чат.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className={compact ? "panel telegramGroupsPanel compactTelegramGroups" : "panel telegramGroupsPanel"}>
      <div className="sectionTitleLine">
        <div>
          <span>Telegram</span>
          <h2>Основной чат департамента</h2>
        </div>
        <MessageCircle size={20} />
      </div>
      <p className="mutedText">Основной чат используется для аналитики, мотивации, дайджестов и анонсов планов. Если он не выбран, бот работает со всеми активными чатами департамента.</p>

      {loading ? <small>Загружаю чаты...</small> : null}
      {!loading && !groups.length ? <small>Бот пока не видел Telegram-чаты для этого департамента.</small> : null}

      <div className="telegramGroupList">
        {groups.map((group) => (
          <article className={group.isPrimary ? "telegramGroupCard primary" : "telegramGroupCard"} key={group.id}>
            <div>
              <strong>{group.title}</strong>
              <span>{group.categoryLabel || "департамент не выбран"}</span>
              <small>{group.chatId}</small>
            </div>
            <div className="tagLine">
              <span>{group.active ? "активен" : "неактивен"}</span>
              <span>{group.motivationEnabled ? "мотивация включена" : "мотивация выключена"}</span>
              <span>участников: {group.membersSeen}</span>
              <span>{formatDateTime(group.lastActivityAt)}</span>
            </div>
            <button className={group.isPrimary ? "primaryButton" : "secondaryButton"} type="button" onClick={() => setPrimary(group)} disabled={group.isPrimary || !group.active || savingId === group.id}>
              <Star size={16} />
              {savingId === group.id ? "Сохраняю..." : group.isPrimary ? "Основной" : "Сделать основным"}
            </button>
          </article>
        ))}
      </div>
      {message ? <small>{message}</small> : null}
    </section>
  );
}
