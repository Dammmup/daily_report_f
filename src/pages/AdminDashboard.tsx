import { BarChart3, BrainCircuit, CalendarCheck, ChevronLeft, ClipboardList, ShieldCheck, Sparkles, UserCog, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type AiSummary, type Category, type Dashboard, type InternProfile, type Plan, type Role, type User } from "../api";
import { AiAssistantDialog } from "../components/AiAssistantDialog";
import { Header } from "../components/Header";
import { Metric } from "../components/Metric";
import { ReportList } from "../components/ReportList";
import { ShellLoading } from "../components/ShellLoading";
import { categoryOptions } from "../constants";

type DraftUser = User & {
  draftRole: Role;
  draftCategory: Category | "";
};

type AdminPlan = Plan & {
  lead?: User;
};

const roleLabels: Record<Role, string> = {
  intern: "Стажер",
  lead: "Тимлид",
  admin: "Админ"
};

export function AdminDashboard() {
  const [users, setUsers] = useState<DraftUser[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [selectedIntern, setSelectedIntern] = useState<InternProfile | null>(null);
  const [tab, setTab] = useState<"users" | "overview" | "ai" | "plans">("users");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function refresh() {
    const [userList, dashboardData, summaryData, planList] = await Promise.all([
      api<User[]>("/api/admin/users"),
      api<Dashboard>("/api/admin/dashboard"),
      api<AiSummary>("/api/admin/ai-summary"),
      api<AdminPlan[]>("/api/admin/plans")
    ]);
    setUsers(userList.map((user) => ({ ...user, draftRole: user.role, draftCategory: user.category || "" })));
    setDashboard(dashboardData);
    setAiSummary(summaryData);
    setPlans(planList);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  function patchDraft(id: string, patch: Partial<DraftUser>) {
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  }

  async function save(user: DraftUser) {
    setSavingId(user.id);
    try {
      const result = await api<{ user: User }>(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: user.draftRole,
          category: user.draftCategory || null
        })
      });
      patchDraft(user.id, {
        ...result.user,
        draftRole: result.user.role,
        draftCategory: result.user.category || ""
      });
      await refresh();
    } finally {
      setSavingId(null);
    }
  }

  async function openIntern(id: string) {
    setSelectedIntern(await api<InternProfile>(`/api/admin/interns/${id}`));
  }

  if (loading || !dashboard || !aiSummary) return <ShellLoading />;
  if (selectedIntern) return <InternProfileView profile={selectedIntern} onBack={() => setSelectedIntern(null)} />;

  return (
    <section className="flow">
      <Header eyebrow="Админка" title="Контроль платформы" icon={<ShieldCheck />} />
      <AiAssistantDialog plans={plans.map((plan) => ({ ...plan, categoryLabel: categoryOptions.find((category) => category.value === plan.category)?.label }))} />

      <div className="metrics">
        <Metric icon={<Users />} label="Пользователей" value={users.length} />
        <Metric icon={<UserCog />} label="Тимлидов" value={users.filter((user) => user.role === "lead").length} />
        <Metric icon={<Sparkles />} label="AI отчетов" value={dashboard.stats.aiReviewedReports} />
        <Metric icon={<ClipboardList />} label="Планов" value={plans.length} />
      </div>

      <div className="tabs adminTabs">
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Пользователи
        </button>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          Обзор
        </button>
        <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>
          AI-сводка
        </button>
        <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}>
          Планы
        </button>
      </div>

      {tab === "users" && <UsersAccess users={users} savingId={savingId} onPatch={patchDraft} onSave={save} onOpenIntern={openIntern} />}
      {tab === "overview" && <Overview dashboard={dashboard} onOpenIntern={openIntern} />}
      {tab === "ai" && <AiSummaryView summary={aiSummary} onOpenIntern={openIntern} />}
      {tab === "plans" && <PlansView plans={plans} />}
    </section>
  );
}

