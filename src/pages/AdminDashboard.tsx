import { BarChart3, BrainCircuit, CalendarCheck, ChevronLeft, ClipboardList, History, MapPin, Save, ShieldCheck, Sparkles, UserCog, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, type AiSummary, type AuditLog, type Category, type Dashboard, type DecisionCenter, type InternProfile, type OfficeLocation, type Plan, type Role, type User } from "../api";
import { AiAssistantDialog } from "../components/AiAssistantDialog";
import { DecisionCenterPanel } from "../components/DecisionCenterPanel";
import { Header } from "../components/Header";
import { Metric } from "../components/Metric";
import { PlanFitMatrix } from "../components/PlanFitMatrix";
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
  const [decisionCenter, setDecisionCenter] = useState<DecisionCenter | null>(null);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLog[]>([]);
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);
  const [selectedIntern, setSelectedIntern] = useState<InternProfile | null>(null);
  const [tab, setTab] = useState<"users" | "overview" | "ai" | "plans" | "office" | "audit">("overview");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function refresh() {
    const [userList, dashboardData, summaryData, planList, decisionData, officeData, auditData] = await Promise.all([
      api<User[]>("/api/admin/users"),
      api<Dashboard>("/api/admin/dashboard"),
      api<AiSummary>("/api/admin/ai-summary"),
      api<AdminPlan[]>("/api/admin/plans"),
      api<DecisionCenter>("/api/admin/decision-center"),
      api<OfficeLocation[]>("/api/attendance/office-locations"),
      api<AuditLog[]>("/api/audit-log")
    ]);
    setUsers(userList.map((user) => ({ ...user, draftRole: user.role, draftCategory: user.category || "" })));
    setDashboard(dashboardData);
    setAiSummary(summaryData);
    setPlans(planList);
    setDecisionCenter(decisionData);
    setOfficeLocations(officeData);
    setAuditLog(auditData);
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

  if (loading || !dashboard || !aiSummary || !decisionCenter) return <ShellLoading />;
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
        <Metric icon={<History />} label="Действий" value={auditLog.length} />
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
        <button className={tab === "office" ? "active" : ""} onClick={() => setTab("office")}>
          Офис
        </button>
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>
          Журнал
        </button>
      </div>

      {tab === "users" && <UsersAccess users={users} savingId={savingId} onPatch={patchDraft} onSave={save} onOpenIntern={openIntern} />}
      {tab === "overview" && <Overview dashboard={dashboard} decisionCenter={decisionCenter} onOpenIntern={openIntern} />}
      {tab === "ai" && <AiSummaryView summary={aiSummary} onOpenIntern={openIntern} />}
      {tab === "plans" && <PlansView plans={plans} />}
      {tab === "office" && <AdminOfficeLocationsView locations={officeLocations} onSaved={refresh} />}
      {tab === "audit" && <AuditLogView logs={auditLog} />}
    </section>
  );
}

function AdminOfficeLocationsView({ locations, onSaved }: { locations: OfficeLocation[]; onSaved: () => Promise<void> }) {
  const locationByCategory = new Map(locations.map((location) => [location.category, location]));

  return (
    <section className="internCardGrid">
      {categoryOptions.map((category) => (
        <AdminOfficeLocationCard key={category.value} category={category.value} label={category.label} location={locationByCategory.get(category.value)} onSaved={onSaved} />
      ))}
    </section>
  );
}

function AdminOfficeLocationCard({
  category,
  label,
  location,
  onSaved
}: {
  category: Category;
  label: string;
  location?: OfficeLocation;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    latitude: location?.latitude ? String(location.latitude) : "",
    longitude: location?.longitude ? String(location.longitude) : "",
    radiusMeters: String(location?.radiusMeters || 150),
    minWeeklyOfficeDays: String(location?.minWeeklyOfficeDays || 2)
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      latitude: location?.latitude ? String(location.latitude) : "",
      longitude: location?.longitude ? String(location.longitude) : "",
      radiusMeters: String(location?.radiusMeters || 150),
      minWeeklyOfficeDays: String(location?.minWeeklyOfficeDays || 2)
    });
  }, [location]);

  function useCurrentPosition() {
    navigator.geolocation.getCurrentPosition((position) => {
      setForm((current) => ({
        ...current,
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6)
      }));
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api<OfficeLocation>("/api/attendance/office-location", {
        method: "PUT",
        body: JSON.stringify({
          category,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          radiusMeters: Number(form.radiusMeters),
          minWeeklyOfficeDays: Number(form.minWeeklyOfficeDays)
        })
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="internAiCard form" onSubmit={save}>
      <div>
        <strong>{label}</strong>
        <p>{location ? "Точка уже задана" : "Точка еще не задана"}</p>
      </div>
      <div className="officeGrid">
        <label>
          Широта
          <input value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="43.238949" />
        </label>
        <label>
          Долгота
          <input value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="76.889709" />
        </label>
        <label>
          Радиус, м
          <input type="number" min={25} max={2000} value={form.radiusMeters} onChange={(event) => setForm({ ...form, radiusMeters: event.target.value })} />
        </label>
        <label>
          Норма в неделю
          <input type="number" min={1} max={7} value={form.minWeeklyOfficeDays} onChange={(event) => setForm({ ...form, minWeeklyOfficeDays: event.target.value })} />
        </label>
      </div>
      <div className="buttonRow">
        <button className="ghostButton" type="button" onClick={useCurrentPosition}>
          <MapPin size={16} />
          Мои координаты
        </button>
        <button className="primaryButton" disabled={saving}>
          <Save size={18} />
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
      {location ? (
        <small>
          {location.latitude}, {location.longitude} · {location.radiusMeters} м · {location.minWeeklyOfficeDays} раз/нед
        </small>
      ) : null}
    </form>
  );
}

function AuditLogView({ logs }: { logs: AuditLog[] }) {
  return (
    <section className="panel tablePanel">
      <h2>Журнал действий платформы</h2>
      <div className="auditList">
        {logs.map((log) => (
          <article className="auditItem" key={log.id}>
            <div>
              <strong>{log.message}</strong>
              <span>{log.actor?.name || "Система"} · {log.action} · {log.entityType}</span>
            </div>
            <time>{new Date(log.createdAt).toLocaleString()}</time>
          </article>
        ))}
        {!logs.length && <p>Пока нет записей аудита.</p>}
      </div>
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

function Overview({ dashboard, decisionCenter, onOpenIntern }: { dashboard: Dashboard; decisionCenter: DecisionCenter; onOpenIntern: (id: string) => void }) {
  return (
    <>
      <DecisionCenterPanel data={decisionCenter} />

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
          {plan.steps?.length ? (
            <div className="stepList compact">
              {plan.steps.map((step) => (
                <article className="stepItem" key={step.id}>
                  <div>
                    <strong>{step.title}</strong>
                    <small>
                      До {step.deadline} ·{" "}
                      {step.status === "done"
                        ? "готово"
                        : step.status === "in_progress"
                          ? "в работе"
                          : step.status === "canceled"
                            ? "отменено"
                            : "ожидает"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
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
        <Metric icon={<MapPin />} label="В офисе" value={profile.stats.officeAttendanceCount || 0} />
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
        <h3>Матрица потенциала под план</h3>
        <PlanFitMatrix profile={profile} />
        <ReportList reports={profile.reports} />
      </section>
    </section>
  );
}
