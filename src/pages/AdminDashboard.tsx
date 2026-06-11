import { BarChart3, BrainCircuit, CalendarCheck, ChevronLeft, ClipboardList, History, MapPin, Megaphone, MessageCircle, Save, ShieldCheck, Sparkles, UserCog, Users, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, uploadFile, type AiSummary, type AuditLog, type Category, type Dashboard, type DecisionCenter, type InternProfile, type OfficeLocation, type Plan, type Role, type StepThread, type TelegramRecoveryBroadcastResult, type User } from "../api";
import { AssignmentDraftPanel } from "../components/AssignmentDraftPanel";
import { AiAssistantDialog } from "../components/AiAssistantDialog";
import { DecisionCenterPanel } from "../components/DecisionCenterPanel";
import { ExternalResourcesPanel } from "../components/ExternalResourcesPanel";
import { Header } from "../components/Header";
import { Metric } from "../components/Metric";
import { OfficeLocationMapPanel } from "../components/OfficeLocationMapPanel";
import { PlanBulkAssignPanel } from "../components/PlanBulkAssignPanel";
import { PlanFitMatrix } from "../components/PlanFitMatrix";
import { ReportList } from "../components/ReportList";
import { RoleHomeDashboard, type HomeAlert, type HomePlan } from "../components/RoleHomeDashboard";
import { groupInternsByStage } from "../internStages";
import { Avatar } from "../components/Avatar";
import { ShellLoading } from "../components/ShellLoading";
import { categoryOptions } from "../constants";
import { businessDateIso } from "../date";
import { DropdownMenu } from "../components/DropdownMenu";

type DraftUser = User & {
  draftRole: Role;
  draftCategory: Category | "";
};

type AdminPlan = Plan & {
  lead?: User;
};

type AdminPreviewStep = Omit<Plan["steps"][number], "id" | "overdue"> & {
  clientId: string;
};

const roleLabels: Record<Role, string> = {
  intern: "Стажер",
  lead: "Тимлид",
  admin: "Админ"
};

function assigneeOptionLabel(user: Pick<User, "name" | "role">) {
  return `${user.name} · ${user.role === "lead" ? "тимлид" : "стажер"}`;
}

function getPlanAssignees(users: DraftUser[], category: Category, leadId?: string) {
  return users.filter(
    (user) =>
      (user.role === "intern" || user.role === "lead") &&
      (user.category === category || (user.role === "lead" && user.id === leadId))
  );
}

function formatUserDate(value?: string) {
  if (!value) return "неизвестно";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "неизвестно";
  return date.toLocaleDateString("ru-RU");
}

function telegramMeta(user: User) {
  const username = user.telegramUsername ? `@${user.telegramUsername}` : "username не указан";
  return `TG ID: ${user.telegramUserId || "не указан"} · ${username}`;
}

function registrationMeta(user: User) {
  if (user.registrationSocialSource) return `Источник: ${user.registrationSocialSource}`;
  if (user.registrationUtmSource) return `Источник: ${user.registrationUtmSource}`;
  if (user.registrationSource === "telegram_group") return "Источник: Telegram-группа";
  return "Источник: web";
}

