import { BarChart3, BrainCircuit, CalendarCheck, ChevronLeft, ClipboardList, History, MapPin, Megaphone, Save, ShieldCheck, Sparkles, UserCog, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, uploadFile, type AiSummary, type AuditLog, type Category, type Dashboard, type DecisionCenter, type InternProfile, type OfficeLocation, type Plan, type Role, type StepThread, type TelegramRecoveryBroadcastResult, type User } from "../api";
import { AssignmentDraftPanel } from "../components/AssignmentDraftPanel";
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

type AdminPreviewStep = Omit<Plan["steps"][number], "id" | "overdue"> & {
  clientId: string;
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
    setOfficeLocations(await api<OfficeLocation[]>("/api/attendance/office-locations"));
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

  return (
    <section className="flow">
      <Header eyebrow="Админка" title="Контроль платформы" icon={<ShieldCheck />} />
      <AiAssistantDialog plans={plans.map((plan) => ({ ...plan, categoryLabel: categoryOptions.find((category) => category.value === plan.category)?.label }))} />

      <div className="metrics">
        <Metric icon={<Users />} label={users.length ? "Пользователей" : "Стажеров"} value={users.length || dashboard.stats.internsTotal} />
        <Metric icon={<UserCog />} label="Тимлидов" value={users.length ? users.filter((user) => user.role === "lead").length : "откр. вкладку"} />
        <Metric icon={<Sparkles />} label="AI отчетов" value={dashboard.stats.aiReviewedReports} />
        <Metric icon={<ClipboardList />} label="Планов" value={plans.length || dashboard.stats.plans.length} />
        <Metric icon={<History />} label="Действий" value={auditLog.length || "по вкладке"} />
      </div>

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

      {tab === "users" && (loadedTabs.users ? <UsersAccess users={users} savingId={savingId} onPatch={patchDraft} onSave={save} onOpenIntern={openIntern} /> : <ShellLoading />)}
      {tab === "overview" && <Overview dashboard={dashboard} decisionCenter={decisionCenter} onOpenIntern={openIntern} />}
      {tab === "ai" && (aiSummary ? <AiSummaryView summary={aiSummary} onOpenIntern={openIntern} /> : <ShellLoading />)}
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

  useEffect(() => {
    setPlanList(plans);
  }, [plans]);

  async function updateStep(plan: AdminPlan, stepId: string, patch: Partial<Plan["steps"][number]>) {
    const saved = await api<AdminPlan>(`/api/department-plan/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    onPlanChange({ ...saved, lead: plan.lead });
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
          <article className="internAiCard adminPlanCard" key={plan.id}>
            <div className="planCardHeader">
              <div>
                <strong>{plan.title}</strong>
                <p>{categoryOptions.find((category) => category.value === plan.category)?.label || plan.category}</p>
              </div>
              <div className="planHeaderActions">
                <span className="status ok">{plan.status === "approved" ? "Утвержден" : "Черновик"}</span>
                <button className="ghostButton dangerButton compactDanger" type="button" onClick={() => setDeletingPlan(plan)}>
                  Удалить
                </button>
              </div>
            </div>
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
                <span key={`${item}-${index}`}>{index + 1}. {item}</span>
              ))}
            </div>
            <AssignmentDraftPanel
              plan={plan}
              onApplied={(savedPlan) => {
                const updatedPlan = { ...savedPlan, lead: plan.lead };
                setPlanList((current) => current.map((item) => (item.id === plan.id ? updatedPlan : item)));
                onPlanChange(updatedPlan);
              }}
            />
            {plan.steps?.length ? (
              <div className="planTaskList">
                {plan.steps.map((step, index) => (
                  <article className="stepItem compactStep" key={step.id}>
                    <button className="stepSummaryButton" type="button" onClick={() => setEditingStep({ plan, step })}>
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
                    <AdminStepMaterials stepId={step.id} />
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {!planList.length && <p>Планы проектов еще не созданы.</p>}
      {editingStep ? (
        <AdminStepEditModal
          step={editingStep.step}
          interns={users.filter((user) => user.role === "intern" && user.category === editingStep.plan.category)}
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
  const today = new Date().toISOString().slice(0, 10);
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
  const availableInterns = users.filter((user) => user.role === "intern" && user.category === form.category);

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
          interns={availableInterns}
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
  interns,
  onSave,
  onClose
}: {
  step: Plan["steps"][number] | AdminPreviewStep;
  interns: DraftUser[];
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
                {interns.map((intern) => (
                  <option key={intern.id} value={intern.id}>{intern.name}</option>
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
