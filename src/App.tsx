import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { api, clearToken, getToken, type User } from "./api";
import { ShellLoading } from "./components/ShellLoading";
import { TelegramHelp } from "./components/TelegramHelp";
import { AdminDashboard } from "./pages/AdminDashboard";
import { DepartmentSelect } from "./pages/DepartmentSelect";
import { InternDashboard } from "./pages/InternDashboard";
import { LeadDashboard } from "./pages/LeadDashboard";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import type { Session } from "./session";

const roleLabels = {
  intern: "Стажер",
  lead: "Тимлид",
  admin: "Администратор"
} as const;

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
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
          <div className="avatar" style={{ background: session.user.avatarColor }}>
            {session.user.name.slice(0, 1)}
          </div>
          <div>
            <strong>{session.user.name}</strong>
            <span>{session.user.categoryLabel || roleLabels[session.user.role]}</span>
          </div>
        </div>
        {session.user.role !== "admin" && <TelegramHelp user={session.user} compact />}
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
          <InternDashboard user={session.user} />
        )}
      </section>
    </main>
  );
}