export function AdminDashboard({ user }: { user: User }) {
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
  const [loadedTabs, setLoadedTabs] = useState<Record<typeof tab, boolean>>({
    users: false,
    overview: false,
    ai: false,
    plans: false,
    office: false,
    audit: false
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [telegramBroadcast, setTelegramBroadcast] = useState<TelegramRecoveryBroadcastResult | null>(null);
  const [telegramBroadcastBusy, setTelegramBroadcastBusy] = useState(false);

  async function loadOverview(force = false) {
    if (!force && dashboard && decisionCenter) return;
    const [dashboardData, decisionData] = await Promise.all([api<Dashboard>("/api/admin/dashboard"), api<DecisionCenter>("/api/admin/decision-center")]);
    setDashboard(dashboardData);
    setDecisionCenter(decisionData);
    setLoadedTabs((current) => ({ ...current, overview: true }));
  }

  async function loadUsers(force = false) {
    if (!force && loadedTabs.users) return;
    const userList = await api<User[]>("/api/admin/users");
    setUsers(userList.map((user) => ({ ...user, draftRole: user.role, draftCategory: user.category || "" })));
    setLoadedTabs((current) => ({ ...current, users: true }));
  }

  async function loadAiSummary(force = false) {
    if (!force && aiSummary) return;
    setAiSummary(await api<AiSummary>("/api/admin/ai-summary"));
    setLoadedTabs((current) => ({ ...current, ai: true }));
  }

  async function loadPlans(force = false) {
    if (!force && loadedTabs.plans) return;
    const [planList, userList] = await Promise.all([api<AdminPlan[]>("/api/admin/plans"), users.length ? Promise.resolve(users) : api<User[]>("/api/admin/users")]);
    setPlans(planList);
    if (!users.length) setUsers(userList.map((user) => ({ ...user, draftRole: user.role, draftCategory: user.category || "" })));
    setLoadedTabs((current) => ({ ...current, plans: true, users: true }));
  }

  async function loadOfficeLocations(force = false) {
    if (!force && loadedTabs.office) return;
    const location = await api<OfficeLocation | null>("/api/attendance/office-location/global");
    setOfficeLocations(location ? [location] : []);
    setLoadedTabs((current) => ({ ...current, office: true }));
  }

  async function loadAuditLog(force = false) {
    if (!force && loadedTabs.audit) return;
    setAuditLog(await api<AuditLog[]>("/api/audit-log"));
    setLoadedTabs((current) => ({ ...current, audit: true }));
  }

  useEffect(() => {
    loadOverview().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleNavigation(event: Event) {
      const key = (event as CustomEvent<string>).detail;
      setSelectedIntern(null);
      if (key === "dashboard") setTab("overview");
      if (key === "users" || key === "overview" || key === "ai" || key === "plans" || key === "office" || key === "audit") setTab(key);
    }

    window.addEventListener("dailyreport:navigate", handleNavigation);
    return () => window.removeEventListener("dailyreport:navigate", handleNavigation);
  }, []);

  useEffect(() => {
    if (tab === "users") void loadUsers();
    if (tab === "ai") void loadAiSummary();
    if (tab === "plans") void loadPlans();
    if (tab === "office") void loadOfficeLocations();
    if (tab === "audit") void loadAuditLog();
  }, [tab]);

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
      await loadUsers(true);
      await loadOverview(true);
    } finally {
      setSavingId(null);
    }
  }

  async function openIntern(id: string) {
    setSelectedIntern(await api<InternProfile>(`/api/admin/interns/${id}`));
  }

  async function deleteUser(id: string) {
    await api(`/api/admin/users/${id}`, { method: "DELETE" });
    if (selectedIntern?.user.id === id) setSelectedIntern(null);
    setUsers((current) => current.filter((item) => item.id !== id));
    await Promise.all([loadOverview(true), loadUsers(true)]);
  }

  async function runTelegramRecoveryBroadcast() {
    setTelegramBroadcastBusy(true);
    try {
      setTelegramBroadcast(await api<TelegramRecoveryBroadcastResult>("/api/admin/telegram/recovery-broadcast", { method: "POST" }));
    } finally {
      setTelegramBroadcastBusy(false);
    }
  }

  if (loading || !dashboard || !decisionCenter) return <ShellLoading />;
  if (selectedIntern) return <InternProfileView profile={selectedIntern} onBack={() => setSelectedIntern(null)} />;

  const sourcePlans: HomePlan[] = plans.length
    ? plans.map((plan) => {
      const total = plan.steps?.length || 0;
      const done = plan.steps?.filter((step) => step.status === "done").length || 0;
      const inProgress = plan.steps?.filter((step) => step.status === "in_progress").length || 0;
      const progress = total ? Math.round((done / total) * 100) : 0;
      return {
        id: plan.id,
        title: plan.title,
        category: categoryOptions.find((category) => category.value === plan.category)?.label || plan.category,
        lead: plan.lead?.name,
        deadline: plan.adjustedDeadline,
        progress,
        done,
        total,
        status: plan.status === "approved" ? "утвержден" : plan.status,
        onOpen: () => setTab("plans"),
        tasks: [
          { id: `${plan.id}-todo`, title: `Ожидают: ${Math.max(total - done - inProgress, 0)}`, meta: "проверить назначение", status: "todo" as const },
          { id: `${plan.id}-progress`, title: `В работе: ${inProgress}`, meta: "активные задачи", status: "in_progress" as const },
          { id: `${plan.id}-done`, title: `Готово: ${done}`, meta: `${progress}% закрыто`, status: "done" as const }
        ]
      };
    })
    : dashboard.stats.plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      category: plan.categoryLabel,
      deadline: plan.adjustedDeadline,
      progress: plan.progress.completionPercent,
      done: plan.progress.done,
      total: plan.progress.total,
      status: plan.progress.overdue ? "есть риск" : "активен",
      onOpen: () => setTab("plans"),
      tasks: [
        { id: `${plan.id}-todo`, title: `Ожидают: ${plan.progress.todo}`, meta: plan.progress.unassigned ? `без исполнителя ${plan.progress.unassigned}` : "назначены", status: "todo" as const },
        { id: `${plan.id}-progress`, title: `В работе: ${plan.progress.inProgress}`, meta: plan.progress.overdue ? `просрочено ${plan.progress.overdue}` : "по графику", status: "in_progress" as const },
        { id: `${plan.id}-done`, title: `Готово: ${plan.progress.done}`, meta: `${plan.progress.completionPercent}% закрыто`, status: "done" as const }
      ]
    }));
  const adminHomeAlerts: HomeAlert[] = [
    ...(decisionCenter.attention.length ? [{ id: "attention", title: "Есть зона внимания", text: `${decisionCenter.attention.length} стажеров требуют проверки AI-сводки.`, tone: "warn" as const, actionLabel: "AI-сводка", onAction: () => setTab("ai") }] : []),
    ...(decisionCenter.missingReports.length ? [{ id: "missing", title: "Дэйлики не закрыты", text: `${decisionCenter.missingReports.length} пользователей без отчета сегодня.`, tone: "danger" as const }] : []),
    ...(telegramBroadcast ? [{ id: "telegram", title: "Рассылка выполнена", text: `Групп: ${telegramBroadcast.groups}, сообщений о планах: ${telegramBroadcast.planAnnouncementMessages}.`, tone: "good" as const }] : []),
    ...(sourcePlans.length ? [] : [{ id: "plans", title: "Планы еще не загружены", text: "Откройте вкладку планов или создайте новый план для департамента.", tone: "info" as const, actionLabel: "Планы", onAction: () => setTab("plans") }])
  ];

  return (
    <section className="flow">
      {tab === 'overview' && (<>
        <RoleHomeDashboard
          user={user}
          roleLabel="Администратор"
          title={`Контроль платформы, ${user.name.split(" ")[0] || user.name}`}
          subtitle="Единая панель для пользователей, планов, офисной точки, Telegram-рассылок и AI-сводок по всем департаментам."
          score={dashboard.stats.averageScore}
          scoreLabel="AI здоровье платформы"
          focusTitle="Платформа и департаменты"
          focusSubtitle="Активные планы, команды и системные сигналы"
          metrics={[
            { icon: <Users />, label: users.length ? "Пользователей" : "Стажеров", value: users.length || dashboard.stats.internsTotal, caption: users.length ? "загружено из базы" : "по дашборду", tone: "neutral" },
            { icon: <UserCog />, label: "Тимлидов", value: users.length ? users.filter((user) => user.role === "lead").length : "откр. вкладку", caption: "доступы через админку", tone: "neutral" },
            { icon: <Sparkles />, label: "AI отчетов", value: dashboard.stats.aiReviewedReports, caption: "обработано моделью", tone: "good" },
            { icon: <ClipboardList />, label: "Планов", value: sourcePlans.length, caption: "активные и загруженные", tone: sourcePlans.length ? "good" : "warn" },
            { icon: <History />, label: "Действий", value: auditLog.length || "по вкладке", caption: "журнал аудита", tone: "neutral" }
          ]}
          actions={[
            { label: "broadcast", title: "Telegram рассылка", helper: "на случай сбоя cron", icon: <Megaphone size={22} />, tone: "green", onClick: runTelegramRecoveryBroadcast },
            { label: "create-plan", title: "Создать план", helper: "департамент и тимлид", icon: <Save size={22} />, tone: "blue", onClick: () => setTab("plans") },
            { label: "office", title: "Офисная точка", helper: "карта и радиус", icon: <MapPin size={22} />, tone: "amber", onClick: () => setTab("office") }
          ]}
          plans={sourcePlans}
          people={dashboard.interns.map((intern) => ({
            id: intern.id,
            name: intern.name,
            caption: intern.categoryLabel || "департамент не выбран",
            avatarColor: intern.avatarColor,
            avatarUrl: intern.avatarUrl,
            score: intern.averageScore,
            active: intern.activeToday,
            tags: [intern.role === "lead" ? "тимлид" : "стажер", intern.activeToday ? "активен" : "нет отметки"],
            onOpen: () => openIntern(intern.id)
          }))}
          alerts={adminHomeAlerts}
        />
        <AiAssistantDialog plans={plans.map((plan) => ({ ...plan, categoryLabel: categoryOptions.find((category) => category.value === plan.category)?.label }))} />

        <section className="telegramControlPanel">
          <div>
            <strong>Аварийная Telegram-рассылка</strong>
            <p>Если cron не сработал, отправьте мотивацию во все группы и досылайте анонсы активных планов без Telegram-уведомления.</p>
            {telegramBroadcast && (
              <small>
                Групп: {telegramBroadcast.groups} · мотиваций: {telegramBroadcast.motivationMessages} · планов к проверке: {telegramBroadcast.pendingPlans} ·
                анонсировано планов: {telegramBroadcast.announcedPlans} · сообщений о планах: {telegramBroadcast.planAnnouncementMessages}
              </small>
            )}
          </div>
          <button className="primaryButton" type="button" onClick={runTelegramRecoveryBroadcast} disabled={telegramBroadcastBusy}>
            <Megaphone size={18} />
            {telegramBroadcastBusy ? "Отправляю..." : "Разослать в Telegram"}
          </button>
        </section>
      </>
      )}



      {tab === "users" && (
        loadedTabs.users ? (
          <>
            <InternsPanel dashboard={dashboard} onOpenIntern={openIntern} onDeleteUser={deleteUser} />
            <UsersAccess users={users} savingId={savingId} onPatch={patchDraft} onSave={save} onOpenIntern={openIntern} />
          </>
        ) : <ShellLoading />
      )}
      {tab === "ai" && (
        aiSummary ? (
          <>
            <DecisionCenterPanel data={decisionCenter} />
            <AiSummaryView summary={aiSummary} onOpenIntern={openIntern} />
          </>
        ) : <ShellLoading />
      )}
      {tab === "plans" && (
        loadedTabs.plans ? (
          <PlansView
            plans={plans}
            users={users}
            onPlanChange={(updated) => setPlans((current) => current.map((plan) => (plan.id === updated.id ? { ...updated, lead: updated.lead || plan.lead } : plan)))}
            onPlanCreate={(created) => setPlans((current) => [created, ...current.filter((plan) => plan.id !== created.id)])}
          />
        ) : (
          <ShellLoading />
        )
      )}
      {tab === "office" && (loadedTabs.office ? <AdminOfficeLocationsView locations={officeLocations} onSaved={() => loadOfficeLocations(true)} /> : <ShellLoading />)}
      {tab === "audit" && (loadedTabs.audit ? <AuditLogView logs={auditLog} /> : <ShellLoading />)}
    </section>
  );
}

