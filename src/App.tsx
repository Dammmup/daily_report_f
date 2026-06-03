import { ImagePlus, LogOut, Settings } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken, uploadFile, type User } from "./api";
import { ShellLoading } from "./components/ShellLoading";
import { TelegramHelp } from "./components/TelegramHelp";
import { AdminDashboard } from "./pages/AdminDashboard";
import { DepartmentSelect } from "./pages/DepartmentSelect";
import { InternDashboard } from "./pages/InternDashboard";
import { LeadDashboard } from "./pages/LeadDashboard";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import type { Session } from "./session";
import { getTelegramInitData } from "./telegramWebApp";

const roleLabels = {
  intern: "Стажер",
  lead: "Тимлид",
  admin: "Администратор"
} as const;

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      const initData = getTelegramInitData();
      if (!initData) {
        setLoading(false);
        return;
      }

      api<Session>("/api/telegram/mini-app-session", {
        method: "POST",
        body: JSON.stringify({ initData })
      })
        .then((telegramSession) => {
          setToken(telegramSession.token);
          setSession(telegramSession);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
      return;
    }

    api<{ user: User }>("/api/me")
      .then(({ user }) => setSession({ token, user }))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ShellLoading />;
  if (!session) return <Login onLogin={setSession} />;

  const logout = () => {
    clearToken();
    setSession(null);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">DR</div>
          <div>
            <strong>DailyReport ERP</strong>
            <span>MongoDB + Telegram</span>
          </div>
        </div>
        <div className="profile">
          {session.user.avatarUrl ? <img className="avatar" src={session.user.avatarUrl} alt={session.user.name} /> : <div className="avatar" style={{ background: session.user.avatarColor }}>{session.user.name.slice(0, 1)}</div>}
          <div>
            <strong>{session.user.name}</strong>
            <span>{session.user.categoryLabel || roleLabels[session.user.role]}</span>
          </div>
        </div>
        {session.user.role !== "admin" && <TelegramHelp user={session.user} compact />}
        <button className="ghostButton" onClick={() => setProfileOpen((value) => !value)}>
          <Settings size={18} />
          Профиль
        </button>
        {profileOpen && <ProfileSettings user={session.user} onUser={(user) => setSession({ ...session, user })} />}
        <button className="ghostButton" onClick={logout}>
          <LogOut size={18} />
          Выйти
        </button>
      </aside>
      <section className="workspace">
        {session.user.role === "admin" ? (
          <AdminDashboard />
        ) : !session.user.category ? (
          <DepartmentSelect user={session.user} onDone={(user) => setSession({ ...session, user })} />
        ) : session.user.role === "intern" && !session.user.firstLoginCompleted ? (
          <Onboarding session={session} onDone={(user) => setSession({ ...session, user })} />
        ) : session.user.role === "lead" ? (
          <LeadDashboard user={session.user} />
        ) : (
          <InternDashboard user={session.user} onUser={(user) => setSession({ ...session, user })} />
        )}
      </section>
      <MobileBottomNav role={session.user.role} onProfile={() => setProfileOpen((value) => !value)} onTop={scrollToTop} onLogout={logout} />
    </main>
  );
}

function MobileBottomNav({ role, onProfile, onTop, onLogout }: { role: User["role"]; onProfile: () => void; onTop: () => void; onLogout: () => void }) {
  return (
    <nav className="mobileBottomNav" aria-label="Быстрая навигация">
      <button type="button" onClick={onTop}>
        Главная
      </button>
      <button type="button" onClick={onProfile}>
        Профиль
      </button>
      {role === "intern" ? (
        <button type="button" onClick={() => document.querySelector("form.panel")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          Дэйлик
        </button>
      ) : (
        <button type="button" onClick={() => document.querySelector(".tabs")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          Разделы
        </button>
      )}
      <button type="button" onClick={onLogout}>
        Выход
      </button>
    </nav>
  );
}

function ProfileSettings({ user, onUser }: { user: User; onUser: (user: User) => void }) {
  const [form, setForm] = useState({ name: user.name, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl || "", bio: user.bio || "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const result = await api<{ user: User }>("/api/me", { method: "PATCH", body: JSON.stringify(form) });
    onUser(result.user);
    setMessage("Профиль обновлен");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    await api("/api/me/password", { method: "PATCH", body: JSON.stringify(password) });
    setPassword({ currentPassword: "", newPassword: "" });
    setMessage("Пароль изменен");
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, "avatar");
      setForm((current) => ({ ...current, avatarUrl: uploaded.url }));
      setMessage("Аватар загружен. Сохраните профиль, чтобы закрепить его.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="profileSettings">
      <form onSubmit={saveProfile}>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Имя" />
        <label className="fileButton">
          <ImagePlus size={16} />
          {uploading ? "Загружаю..." : "Загрузить аватар"}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => uploadAvatar(event.target.files?.[0])} disabled={uploading} />
        </label>
        <input value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} placeholder="Ссылка на аватар" />
        <input value={form.avatarColor} onChange={(event) => setForm({ ...form, avatarColor: event.target.value })} placeholder="#10765a" />
        <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="О себе" />
        <button className="secondaryButton">Сохранить профиль</button>
      </form>
      <form onSubmit={changePassword}>
        <input type="password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} placeholder="Текущий пароль" />
        <input type="password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} placeholder="Новый пароль" />
        <button className="secondaryButton">Сменить пароль</button>
      </form>
      {message && <small>{message}</small>}
    </div>
  );
}
