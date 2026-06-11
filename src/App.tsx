import { Bell, Bot, CalendarDays, ClipboardList, History, ImagePlus, LayoutDashboard, LogOut, MapPin, Search, Settings, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken, uploadFile, type User } from "./api";
import { ShellLoading } from "./components/ShellLoading";
import { TelegramHelp } from "./components/TelegramHelp";
import { TelegramGroupsPanel } from "./components/TelegramGroupsPanel";
import { TelegramWebhookPanel } from "./components/TelegramWebhookPanel";
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

  };

  return (
    <main className="app">
      {oauthToast && <OAuthToast message={oauthToast.message} type={oauthToast.type} onClose={() => setOauthToast(null)} />}
      <header className="topNavigation">
        <div className="brand">
          <div className="brandMark">DR</div>
          <div>
            <strong>DailyReport</strong>
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
          <label className="topSearch" title="Глобальный поиск">
            <Search size={16} />
            <input aria-label="Поиск по платформе" placeholder="Поиск..." />
            <kbd>⌘K</kbd>
          </label>
          <button className="iconButton" type="button" aria-label="AI ассистент" title="AI ассистент" onClick={() => window.dispatchEvent(new CustomEvent("dailyreport:openAiDialog"))}>
            <Bot size={17} />
          </button>
          <button className="iconButton" type="button" aria-label="Уведомления" title="Уведомления">
            <Bell size={17} />
          </button>
          <button className="topUserPill" type="button" onClick={() => setProfileOpen((value) => !value)} title="Мой профиль">
            {session.user.avatarUrl ? <img className="avatar small" src={session.user.avatarUrl} alt={session.user.name} /> : <span className="avatar small" style={{ background: session.user.avatarColor }}>{session.user.name.slice(0, 1)}</span>}
            <span>{session.user.name.split(' ')[0]}</span>
          </button>
          <button className="iconButton" type="button" onClick={logout} aria-label="Выйти" title="Выйти">
            <LogOut size={17} />
          </button>
        </div>
        {profileOpen && <ProfileSettings user={session.user} onUser={(user) => setSession({ ...session, user })} onClose={() => setProfileOpen(false)} />}
      </header>
      <section className="workspace">
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
      { key: "office", label: "Офис", icon: <MapPin size={17} /> },
      { key: "audit", label: "Журнал", icon: <History size={17} /> }
    ];
  }

  if (role === "lead") {
    return [
      { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
      { key: "interns", label: "Стажеры", icon: <Users size={17} /> },
      { key: "plans", label: "Планы", icon: <ClipboardList size={17} /> },
      { key: "automation", label: "Автоматизация", icon: <Bot size={17} /> },
      { key: "ai", label: "AI центр", icon: <ShieldCheck size={17} /> },
      { key: "settings", label: "Настройки", icon: <Settings size={17} /> }
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

function PasswordStrengthIndicator({ password }: { password: string }) {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  const strength = [hasMinLength, hasUppercase, hasLowercase, hasNumber].filter(Boolean).length;
  let strengthLabel = "Слабый пароль.";
  let strengthColor = "#ef4444";
  if (strength === 4) {
    strengthLabel = "Отличный пароль.";
    strengthColor = "#10b981";
  } else if (strength >= 2) {
    strengthLabel = "Нормальный пароль.";
    strengthColor = "#f59e0b";
  }

  if (!password) return null;

  return (
    <div className="passwordStrength">
      <div className="strengthBars">
        <div className="bar" style={{ background: strength >= 1 ? strengthColor : "#e2e8f0" }}></div>
        <div className="bar" style={{ background: strength >= 2 ? strengthColor : "#e2e8f0" }}></div>
        <div className="bar" style={{ background: strength >= 3 ? strengthColor : "#e2e8f0" }}></div>
        <div className="bar" style={{ background: strength >= 4 ? strengthColor : "#e2e8f0" }}></div>
      </div>
      <p style={{ color: strengthColor, fontWeight: 600, fontSize: "12px", margin: "6px 0" }}>{strengthLabel} Должен содержать:</p>
      <div className="strengthChecks">
        <span className={hasMinLength ? "passed" : ""}>✓ Минимум 8 символов</span>
        <span className={hasNumber ? "passed" : ""}>✓ Цифру (0-9)</span>
        <span className={hasUppercase ? "passed" : ""}>✓ Заглавную букву (A-Z)</span>
        <span className={hasLowercase ? "passed" : ""}>✓ Строчную букву (a-z)</span>
      </div>
    </div>
  );
}

function ProfileSettings({ user, onUser, onClose }: { user: User; onUser: (user: User) => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: user.name, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl || "", bio: user.bio || "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<"account" | "security" | "telegram">("account");

  const subtitle = user.categoryLabel || roleLabels[user.role];
  const sectionTitle = activeSection === "account" ? "Профиль" : activeSection === "security" ? "Безопасность" : "Telegram";

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const result = await api<{ user: User }>("/api/me", { method: "PATCH", body: JSON.stringify(form) });
    onUser(result.user);
    setMessage("Профиль обновлен");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      setMessage("Новые пароли не совпадают");
      return;
    }
    const result = await api<{ ok: boolean; token?: string }>("/api/me/password", { method: "PATCH", body: JSON.stringify({ currentPassword: password.currentPassword, newPassword: password.newPassword }) });
    if (result.token) setToken(result.token);
    setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
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
    <div className="profileSettingsBackdrop" role="presentation" onMouseDown={onClose}>
      <div className="profileSettings" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <aside className="profileSettingsMenu">
          <div className="profileSettingsAvatar">
            {form.avatarUrl ? <img className="avatar" src={form.avatarUrl} alt={form.name} /> : <span className="avatar" style={{ background: form.avatarColor }}>{form.name.slice(0, 1)}</span>}
            <div>
              <strong>{user.name}</strong>
              {subtitle && subtitle !== user.name && <span>{subtitle}</span>}
            </div>
          </div>
          <button className={activeSection === "account" ? "active" : ""} type="button" onClick={() => setActiveSection("account")}><UserRound size={16} /> Аккаунт</button>
          <button className={activeSection === "security" ? "active" : ""} type="button" onClick={() => setActiveSection("security")}><Settings size={16} /> Безопасность</button>
          <button className={activeSection === "telegram" ? "active" : ""} type="button" onClick={() => setActiveSection("telegram")}><Bot size={16} /> Telegram</button>
        </aside>
        <div className="profileSettingsContent">
          <div className="homeSectionHeader compact settingsHeader">
            <div>
              <span>Настройки</span>
              <h2>{sectionTitle}</h2>
            </div>
            <button className="iconButton" type="button" onClick={onClose} aria-label="Закрыть настройки">
              <X size={18} />
            </button>
          </div>

          {activeSection === "account" && (
            <form className="settingsFormCard" onSubmit={saveProfile}>
              <div className="settingsFormGrid">
                <label>
                  Имя <span className="required">*</span>
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Имя" required />
                </label>
                <label>
                  Цвет аватарки
                  <input value={form.avatarColor} onChange={(event) => setForm({ ...form, avatarColor: event.target.value })} placeholder="#10765a" />
                </label>
                <label>
                  Загрузить аватар
                  <div className="fileButton profileUploadButton" onClick={() => document.getElementById("avatarUpload")?.click()}>
                    <ImagePlus size={16} />
                    {uploading ? "Загружаю..." : "Выбрать файл..."}
                    <input id="avatarUpload" type="file" style={{ display: "none" }} accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => uploadAvatar(event.target.files?.[0])} disabled={uploading} />
                  </div>
                </label>
                <label>
                  Ссылка на аватар
                  <input value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} placeholder="https://..." />
                </label>
              </div>
              <label style={{ display: "block", marginTop: "16px" }}>
                О себе
                <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="Коротко о роли, навыках или фокусе" />
              </label>
              <div style={{ marginTop: "16px" }}>
                <button className="secondaryButton">Сохранить изменения</button>
              </div>
            </form>
          )}

          {activeSection === "security" && (
            <form className="settingsFormCard" onSubmit={changePassword}>
              <h3>Смена пароля</h3>
              <div className="settingsFormGrid">
                <label>
                  Текущий пароль <span className="required">*</span>
                  <input type="password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} placeholder="••••••••" required />
                </label>
                <div></div>
                <label>
                  Новый пароль <span className="required">*</span>
                  <input type="password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} placeholder="••••••••" required />
                </label>
                <label>
                  Подтвердите пароль <span className="required">*</span>
                  <input type="password" value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} placeholder="••••••••" required />
                </label>
              </div>
              <PasswordStrengthIndicator password={password.newPassword} />
              <div style={{ marginTop: "16px" }}>
                <button className="secondaryButton">Сменить пароль</button>
              </div>
            </form>
          )}

          {activeSection === "telegram" && (
            <div className="settingsTelegramSection">
              <TelegramHelp user={user} compact />
              {user.role === "admin" && <TelegramWebhookPanel />}
              {(user.role === "lead" || user.role === "admin") && <TelegramGroupsPanel />}
            </div>
          )}

          {message && <small className="successText">{message}</small>}
        </div>
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
