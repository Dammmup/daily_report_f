import { Bell, Bot, CalendarDays, ClipboardList, ImagePlus, LayoutDashboard, LogOut, Search, Settings, ShieldCheck, UserRound, Users, X } from "lucide-react";
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
  const [activeNav, setActiveNav] = useState("dashboard");
  const [oauthToast, setOauthToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Обработка OAuth redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integration");
    const status = params.get("status");
    if (integration && status) {
      const providerNames: Record<string, string> = {
        google_drive: "Google Drive",
        notion: "Notion",
        trello: "Trello"
      };
      const label = providerNames[integration] || integration;
      if (status === "connected") {
        setOauthToast({ message: `${label} успешно подключен!`, type: "success" });
      } else {
        const errorMessage = params.get("message") || "Не удалось подключить";
        setOauthToast({ message: `${label}: ${errorMessage}`, type: "error" });
      }
      // Очищаем URL params
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

  useEffect(() => {
    const token = getToken() || "";
    api<{ user: User }>("/api/me")
      .then(({ user }) => setSession({ token, user }))
      .catch(() => {
        clearToken();
        const initData = getTelegramInitData();
        if (!initData) return;

        return api<Session>("/api/telegram/mini-app-session", {
          method: "POST",
          body: JSON.stringify({ initData })
        })
          .then((telegramSession) => {
            setToken(telegramSession.token);
            setSession(telegramSession);
          })
          .catch(() => undefined);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ShellLoading />;
  if (!session) return <Login onLogin={setSession} />;

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    clearToken();
    setSession(null);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const navItems = getNavItems(session.user.role);
  const navigate = (key: string) => {
    setActiveNav(key);
    if (key === "profile") {
      setProfileOpen(true);
    }
    window.dispatchEvent(new CustomEvent("dailyreport:navigate", { detail: key }));
    scrollToTop();
  };

  return (
    <main className="app">
      {oauthToast && <OAuthToast message={oauthToast.message} type={oauthToast.type} onClose={() => setOauthToast(null)} />}
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">DR</div>
          <div>
            <strong>DailyReport ERP</strong>
            <span>AI project manager</span>
          </div>
        </div>
        <nav className="sideNav" aria-label="Основные разделы">
          {navItems.map((item) => (
            <button className={activeNav === item.key ? "active" : ""} type="button" key={item.key} onClick={() => navigate(item.key)}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sideTools">
          {session.user.role !== "admin" && <TelegramHelp user={session.user} compact />}
          <button className="ghostButton" onClick={() => setProfileOpen((value) => !value)}>
            <Settings size={18} />
            Профиль и пароль
          </button>
        </div>
        {profileOpen && <ProfileSettings user={session.user} onUser={(user) => setSession({ ...session, user })} onClose={() => setProfileOpen(false)} />}
        <div className="sideAccount">
          {session.user.avatarUrl ? <img className="avatar" src={session.user.avatarUrl} alt={session.user.name} /> : <div className="avatar" style={{ background: session.user.avatarColor }}>{session.user.name.slice(0, 1)}</div>}
          <div>
            <strong>{session.user.name}</strong>
            <span>{session.user.categoryLabel || roleLabels[session.user.role]}</span>
          </div>
          <button className="iconButton" type="button" onClick={logout} aria-label="Выйти">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topCommandBar">
          <label className="topSearch">
            <Search size={16} />
            <input aria-label="Поиск по платформе" placeholder="Поиск стажера, плана, шага..." />
            <kbd>⌘K</kbd>
          </label>
          <div className="topBarActions">
            <button className="iconButton" type="button" aria-label="AI ассистент">
              <Bot size={17} />
            </button>
            <button className="iconButton" type="button" aria-label="Уведомления">
              <Bell size={17} />
            </button>
            <button className="topUserPill" type="button" onClick={() => setProfileOpen((value) => !value)}>
              {session.user.avatarUrl ? <img className="avatar small" src={session.user.avatarUrl} alt={session.user.name} /> : <span className="avatar small" style={{ background: session.user.avatarColor }}>{session.user.name.slice(0, 1)}</span>}
              <span>{session.user.name}</span>
            </button>
          </div>
        </header>
        <div className="workspaceFrame">
          {session.user.role === "admin" ? (
            <AdminDashboard user={session.user} />
          ) : !session.user.category ? (
            <DepartmentSelect user={session.user} onDone={(user) => setSession({ ...session, user })} />
          ) : session.user.role === "intern" && !session.user.firstLoginCompleted ? (
            <Onboarding session={session} onDone={(user) => setSession({ ...session, user })} />
          ) : session.user.role === "lead" ? (
            <LeadDashboard user={session.user} />
          ) : (
            <InternDashboard user={session.user} onUser={(user) => setSession({ ...session, user })} />
          )}
        </div>
      </section>
      <MobileBottomNav role={session.user.role} onProfile={() => setProfileOpen((value) => !value)} onTop={scrollToTop} onLogout={logout} />
    </main>
  );
}

function getNavItems(role: User["role"]) {
  if (role === "admin") {
    return [
      { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
      { key: "users", label: "Пользователи", icon: <Users size={17} /> },
      { key: "plans", label: "Планы", icon: <ClipboardList size={17} /> },
      { key: "ai", label: "AI центр", icon: <ShieldCheck size={17} /> },
      { key: "office", label: "Офис", icon: <CalendarDays size={17} /> }
    ];
  }

  if (role === "lead") {
    return [
      { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
      { key: "interns", label: "Стажеры", icon: <Users size={17} /> },
      { key: "plans", label: "Планы", icon: <ClipboardList size={17} /> },
      { key: "ai", label: "AI подбор", icon: <Bot size={17} /> },
      { key: "automation", label: "Настройки", icon: <Settings size={17} /> }
    ];
  }

  return [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
    { key: "steps", label: "Мои шаги", icon: <ClipboardList size={17} /> },
    { key: "daily", label: "Дэйлик", icon: <CalendarDays size={17} /> },
    { key: "ai-profile", label: "AI профиль", icon: <Bot size={17} /> },
    { key: "profile", label: "Профиль", icon: <UserRound size={17} /> }
  ];
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

function ProfileSettings({ user, onUser, onClose }: { user: User; onUser: (user: User) => void; onClose: () => void }) {
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
      <aside className="profileSettingsMenu">
        <div className="profileSettingsAvatar">
          {form.avatarUrl ? <img className="avatar" src={form.avatarUrl} alt={form.name} /> : <span className="avatar" style={{ background: form.avatarColor }}>{form.name.slice(0, 1)}</span>}
          <div>
            <strong>{user.name}</strong>
            <span>{user.categoryLabel || roleLabels[user.role]}</span>
          </div>
        </div>
        <button className="active" type="button"><UserRound size={16} /> Аккаунт</button>
        <button type="button"><Settings size={16} /> Безопасность</button>
        <button type="button"><Bot size={16} /> Telegram</button>
      </aside>
      <div className="profileSettingsContent">
        <div className="homeSectionHeader compact">
          <div>
            <span>Settings</span>
            <h2>Профиль и безопасность</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="Закрыть настройки">
            <X size={18} />
          </button>
        </div>
        <form className="settingsFormCard" onSubmit={saveProfile}>
          <div className="settingsFormGrid">
            <label>
              Имя
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Имя" />
            </label>
            <label>
              Цвет аватарки
              <input value={form.avatarColor} onChange={(event) => setForm({ ...form, avatarColor: event.target.value })} placeholder="#10765a" />
            </label>
          </div>
          <label className="fileButton profileUploadButton">
            <ImagePlus size={16} />
            {uploading ? "Загружаю..." : "Загрузить аватар"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => uploadAvatar(event.target.files?.[0])} disabled={uploading} />
          </label>
          <label>
            Ссылка на аватар
            <input value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} placeholder="https://..." />
          </label>
          <label>
            О себе
            <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="Коротко о роли, навыках или фокусе" />
          </label>
          <button className="secondaryButton">Сохранить профиль</button>
        </form>
        <form className="settingsFormCard" onSubmit={changePassword}>
          <h3>Смена пароля</h3>
          <div className="settingsFormGrid">
            <label>
              Текущий пароль
              <input type="password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} placeholder="Текущий пароль" />
            </label>
            <label>
              Новый пароль
              <input type="password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} placeholder="Новый пароль" />
            </label>
          </div>
          <button className="secondaryButton">Сменить пароль</button>
        </form>
        {message && <small className="successText">{message}</small>}
      </div>
    </div>
  );
}

function OAuthToast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`oauthToast ${type}`} onClick={onClose}>
      <span>{type === "success" ? "✅" : "❌"}</span>
      <span>{message}</span>
      <button type="button" className="oauthToastClose">×</button>
    </div>
  );
}