function UsersAccess({
  users,
  savingId,
  onPatch,
  onSave,
  onOpenIntern
}: {
  users: DraftUser[];
  savingId: string | null;
  onPatch: (id: string, patch: Partial<DraftUser>) => void;
  onSave: (user: DraftUser) => void;
  onOpenIntern: (id: string) => void;
}) {
  return (
    <section className="panel tablePanel">
      <h2>Управление доступом</h2>
      <div className="adminTable">
        {users.map((user) => (
          <article className="adminRow" key={user.id}>
            <button className="person clickablePerson" onClick={() => user.role === "intern" && onOpenIntern(user.id)} disabled={user.role !== "intern"}>
              <div className="avatar small" style={{ background: user.avatarColor }}>
                {user.name.slice(0, 1)}
              </div>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email || "без email"}</span>
              </div>
            </button>

            <label>
              Роль
              <select value={user.draftRole} onChange={(event) => onPatch(user.id, { draftRole: event.target.value as Role })}>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Департамент
              <select value={user.draftCategory} onChange={(event) => onPatch(user.id, { draftCategory: event.target.value as Category | "" })}>
                <option value="">Не выбран</option>
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="secondaryButton" onClick={() => onSave(user)} disabled={savingId === user.id}>
              {savingId === user.id ? "Сохраняю..." : "Сохранить"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Overview({ dashboard, onOpenIntern }: { dashboard: Dashboard; onOpenIntern: (id: string) => void }) {
  return (
    <>
      <div className="metrics">
        <Metric icon={<Users />} label="Стажеров" value={dashboard.stats.internsTotal} />
        <Metric icon={<CalendarCheck />} label="Отметились сегодня" value={dashboard.stats.checkedInToday} />
        <Metric icon={<Sparkles />} label="AI проверок" value={dashboard.stats.aiReviewedReports} />
        <Metric icon={<BarChart3 />} label="Средний балл" value={`${dashboard.stats.averageScore}%`} />
      </div>

      <section className="categoryGrid">
        {dashboard.stats.byCategory.map((category) => (
          <article className="panel mini" key={category.key}>
            <strong>{category.label}</strong>
            <span>{category.interns} стажеров</span>
            <div className="bar">
              <i style={{ width: `${category.averageScore}%` }} />
            </div>
            <small>{category.averageScore}% средняя продуктивность</small>
          </article>
        ))}
      </section>

      <section className="panel tablePanel">
        <h2>Все стажеры</h2>
        <div className="table">
          {dashboard.interns.map((intern) => (
            <button className="row clickableRow" key={intern.id} onClick={() => onOpenIntern(intern.id)}>
              <div className="person">
                <div className="avatar small" style={{ background: intern.avatarColor }}>
                  {intern.name.slice(0, 1)}
                </div>
                <div>
                  <strong>{intern.name}</strong>
                  <span>{intern.categoryLabel || "департамент не выбран"}</span>
                </div>
              </div>
              <span className={intern.activeToday ? "status ok" : "status"}>{intern.activeToday ? "онлайн сегодня" : "нет отметки"}</span>
              <span>{intern.reportsCount} отчетов</span>
              <strong>{intern.averageScore}%</strong>
            </button>
          ))}
        </div>
      </section>

      <ReportList reports={dashboard.reports} />
    </>
  );
}

function AiSummaryView({ summary, onOpenIntern }: { summary: AiSummary; onOpenIntern: (id: string) => void }) {
  return (
    <section className="internCardGrid">
      {summary.interns.map((intern) => (
        <button className="internAiCard" key={intern.user.id} onClick={() => onOpenIntern(intern.user.id)}>
          <div className="person">
            <div className="avatar small" style={{ background: intern.user.avatarColor }}>
              {intern.user.name.slice(0, 1)}
            </div>
            <div>
              <strong>{intern.user.name}</strong>
              <span>{intern.user.categoryLabel || "департамент не выбран"}</span>
            </div>
          </div>
          <div className="scoreLine">
            <span>AI продуктивность</span>
            <strong>{intern.stats.averageScore}%</strong>
          </div>
          <p>{intern.latestReportAi?.summary || intern.surveyAnalysis?.skillsSummary || "Пока нет AI-сводки."}</p>
          <div className="tagLine">
            {(intern.surveyAnalysis?.strengths || ["опрос не пройден"]).slice(0, 3).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </button>
      ))}
    </section>
  );
}

function PlansView({ plans }: { plans: AdminPlan[] }) {
  return (
    <section className="internCardGrid">
      {plans.map((plan) => (
        <article className="internAiCard" key={plan.id}>
          <div>
            <strong>{plan.title}</strong>
            <p>{categoryOptions.find((category) => category.value === plan.category)?.label || plan.category}</p>
          </div>
          <div className="deadline">
            <span>Базовый дедлайн: {plan.baseDeadline}</span>
            <strong>Текущий: {plan.adjustedDeadline}</strong>
          </div>
          <p>{plan.aiRationale}</p>
          <small>Тимлид: {plan.lead?.name || "не найден"} · Статус: {plan.status === "approved" ? "утвержден" : "черновик"}</small>
          <div className="timeline">
            {plan.milestones.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>
      ))}
      {!plans.length && <p>Тимлиды еще не создали планы проектов.</p>}
    </section>
  );
}

function InternProfileView({ profile, onBack }: { profile: InternProfile; onBack: () => void }) {
  const analysis = profile.survey?.analysis;

  return (
    <section className="flow">
      <button className="backButton" onClick={onBack}>
        <ChevronLeft size={18} />
        Назад в админку
      </button>
      <Header eyebrow={profile.user.categoryLabel || "Стажер"} title={profile.user.name} icon={<BrainCircuit />} />

      <div className="metrics">
        <Metric icon={<BarChart3 />} label="AI продуктивность" value={`${profile.stats.averageScore}%`} />
        <Metric icon={<Sparkles />} label="AI отчетов" value={profile.stats.aiReviewedReports} />
        <Metric icon={<CalendarCheck />} label="Посещений" value={profile.stats.attendanceCount} />
        <Metric icon={<Users />} label="Блокеров" value={profile.stats.blockerReports} />
      </div>

      <section className="split">
        <div className="panel">
          <h2>AI-сводка качеств и навыков</h2>
          {analysis ? (
            <>
              <h3>Профессиональные навыки</h3>
              <p>{analysis.skillsSummary || "AI не вернул отдельную сводку по навыкам."}</p>
              <h3>Опыт</h3>
              <p>{analysis.experienceSummary || "AI не вернул отдельную сводку по опыту."}</p>
              <h3>Цель стажировки</h3>
              <p>{analysis.goalAlignment || "AI не вернул оценку цели стажировки."}</p>
              <h3>Сильные стороны</h3>
              <div className="tagLine">
                {analysis.strengths.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <h3>Зоны роста</h3>
              <div className="tagLine">
                {analysis.weaknesses.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <p>{analysis.recommendation}</p>
            </>
          ) : (
            <p>Стажер еще не прошел первичный опрос.</p>
          )}
        </div>

        <div className="panel">
          <h2>План департамента</h2>
          {profile.plan ? (
            <>
              <div className="deadline">
                <span>Базовый: {profile.plan.baseDeadline}</span>
                <strong>Текущий: {profile.plan.adjustedDeadline}</strong>
              </div>
              <p>{profile.plan.aiRationale}</p>
              <div className="timeline">
                {profile.plan.milestones.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </>
          ) : (
            <p>План проекта для департамента еще не создан.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>История дэйликов</h2>
        <ReportList reports={profile.reports} />
      </section>
    </section>
  );
}