function AdminOfficeLocationsView({ locations, onSaved }: { locations: OfficeLocation[]; onSaved: () => Promise<void> }) {
  const location = locations[0] || null;

  return (
    <OfficeLocationMapPanel
      location={location}
      onSaved={async () => onSaved()}
      title="Офисная точка для всех департаментов"
      description="Выберите точку на карте, задайте радиус и норму посещений. После сохранения эти параметры применятся ко всем департаментам."
    />
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
              <Avatar small name={user.name} avatarColor={user.avatarColor} avatarUrl={user.avatarUrl} />
              <div>
                <strong>{user.name}</strong>
                <span>Email: {user.email || "не указан"}</span>
                <span>Создан: {formatUserDate(user.createdAt)}</span>
                <span>{telegramMeta(user)}</span>
                <span>{registrationMeta(user)}</span>
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

function InternsPanel({ dashboard, onOpenIntern, onDeleteUser }: { dashboard: Dashboard; onOpenIntern: (id: string) => void; onDeleteUser: (id: string) => Promise<void> }) {
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [deletingUser, setDeletingUser] = useState<{ id: string; name: string } | null>(null);

  const columns = groupInternsByStage(dashboard.interns);

  return (
    <>
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
        <div className="sectionTitleLine">
          <div>
            <h2>Все стажеры <span className="badgeCounter">{dashboard.interns.length}</span></h2>
          </div>
          <div className="tabs inlineTabs" style={{ margin: 0, border: "none", padding: 0 }}>
            <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>Список</button>
            <button className={viewMode === "kanban" ? "active" : ""} onClick={() => setViewMode("kanban")}>Канбан</button>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="table">
            {dashboard.interns.map((intern) => (
              <div className="rowWithActions" key={intern.id}>
                <button className="row clickableRow" onClick={() => onOpenIntern(intern.id)}>
                  <div className="person">
                    <Avatar small name={intern.name} avatarColor={intern.avatarColor} avatarUrl={intern.avatarUrl} />
                    <div>
                      <strong>{intern.name}</strong>
                      <span>{intern.categoryLabel || "департамент не выбран"}</span>
                    </div>
                  </div>
                  <span className={intern.activeToday ? "status ok" : "status"}>{intern.activeToday ? "онлайн сегодня" : "нет отметки"}</span>
                  <span>{intern.reportsCount} отчетов</span>
                  <strong>{intern.averageScore}%</strong>
                </button>
                <div>
                  <DropdownMenu items={[
                    { label: "Открыть профиль", onClick: () => onOpenIntern(intern.id) },
                    { label: "Отправить Email", onClick: () => { if (intern.email) window.location.href = `mailto:${intern.email}`; } },
                    { label: "Изменить", onClick: () => onOpenIntern(intern.id) },
                    { label: "Удалить", onClick: () => setDeletingUser({ id: intern.id, name: intern.name }), danger: true }
                  ]} />
                </div>
              </div>
            ))}
            {!dashboard.interns.length && <p>На платформе пока нет стажеров.</p>}
          </div>
        ) : (
          <div className="kanbanBoard">
            {columns.map(col => (
              <div className="kanbanColumn" key={col.id}>
                <div className="kanbanColumnHeader">
                  <strong>{col.title} <span className="badgeCounter primary">{col.items.length}</span></strong>
                </div>
                <div className="kanbanColumnList">
                  {col.items.map(intern => (
                    <div className="kanbanCard" key={intern.id} onClick={() => onOpenIntern(intern.id)}>
                      <div className="kanbanCardHeader">
                        <div className="tagLine">
                          <span>{intern.categoryLabel || "Без роли"}</span>
                        </div>
                        <DropdownMenu items={[
                          { label: "Открыть профиль", onClick: () => onOpenIntern(intern.id) },
                          { label: "Отправить Email", onClick: () => { if (intern.email) window.location.href = `mailto:${intern.email}`; } },
                          { label: "Удалить", onClick: () => setDeletingUser({ id: intern.id, name: intern.name }), danger: true }
                        ]} />
                      </div>
                      <div className="person" style={{ margin: "12px 0" }}>
                        <Avatar small name={intern.name} avatarColor={intern.avatarColor} avatarUrl={intern.avatarUrl} />
                        <div>
                          <strong>{intern.name}</strong>
                          <span style={{ fontSize: "12px" }}>Продуктивность: {intern.averageScore}%</span>
                        </div>
                      </div>
                      <div className="progressBar">
                        <i style={{ width: `${intern.averageScore}%` }} />
                      </div>
                      <div className="kanbanCardFooter">
                        <span className={intern.activeToday ? "status ok" : "status"}>{intern.activeToday ? "онлайн" : "офлайн"}</span>
                        <small>{intern.reportsCount} отчетов</small>
                      </div>
                    </div>
                  ))}
                  {!col.items.length && <div className="mutedText" style={{ fontSize: "12px", textAlign: "center", padding: "16px" }}>Нет стажеров</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {deletingUser && (
        <ConfirmDeleteUserModal
          user={deletingUser}
          onConfirm={async () => {
            await onDeleteUser(deletingUser.id);
            setDeletingUser(null);
          }}
          onCancel={() => setDeletingUser(null)}
        />
      )}
    </>
  );
}

function ConfirmDeleteUserModal({ user, onConfirm, onCancel }: { user: { id: string; name: string }; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить пользователя");
      setBusy(false);
    }
  }

  return (
    <div className="modalBackdrop" role="presentation" onMouseDown={onCancel}>
      <section className="assistantModal confirmModal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <strong>Удалить пользователя?</strong>
            <p>Аккаунт и связанные данные (отчёты, отметки, опрос) будут удалены без возможности восстановления. Назначенные шаги планов освободятся.</p>
          </div>
          <button className="iconButton" type="button" onClick={onCancel}>x</button>
        </div>
        <div className="deleteSummary">
          <span>Пользователь</span>
          <strong>{user.name}</strong>
        </div>
        {error && <p className="formError">{error}</p>}
        <div className="buttonRow">
          <button className="ghostButton lightButton" type="button" onClick={onCancel}>Отмена</button>
          <button className="secondaryButton dangerAction" type="button" onClick={confirm} disabled={busy}>
            {busy ? "Удаляю..." : "Да, удалить"}
          </button>
        </div>
      </section>
    </div>
  );
}

function AiSummaryView({ summary, onOpenIntern }: { summary: AiSummary; onOpenIntern: (id: string) => void }) {
  return (
    <section className="internCardGrid">
      {summary.interns.map((intern) => (
        <button className="internAiCard" key={intern.user.id} onClick={() => onOpenIntern(intern.user.id)}>
          <div className="person">
            <Avatar small name={intern.user.name} avatarColor={intern.user.avatarColor} avatarUrl={intern.user.avatarUrl} />
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

function PlansView({
  plans,
  users,
  onPlanChange,
  onPlanCreate
}: {
  plans: AdminPlan[];
  users: DraftUser[];
  onPlanChange: (plan: AdminPlan) => void;
  onPlanCreate: (plan: AdminPlan) => void;
}) {
  const leads = users.filter((user) => user.role === "lead");
  const [editingStep, setEditingStep] = useState<{ plan: AdminPlan; step: Plan["steps"][number] } | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<AdminPlan | null>(null);
  const [planList, setPlanList] = useState(plans);
  const [viewingPlan, setViewingPlan] = useState<AdminPlan | null>(null);

  useEffect(() => {
    setPlanList(plans);
  }, [plans]);

  async function updateStep(plan: AdminPlan, stepId: string, patch: Partial<Plan["steps"][number]>) {
    const saved = await api<AdminPlan>(`/api/department-plan/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    const savedWithLead = { ...saved, lead: plan.lead };
    setPlanList((current) => current.map((item) => (item.id === savedWithLead.id ? savedWithLead : item)));
    setViewingPlan((current) => (current?.id === savedWithLead.id ? savedWithLead : current));
    onPlanChange(savedWithLead);
  }

  async function deletePlan(plan: AdminPlan) {
    await api(`/api/admin/plans/${plan.id}`, { method: "DELETE" });
    setPlanList((current) => current.filter((item) => item.id !== plan.id));
    setDeletingPlan(null);
  }

  return (
    <section className="flow">
      <AdminPlanCreateForm leads={leads} users={users} onCreated={onPlanCreate} />
      <div className="planBoard">
        {planList.map((plan) => (
          <article className="internAiCard adminPlanCard" key={plan.id} onClick={() => setViewingPlan(plan)} style={{ cursor: "pointer" }}>
            <div className="planCardHeader">
              <div>
                <strong>{plan.title}</strong>
                <p>{categoryOptions.find((category) => category.value === plan.category)?.label || plan.category}</p>
              </div>
              <div className="planHeaderActions">
                <span className="status ok">{plan.status === "approved" ? "Утвержден" : "Черновик"}</span>
                <button
                  className="ghostButton dangerButton compactDanger"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingPlan(plan);
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
            <div className="planMetaGrid planMetaGridTwoCol">
              <div>
                <span>Тимлид</span>
                <strong>{plan.lead?.name || "не найден"}</strong>
              </div>
              <div>
                <span>Дата создания / Дедлайн</span>
                <strong>{(plan as any).createdAt ? new Date((plan as any).createdAt).toLocaleDateString("ru-RU") : plan.baseDeadline}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!planList.length && <p>Планы проектов еще не созданы.</p>}
      {viewingPlan ? (
        <AdminPlanDetailsModal
          plan={viewingPlan}
          assignees={getPlanAssignees(users, viewingPlan.category, viewingPlan.leadId)}
          onClose={() => setViewingPlan(null)}
          onPlanChange={(updatedPlan) => {
            const planWithLead = { ...updatedPlan, lead: viewingPlan.lead };
            setPlanList((current) => current.map((item) => (item.id === planWithLead.id ? planWithLead : item)));
            setViewingPlan(planWithLead);
            onPlanChange(planWithLead);
          }}
          onEditStep={(step) => setEditingStep({ plan: viewingPlan, step })}
        />
      ) : null}
      {editingStep ? (
        <AdminStepEditModal
          step={editingStep.step}
          assignees={getPlanAssignees(users, editingStep.plan.category, editingStep.plan.leadId)}
          onClose={() => setEditingStep(null)}
          onSave={async (patch) => {
            await updateStep(editingStep.plan, editingStep.step.id, patch);
            setEditingStep(null);
          }}
        />
      ) : null}
      {deletingPlan ? (
        <ConfirmDeletePlanModal
          plan={deletingPlan}
          onCancel={() => setDeletingPlan(null)}
          onConfirm={() => deletePlan(deletingPlan)}
        />
      ) : null}
    </section>
  );
}

function AdminPlanCreateForm({ leads, users, onCreated }: { leads: DraftUser[]; users: DraftUser[]; onCreated: (plan: AdminPlan) => void }) {
  const today = businessDateIso();
  const [form, setForm] = useState({
    title: "",
    category: "erp-development" as Category,
    leadId: "",
    baseDeadline: today,
    milestones: ""
  });
  const [previewSteps, setPreviewSteps] = useState<AdminPreviewStep[]>([]);
  const [editingPreviewStep, setEditingPreviewStep] = useState<AdminPreviewStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const availableLeads = leads.filter((lead) => !lead.category || lead.category === form.category);
  const availableAssignees = users.filter(
    (user) =>
      (user.role === "intern" && user.category === form.category) ||
      (user.role === "lead" && (user.category === form.category || user.id === form.leadId))
  );

  function patchForm(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
    setPreviewSteps([]);
  }

  function parseMilestones() {
    const text = form.milestones.trim();
    const byStages = text
      .split(/(?=Этап\s*\d+\s*:)/gi)
      .map((item) => item.trim())
      .filter(Boolean);
    if (byStages.length > 1) return byStages;

    return text
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function patchPreviewStep(clientId: string, patch: Partial<AdminPreviewStep>) {
    setPreviewSteps((current) => current.map((step) => (step.clientId === clientId ? { ...step, ...patch } : step)));
  }

  function addPreviewStep() {
    setPreviewSteps((current) => [
      ...current,
      {
        clientId: crypto.randomUUID(),
        title: "Новый шаг",
        description: "",
        technicalSpec: "",
        technicalInstruction: "",
        deadline: form.baseDeadline,
        assignedTo: "",
        status: "todo",
        source: "manual"
      }
    ]);
  }

  async function generatePreview(event: FormEvent) {
    event.preventDefault();
    setPreviewBusy(true);
    try {
      const result = await api<{ steps: Omit<AdminPreviewStep, "clientId">[] }>("/api/admin/plans/preview", {
        method: "POST",
        body: JSON.stringify({ ...form, milestones: parseMilestones() })
      });
      setPreviewSteps(result.steps.map((step) => ({ ...step, clientId: crypto.randomUUID() })));
    } finally {
      setPreviewBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const created = await api<AdminPlan>("/api/admin/plans", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          milestones: parseMilestones(),
          steps: previewSteps.map(({ clientId: _clientId, ...step }) => step)
        })
      });
      onCreated(created);
      setForm({ title: "", category: form.category, leadId: form.leadId, baseDeadline: today, milestones: "" });
      setPreviewSteps([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form adminPlanForm" onSubmit={generatePreview}>
      <h2>Создать план от администратора</h2>
      <div className="officeGrid">
        <label>
          Название плана
          <input value={form.title} onChange={(event) => patchForm({ title: event.target.value })} placeholder="ERP модуль учета стажировок" />
        </label>
        <label>
          Департамент
          <select value={form.category} onChange={(event) => patchForm({ category: event.target.value as Category, leadId: "" })}>
            {categoryOptions.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Тимлид
          <select value={form.leadId} onChange={(event) => setForm({ ...form, leadId: event.target.value })}>
            <option value="">Выберите тимлида</option>
            {availableLeads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}{lead.categoryLabel ? ` · ${lead.categoryLabel}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Дедлайн
          <input type="date" value={form.baseDeadline} onChange={(event) => patchForm({ baseDeadline: event.target.value })} />
        </label>
      </div>
      <label>
        Ключевые этапы, каждый с новой строки
        <textarea value={form.milestones} onChange={(event) => patchForm({ milestones: event.target.value })} placeholder={"Анализ требований\nПроектирование архитектуры\nРеализация и тестирование"} />
      </label>
      <button className="primaryButton" disabled={previewBusy || !form.leadId}>
        {previewBusy ? "AI раскладывает план..." : "Сгенерировать превью шагов"}
      </button>
      {!availableLeads.length && <small className="errorText">Нет свободных тимлидов для выбранного департамента.</small>}
      {previewSteps.length ? (
        <div className="stepPreviewPanel">
          <div className="reportTop">
            <h3>Превью шагов перед утверждением</h3>
            <button className="secondaryButton" type="button" onClick={addPreviewStep}>Добавить шаг</button>
          </div>
          <div className="stepList">
            {previewSteps.map((step, index) => (
              <article className="stepItem compactStep" key={step.clientId}>
                <button className="stepSummaryButton" type="button" onClick={() => setEditingPreviewStep(step)}>
                  <span className="stepNumber">{index + 1}</span>
                  <span className="stepSummaryText">
                    <strong>{step.title}</strong>
                    <span>{step.description || "Описание не заполнено"}</span>
                  </span>
                  <span className="stepMeta">
                    <span className={`status ${step.status === "done" ? "ok" : ""}`}>{stepStatusLabel(step.status)}</span>
                    <small>{step.deadline}{step.assignedTo ? " · назначен" : " · не назначен"}</small>
                  </span>
                </button>
                <button className="ghostButton dangerButton" type="button" onClick={() => setPreviewSteps((current) => current.filter((item) => item.clientId !== step.clientId))}>
                  Удалить
                </button>
              </article>
            ))}
          </div>
          <button className="primaryButton" type="button" onClick={submit} disabled={busy || !previewSteps.length}>
            {busy ? "Сохраняю план..." : "Утвердить и назначить план"}
          </button>
        </div>
      ) : null}
      {editingPreviewStep ? (
        <AdminStepEditModal
          step={editingPreviewStep}
          assignees={availableAssignees}
          onClose={() => setEditingPreviewStep(null)}
          onSave={async (patch) => {
            patchPreviewStep(editingPreviewStep.clientId, patch);
            setEditingPreviewStep(null);
          }}
        />
      ) : null}
    </form>
  );
}

function ConfirmDeletePlanModal({ plan, onConfirm, onCancel }: { plan: AdminPlan; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modalBackdrop" role="presentation" onMouseDown={onCancel}>
      <section className="assistantModal confirmModal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <strong>Удалить план?</strong>
            <p>Это действие удалит план и его шаги из платформы.</p>
          </div>
          <button className="iconButton" type="button" onClick={onCancel}>x</button>
        </div>
        <div className="deleteSummary">
          <span>План</span>
          <strong>{plan.title}</strong>
          <small>{categoryOptions.find((category) => category.value === plan.category)?.label || plan.category}</small>
        </div>
        <div className="buttonRow">
          <button className="ghostButton lightButton" type="button" onClick={onCancel}>Отмена</button>
          <button className="secondaryButton dangerAction" type="button" onClick={confirm} disabled={busy}>
            {busy ? "Удаляю..." : "Да, удалить план"}
          </button>
        </div>
      </section>
    </div>
  );
}

function stepStatusLabel(status: Plan["steps"][number]["status"]) {
  if (status === "done") return "готово";
  if (status === "in_progress") return "в работе";
  if (status === "canceled") return "отменено";
  return "ожидает";
}

function AdminStepEditModal({
  step,
  assignees,
  onSave,
  onClose
}: {
  step: Plan["steps"][number] | AdminPreviewStep;
  assignees: User[];
  onSave: (patch: Partial<Plan["steps"][number]>) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({
    title: step.title,
    description: step.description || "",
    technicalSpec: step.technicalSpec || "",
    technicalInstruction: step.technicalInstruction || "",
    deadline: step.deadline,
    assignedTo: step.assignedTo || "",
    status: step.status
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modalBackdrop" role="presentation" onMouseDown={onClose}>
      <section className="assistantModal stepModal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <strong>Редактирование шага</strong>
            <p>Описание, ТЗ, инструкция, исполнитель и статус.</p>
          </div>
          <button className="iconButton" type="button" onClick={onClose}>x</button>
        </div>
        <div className="form">
          <label>
            Название шага
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label>
            Описание результата
            <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>
          <label>
            Техническое задание
            <textarea value={draft.technicalSpec} onChange={(event) => setDraft({ ...draft, technicalSpec: event.target.value })} />
          </label>
          <label>
            Техническая инструкция
            <textarea value={draft.technicalInstruction} onChange={(event) => setDraft({ ...draft, technicalInstruction: event.target.value })} />
          </label>
          <div className="officeGrid">
            <label>
              Дедлайн
              <input type="date" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} />
            </label>
            <label>
              Исполнитель
              <select value={draft.assignedTo} onChange={(event) => setDraft({ ...draft, assignedTo: event.target.value })}>
                <option value="">Не назначен</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>{assigneeOptionLabel(assignee)}</option>
                ))}
              </select>
            </label>
            <label>
              Статус
              <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Plan["steps"][number]["status"] })}>
                <option value="todo">Ожидает</option>
                <option value="in_progress">В работе</option>
                <option value="done">Готово</option>
                <option value="canceled">Отменено</option>
              </select>
            </label>
          </div>
          <div className="buttonRow">
            <button className="ghostButton lightButton" type="button" onClick={onClose}>Отмена</button>
            <button className="primaryButton" type="button" onClick={save} disabled={saving}>{saving ? "Сохраняю..." : "Сохранить шаг"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AdminStepMaterials({ stepId }: { stepId: string }) {
  const [thread, setThread] = useState<StepThread | null>(null);
  const [artifact, setArtifact] = useState({ title: "", url: "" });
  const [uploading, setUploading] = useState(false);

  async function load() {
    setThread(await api<StepThread>(`/api/department-plan/steps/${stepId}/thread`));
  }

  async function addArtifact(event: FormEvent) {
    event.preventDefault();
    await api(`/api/department-plan/steps/${stepId}/artifacts`, { method: "POST", body: JSON.stringify(artifact) });
    setArtifact({ title: "", url: "" });
    await load();
  }

  async function uploadArtifact(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, "artifact");
      setArtifact({ title: file.name, url: uploaded.url });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="threadBox">
      <button className="ghostButton" type="button" onClick={load}>
        Материалы шага
      </button>
      {thread ? (
        <>
          <div className="tagLine">
            {thread.artifacts.map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
            ))}
            {!thread.artifacts.length && <span>Материалы еще не прикреплены</span>}
          </div>
          <form className="inlineForm materialForm" onSubmit={addArtifact}>
            <input value={artifact.title} onChange={(event) => setArtifact({ ...artifact, title: event.target.value })} placeholder="Название материала" />
            <input value={artifact.url} onChange={(event) => setArtifact({ ...artifact, url: event.target.value })} placeholder="https://..." />
            <label className="fileButton compact">
              {uploading ? "..." : "Файл"}
              <input type="file" onChange={(event) => uploadArtifact(event.target.files?.[0])} disabled={uploading} />
            </label>
            <button className="secondaryButton">Прикрепить</button>
          </form>
        </>
      ) : null}
    </div>
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

      <div className="panel">
        <div className="sectionTitleLine">
          <div>
            <span>Telegram</span>
            <h2>Характер и общение в чате</h2>
          </div>
          <MessageCircle size={20} />
        </div>
        {profile.user.telegramActivityMessages ? (
          <>
            <div className="metrics">
              <Metric icon={<MessageCircle />} label="Сообщений в группе" value={profile.user.telegramActivityMessages} />
              <Metric icon={<Sparkles />} label="Индекс активности" value={`${profile.user.telegramActivityScore ?? 0}/100`} />
            </div>
            <p>{profile.user.telegramActivitySummary || "Бот ещё формирует сводку о характере по сообщениям в группе."}</p>
          </>
        ) : (
          <p className="mutedText">Бот пока не видел сообщений этого стажёра в Telegram-группе. Добавьте бота в общий чат департамента — он начнёт собирать активность и формировать AI-сводку о характере.</p>
        )}
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

function AdminPlanDetailsModal({
  plan,
  assignees,
  onClose,
  onPlanChange,
  onEditStep
}: {
  plan: AdminPlan;
  assignees: User[];
  onClose: () => void;
  onPlanChange: (plan: AdminPlan) => void;
  onEditStep: (step: Plan["steps"][number]) => void;
}) {
  return (
    <div className="modalOverlay" role="presentation" onMouseDown={onClose}>
      <section className="modalContent planDetailModal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modalHeader modalHeaderSticky">
          <div>
            <span>Детали плана</span>
            <h2>{plan.title}</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="modalBody planDetailBody">
          <div className="planMetaGrid">
            <div>
              <span>Тимлид</span>
              <strong>{plan.lead?.name || "не найден"}</strong>
            </div>
            <div>
              <span>Базовый дедлайн</span>
              <strong>{plan.baseDeadline}</strong>
            </div>
            <div>
              <span>Текущий дедлайн</span>
              <strong>{plan.adjustedDeadline}</strong>
            </div>
          </div>
          <p className="planAiNote">{plan.aiRationale}</p>
          <div className="timeline compactTimeline">
            {plan.milestones.map((item, index) => (
              <span key={`${item}-${index}`}>
                {index + 1}. {item}
              </span>
            ))}
          </div>
          <div className="planDetailGrid">
            <div className="planDetailMain">
              {plan.steps?.length ? (
                <div className="planTaskList">
                  {plan.steps.map((step, index) => (
                    <article className="stepItem compactStep" key={step.id}>
                      <button className="stepSummaryButton" type="button" onClick={() => onEditStep(step)}>
                        <span className="stepNumber">{index + 1}</span>
                        <span className="stepSummaryText">
                          <strong>{step.title}</strong>
                          <span>{step.description || "Описание не заполнено"}</span>
                        </span>
                        <span className="stepMeta">
                          <span className={`status ${step.status === "done" ? "ok" : ""}`}>{stepStatusLabel(step.status)}</span>
                          <small>
                            {step.deadline}
                            {step.assignedTo ? " · назначен" : " · не назначен"}
                          </small>
                        </span>
                      </button>
                      <AdminStepMaterials stepId={step.id} />
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
            <aside className="planDetailAside">
              <PlanBulkAssignPanel plan={plan} assignees={assignees} onAssigned={onPlanChange} />
              <AssignmentDraftPanel
                plan={plan}
                onApplied={(savedPlan) => {
                  onPlanChange(savedPlan);
                }}
              />
              <ExternalResourcesPanel linkedEntityType="plan" linkedEntityId={plan.id} planId={plan.id} category={plan.category} />
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

