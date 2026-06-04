import { BarChart3, Bot, BrainCircuit, CalendarCheck, ChevronLeft, MapPin, Plus, Save, Send, Sparkles, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, getToken, uploadFile, type AiReview, type AiSummary, type Dashboard, type DecisionCenter, type InternProfile, type OfficeLocation, type Plan, type Report, type RiskCenter, type StepThread, type User } from "../api";
import { AssignmentDraftPanel } from "../components/AssignmentDraftPanel";
import { AiAssistantDialog } from "../components/AiAssistantDialog";
import { DecisionCenterPanel } from "../components/DecisionCenterPanel";
import { ExternalResourcesPanel } from "../components/ExternalResourcesPanel";
import { Header } from "../components/Header";
import { Metric } from "../components/Metric";
import { PlanFitMatrix } from "../components/PlanFitMatrix";
import { ReportList } from "../components/ReportList";
import { ShellLoading } from "../components/ShellLoading";
import { TelegramHelp } from "../components/TelegramHelp";

type PlanForm = {
  title: string;
  baseDeadline: string;
  milestones: string;
};

type DigestSettings = {
  enabled: boolean;
  time: string;
  content: "productivity" | "reports" | "full";
};

export function LeadDashboard({ user }: { user: User }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [decisionCenter, setDecisionCenter] = useState<DecisionCenter | null>(null);
  const [riskCenter, setRiskCenter] = useState<RiskCenter | null>(null);
  const [weeklyReview, setWeeklyReview] = useState("");
  const [departmentPlan, setDepartmentPlan] = useState<Plan | null>(null);
  const [planHistory, setPlanHistory] = useState<Plan[]>([]);
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null);
  const [selectedIntern, setSelectedIntern] = useState<InternProfile | null>(null);
  const [viewingPlan, setViewingPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState<"overview" | "plans" | "automation" | "ai">("overview");
  const [loadedSections, setLoadedSections] = useState({
    decision: false,
    plans: false,
    office: false,
    risk: false
  });
  const [planForm, setPlanForm] = useState<PlanForm>({
    title: "Проект департамента",
    baseDeadline: "2026-06-20",
    milestones: "Анализ требований\nРеализация MVP\nТестирование\nДемо тимлиду"
  });
  const [savingPlan, setSavingPlan] = useState(false);

  async function refreshDashboard() {
    const dashboardData = await api<Dashboard>("/api/dashboard");
    setDashboard(dashboardData);
  }

  async function loadDecisionCenter(force = false) {
    if (!force && loadedSections.decision) return;
    setDecisionCenter(await api<DecisionCenter>("/api/decision-center"));
    setLoadedSections((current) => ({ ...current, decision: true }));
  }

  async function loadRiskCenter(force = false) {
    if (!force && loadedSections.risk) return;
    const [riskData, weeklyData] = await Promise.all([
      api<RiskCenter>("/api/risk-center"),
      api<{ summary: string }>("/api/weekly-review")
    ]);
    setRiskCenter(riskData);
    setWeeklyReview(weeklyData.summary);
    setLoadedSections((current) => ({ ...current, risk: true }));
  }

  async function loadPlans(force = false) {
    if (!force && loadedSections.plans) return;
    const [planData, plansData] = await Promise.all([
      api<Plan | null>("/api/my-plan"),
      api<Plan[]>("/api/department-plans")
    ]);
    setDepartmentPlan(planData);
    setPlanHistory(plansData);
    setViewingPlan((current) => (current ? plansData.find((plan) => plan.id === current.id) || planData || current : current));
    if (planData) {
      setPlanForm({
        title: planData.title,
        baseDeadline: planData.baseDeadline,
        milestones: planData.milestones.join("\n")
      });
    }
    setLoadedSections((current) => ({ ...current, plans: true }));
  }

  async function loadOfficeLocation(force = false) {
    if (!force && loadedSections.office) return;
    setOfficeLocation(await api<OfficeLocation | null>("/api/attendance/office-location"));
    setLoadedSections((current) => ({ ...current, office: true }));
  }

  async function completeDepartmentPlan() {
    if (!departmentPlan) return;
    await api<Plan>(`/api/department-plan/${departmentPlan.id}/complete`, { method: "POST" });
    await Promise.all([loadPlans(true), refreshDashboard()]);
  }

  async function downloadCsv() {
    const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/export.csv`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dailyreport-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    refreshDashboard();
  }, []);

  useEffect(() => {
    if (tab === "overview") {
      void loadDecisionCenter();
      void loadRiskCenter();
    }
    if (tab === "plans") void loadPlans();
    if (tab === "automation") void loadOfficeLocation();
    if (tab === "ai" && !aiSummary) {
      void api<AiSummary>("/api/ai-summary").then(setAiSummary);
    }
  }, [tab, aiSummary, loadedSections]);

  async function openIntern(id: string) {
    setSelectedIntern(await api<InternProfile>(`/api/interns/${id}`));
  }

  function parseMilestones() {
    const text = planForm.milestones.trim();
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

  async function submitDepartmentPlan(event: FormEvent) {
    event.preventDefault();
    setSavingPlan(true);
    try {
      const saved = await api<Plan>("/api/department-plan", {
        method: "POST",
        body: JSON.stringify({ ...planForm, milestones: parseMilestones() })
      });
      setDepartmentPlan(saved);
      await Promise.all([loadPlans(true), refreshDashboard()]);
    } finally {
      setSavingPlan(false);
    }
  }

  if (!dashboard) return <ShellLoading />;

  if (selectedIntern) {
    return <InternProfileView profile={selectedIntern} onBack={() => setSelectedIntern(null)} />;
  }

  return (
    <section className="flow">
      <Header
        eyebrow={user.categoryLabel || "Тимлид"}
        title={tab === "overview" ? "Активность стажеров" : tab === "plans" ? "Планы департамента" : tab === "automation" ? "Автоматизация и Telegram" : "AI-сводка стажеров"}
        icon={<Users />}
      />
      <AiAssistantDialog />
      <TelegramHelp user={user} />

      <div className="tabs inlineTabs">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          Обзор
        </button>
        <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}>
          Планы
        </button>
        <button className={tab === "automation" ? "active" : ""} onClick={() => setTab("automation")}>
          Автоматизация
        </button>
        <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>
          AI-сводка
        </button>
      </div>

      {tab === "overview" ? (
        <>
          {decisionCenter ? <DecisionCenterPanel data={decisionCenter} /> : <ShellLoading />}
          {riskCenter && <RiskCenterPanel data={riskCenter} weeklyReview={weeklyReview} />}
          <PlanProgressPanel plans={dashboard.stats.plans} />
          <Overview dashboard={dashboard} onOpenIntern={openIntern} />
        </>
      ) : null}

      {tab === "automation" ? (
        <>
          <section className="split">
            <LeadDailyPanel />
            <TelegramDigestPanel />
          </section>

          {loadedSections.office ? <OfficeLocationPanel location={officeLocation} onChange={setOfficeLocation} /> : <ShellLoading />}
        </>
      ) : null}

      {tab === "plans" ? (
        loadedSections.plans ? (
          <>
      <section className="planWorkspace">
        <form className="panel form planCreatePanel" onSubmit={submitDepartmentPlan}>
          <div className="sectionTitleLine">
            <div>
              <span>Создание версии</span>
              <h2>План проекта департамента</h2>
            </div>
            <Save size={20} />
          </div>
          <p className="mutedText">Новая версия не затирает историю. После сохранения AI разложит план на шаги, а детали можно открыть в отдельном окне.</p>
          <label>
            Название
            <input value={planForm.title} onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })} />
          </label>
          <div className="officeGrid compactOfficeGrid">
            <label>
              Базовый дедлайн
              <input type="date" value={planForm.baseDeadline} onChange={(event) => setPlanForm({ ...planForm, baseDeadline: event.target.value })} />
            </label>
          </div>
          <label>
            Этапы
            <textarea value={planForm.milestones} onChange={(event) => setPlanForm({ ...planForm, milestones: event.target.value })} />
          </label>
          <button className="primaryButton" disabled={savingPlan}>
            <Save size={18} />
            {savingPlan ? "Сохраняю..." : departmentPlan ? "Создать новую версию плана" : "Создать и утвердить план"}
          </button>
        </form>

        <div className="panel planListPanel">
          <div className="sectionTitleLine">
            <div>
              <span>Активный план</span>
              <h2>Утвержденная работа</h2>
            </div>
            {departmentPlan ? <span className="status ok">#{departmentPlan.version || 1}</span> : null}
          </div>
          {departmentPlan ? (
            <LeadPlanSummaryCard plan={departmentPlan} onOpen={() => setViewingPlan(departmentPlan)} />
          ) : (
            <p>План еще не создан. После утверждения он появится у всех стажеров вашего департамента.</p>
          )}
        </div>
      </section>

      {viewingPlan ? (
        <LeadPlanDetailsModal
          plan={viewingPlan}
          interns={dashboard.interns}
          onClose={() => setViewingPlan(null)}
          onPlanChange={(savedPlan) => {
            setDepartmentPlan(savedPlan);
            setViewingPlan(savedPlan);
            void Promise.all([loadPlans(true), refreshDashboard()]);
          }}
          onComplete={completeDepartmentPlan}
        />
      ) : null}

      <PlanHistoryPanel plans={planHistory} />

      <button className="secondaryButton" type="button" onClick={downloadCsv}>
        Скачать CSV-отчет
      </button>
          </>
        ) : (
          <ShellLoading />
        )
      ) : null}

      {tab === "ai" ? (aiSummary ? <AiSummaryView summary={aiSummary} onOpenIntern={openIntern} /> : <ShellLoading />) : null}
    </section>
  );
}

function RiskCenterPanel({ data, weeklyReview }: { data: RiskCenter; weeklyReview: string }) {
  return (
    <section className="panel">
      <h2>Центр рисков</h2>
      <div className="tagLine">
        <span>Просрочено шагов: {data.overdueSteps.length}</span>
        <span>Без дэйлика сегодня: {data.missingReports.length}</span>
        <span>Низкая продуктивность: {data.weakInterns.length}</span>
        <span>Нет офисных отметок: {data.officeIssues.length}</span>
      </div>
      {data.overdueSteps.slice(0, 5).map((step) => (
        <small key={step.stepId}>
          Просрочено: {step.title} · {step.planTitle} · дедлайн {step.deadline}
        </small>
      ))}
      <p>{weeklyReview}</p>
    </section>
  );
}

function PlanProgressPanel({ plans }: { plans: Dashboard["stats"]["plans"] }) {
  if (!plans.length) return null;

  return (
    <section className="panel">
      <h2>Прогресс активного плана</h2>
      <div className="progressGrid">
        {plans.map((plan) => (
          <article className="progressCard" key={plan.id}>
            <div className="reportTop">
              <strong>{plan.title}</strong>
              <span>{plan.progress.completionPercent}%</span>
            </div>
            <div className="progressBar">
              <i style={{ width: `${plan.progress.completionPercent}%` }} />
            </div>
            <div className="tagLine">
              <span>Готово: {plan.progress.done}</span>
              <span>В работе: {plan.progress.inProgress}</span>
              <span>Ожидает: {plan.progress.todo}</span>
              {plan.progress.overdue ? <span>Просрочено: {plan.progress.overdue}</span> : null}
              {plan.progress.unassigned ? <span>Без исполнителя: {plan.progress.unassigned}</span> : null}
            </div>
            <small>Дедлайн: {plan.adjustedDeadline}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function LeadPlanSummaryCard({ plan, onOpen }: { plan: Plan; onOpen: () => void }) {
  const total = plan.steps?.length || 0;
  const done = plan.steps?.filter((step) => step.status === "done").length || 0;
  const assigned = plan.steps?.filter((step) => step.assignedTo).length || 0;
  const progress = total ? Math.round((done / total) * 100) : 0;

  return (
    <button className="planSummaryCard" type="button" onClick={onOpen}>
      <div className="planCardHeader">
        <div>
          <strong>{plan.title}</strong>
          <p>Текущий дедлайн: {plan.adjustedDeadline}</p>
        </div>
        <span className="status ok">{plan.status === "approved" ? "утвержден" : "черновик"}</span>
      </div>
      <div className="progressBar wideProgress">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="planMetaGrid">
        <div>
          <span>Готово</span>
          <strong>{done}/{total}</strong>
        </div>
        <div>
          <span>Назначено</span>
          <strong>{assigned}/{total}</strong>
        </div>
        <div>
          <span>Версия</span>
          <strong>#{plan.version || 1}</strong>
        </div>
      </div>
    </button>
  );
}

function LeadPlanDetailsModal({
  plan,
  interns,
  onClose,
  onPlanChange,
  onComplete
}: {
  plan: Plan;
  interns: Dashboard["interns"];
  onClose: () => void;
  onPlanChange: (plan: Plan) => void;
  onComplete: () => Promise<void>;
}) {
  return (
    <div className="modalOverlay" role="presentation" onMouseDown={onClose}>
      <section className="modalContent planDetailModal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modalHeader modalHeaderSticky">
          <div>
            <span>Детали плана</span>
            <h2>{plan.title}</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose}>x</button>
        </header>
        <div className="modalBody planDetailBody">
          <div className="planHeroPanel">
            <div className="deadline">
              <span>Базовый дедлайн: {plan.baseDeadline}</span>
              <strong>Текущий: {plan.adjustedDeadline}</strong>
            </div>
            <p>{plan.aiRationale}</p>
            <div className="timeline compactTimeline">
              {plan.milestones.map((item, index) => (
                <span key={`${item}-${index}`}>{index + 1}. {item}</span>
              ))}
            </div>
          </div>

          <div className="planDetailGrid">
            <div className="planDetailMain">
              <PlanStepsEditor plan={plan} interns={interns} onChange={onPlanChange} />
            </div>
            <aside className="planDetailAside">
              <AssignmentDraftPanel plan={plan} onApplied={onPlanChange} />
              <ExternalResourcesPanel linkedEntityType="plan" linkedEntityId={plan.id} planId={plan.id} category={plan.category} />
              <button className="ghostButton lightButton" type="button" onClick={async () => {
                await onComplete();
                onClose();
              }}>
                Завершить план и оставить в истории
              </button>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlanStepsEditor({ plan, interns, onChange }: { plan: Plan; interns: Dashboard["interns"]; onChange: (plan: Plan) => void }) {
  const [draft, setDraft] = useState({ title: "", description: "", technicalSpec: "", technicalInstruction: "", deadline: plan.adjustedDeadline, assignedTo: "" });
  const [busy, setBusy] = useState(false);
  const [editingStep, setEditingStep] = useState<Plan["steps"][number] | null>(null);

  async function addStep(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await api<Plan>("/api/department-plan/steps", {
        method: "POST",
        body: JSON.stringify(draft)
      });
      onChange(saved);
      setDraft({ title: "", description: "", technicalSpec: "", technicalInstruction: "", deadline: plan.adjustedDeadline, assignedTo: "" });
    } finally {
      setBusy(false);
    }
  }

  async function updateStep(stepId: string, patch: Partial<Plan["steps"][number]>) {
    const saved = await api<Plan>(`/api/department-plan/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    onChange(saved);
  }

  return (
    <div className="planSteps">
      <h3>Пошаговые действия</h3>
      <div className="stepList">
        {(plan.steps || []).map((step, index) => (
          <article className="stepItem compactStep" key={step.id}>
            <button className="stepSummaryButton" type="button" onClick={() => setEditingStep(step)}>
              <span className="stepNumber">{index + 1}</span>
              <span className="stepSummaryText">
                <strong>{step.title}</strong>
                <span>{step.description || "Описание не заполнено"}</span>
              </span>
              <span className="stepMeta">
                <span className={`status ${step.status === "done" ? "ok" : ""}`}>{stepStatusLabel(step.status)}</span>
                <small>{step.deadline}{step.overdue ? " · просрочено" : ""}</small>
              </span>
            </button>
            <StepThreadPanel stepId={step.id} />
          </article>
        ))}
      </div>
      <form className="stepAddForm" onSubmit={addStep}>
        <input placeholder="Новый шаг" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <textarea placeholder="Описание результата" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        <textarea placeholder="Техническое задание" value={draft.technicalSpec} onChange={(event) => setDraft({ ...draft, technicalSpec: event.target.value })} />
        <textarea placeholder="Техническая инструкция" value={draft.technicalInstruction} onChange={(event) => setDraft({ ...draft, technicalInstruction: event.target.value })} />
        <input type="date" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} />
        <select value={draft.assignedTo} onChange={(event) => setDraft({ ...draft, assignedTo: event.target.value })}>
          <option value="">Без назначения</option>
          {interns.map((intern) => (
            <option key={intern.id} value={intern.id}>
              {intern.name}
            </option>
          ))}
        </select>
        <button className="primaryButton" disabled={busy}>
          <Plus size={16} />
          {busy ? "Добавляю..." : "Добавить шаг"}
        </button>
      </form>
      {editingStep ? (
        <LeadStepEditModal
          step={editingStep}
          interns={interns}
          onClose={() => setEditingStep(null)}
          onSave={async (patch) => {
            await updateStep(editingStep.id, patch);
            setEditingStep(null);
          }}
        />
      ) : null}
    </div>
  );
}

function stepStatusLabel(status: Plan["steps"][number]["status"]) {
  if (status === "done") return "готово";
  if (status === "in_progress") return "в работе";
  if (status === "canceled") return "отменено";
  return "ожидает";
}

function LeadStepEditModal({
  step,
  interns,
  onSave,
  onClose
}: {
  step: Plan["steps"][number];
  interns: Dashboard["interns"];
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
          <label>Название шага<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Описание результата<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label>Техническое задание<textarea value={draft.technicalSpec} onChange={(event) => setDraft({ ...draft, technicalSpec: event.target.value })} /></label>
          <label>Техническая инструкция<textarea value={draft.technicalInstruction} onChange={(event) => setDraft({ ...draft, technicalInstruction: event.target.value })} /></label>
          <div className="officeGrid">
            <label>Дедлайн<input type="date" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></label>
            <label>
              Исполнитель
              <select value={draft.assignedTo} onChange={(event) => setDraft({ ...draft, assignedTo: event.target.value })}>
                <option value="">Не назначен</option>
                {interns.map((intern) => <option key={intern.id} value={intern.id}>{intern.name}</option>)}
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

function StepThreadPanel({ stepId }: { stepId: string }) {
  const [thread, setThread] = useState<StepThread | null>(null);
  const [comment, setComment] = useState("");
  const [artifact, setArtifact] = useState({ title: "", url: "" });
  const [uploading, setUploading] = useState(false);

  async function load() {
    setThread(await api<StepThread>(`/api/department-plan/steps/${stepId}/thread`));
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    await api(`/api/department-plan/steps/${stepId}/comments`, { method: "POST", body: JSON.stringify({ text: comment }) });
    setComment("");
    await load();
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
        Комментарии и артефакты
      </button>
      {thread ? (
        <>
          <div className="tagLine">
            {thread.comments.slice(-3).map((item) => (
              <span key={item.id}>{item.user?.name || "user"}: {item.text}</span>
            ))}
            {thread.artifacts.map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
            ))}
          </div>
          <form className="inlineForm" onSubmit={addComment}>
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий к шагу" />
            <button className="secondaryButton">Добавить</button>
          </form>
          <form className="inlineForm" onSubmit={addArtifact}>
            <input value={artifact.title} onChange={(event) => setArtifact({ ...artifact, title: event.target.value })} placeholder="Артефакт" />
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

function OfficeLocationPanel({ location, onChange }: { location: OfficeLocation | null; onChange: (location: OfficeLocation) => void }) {
  const [form, setForm] = useState({
    latitude: location?.latitude ? String(location.latitude) : "",
    longitude: location?.longitude ? String(location.longitude) : "",
    radiusMeters: String(location?.radiusMeters || 150),
    minWeeklyOfficeDays: String(location?.minWeeklyOfficeDays || 2)
  });

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
    const saved = await api<OfficeLocation>("/api/attendance/office-location", {
      method: "PUT",
      body: JSON.stringify({
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusMeters: Number(form.radiusMeters),
        minWeeklyOfficeDays: Number(form.minWeeklyOfficeDays)
      })
    });
    onChange(saved);
  }

  return (
    <form className="panel form" onSubmit={save}>
      <h2>Офисная точка посещаемости</h2>
      <p className="mutedText">Стажер сможет отметиться в офисе только если браузер покажет координаты внутри заданного радиуса. Норма по умолчанию: 2 раза в неделю.</p>
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
          Взять мои координаты
        </button>
        <button className="primaryButton">
          <Save size={18} />
          Сохранить точку
        </button>
      </div>
      {location ? (
        <small>
          Текущая точка: {location.latitude}, {location.longitude} · радиус {location.radiusMeters} м
        </small>
      ) : null}
    </form>
  );
}

function PlanHistoryPanel({ plans }: { plans: Plan[] }) {
  if (!plans.length) return null;

  return (
    <section className="panel">
      <h2>История планов департамента</h2>
      <div className="stepList">
        {plans.map((plan) => (
          <article className="stepItem" key={plan.id}>
            <div>
              <strong>
                #{plan.version || 1} · {plan.title}
              </strong>
              <p>
                Дедлайн: {plan.adjustedDeadline} · статус: {plan.status === "completed" ? "завершен" : plan.status === "archived" ? "архив" : plan.status === "approved" ? "активен" : "черновик"}
              </p>
              <small>Шагов: {plan.steps?.length || 0}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LeadDailyPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [form, setForm] = useState({ yesterday: "", todayPlan: "", blockers: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Report[]>("/api/reports").then(setReports);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api<Report>("/api/reports", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ yesterday: "", todayPlan: "", blockers: "" });
      setReports(await api<Report[]>("/api/reports"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Мой дэйлик тимлида</h2>
      <p className="mutedText">Необязательно, но можно фиксировать свою работу. Эти отчеты не попадают в продуктивность стажеров.</p>
      <label>
        Что сделал вчера
        <textarea value={form.yesterday} onChange={(event) => setForm({ ...form, yesterday: event.target.value })} />
      </label>
      <label>
        План на сегодня
        <textarea value={form.todayPlan} onChange={(event) => setForm({ ...form, todayPlan: event.target.value })} />
      </label>
      <label>
        Блокеры
        <textarea value={form.blockers} onChange={(event) => setForm({ ...form, blockers: event.target.value })} />
      </label>
      <button className="primaryButton" disabled={busy}>
        <Send size={18} />
        {busy ? "AI проверяет..." : "Отправить дэйлик"}
      </button>
      <small>Моих дэйликов: {reports.length}</small>
    </form>
  );
}

function TelegramDigestPanel() {
  const [settings, setSettings] = useState<DigestSettings>({ enabled: false, time: "18:00", content: "full" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<DigestSettings>("/api/telegram/digest").then(setSettings);
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/telegram/digest", {
        method: "PATCH",
        body: JSON.stringify(settings)
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={save}>
      <h2>Автосводка в Telegram</h2>
      <p className="mutedText">Бот отправит сводку по стажерам вашего департамента в выбранное время.</p>
      <label className="toggleLine">
        <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />
        Получать автоматически
      </label>
      <label>
        Время
        <input type="time" value={settings.time} onChange={(event) => setSettings({ ...settings, time: event.target.value })} />
      </label>
      <label>
        Содержание
        <select value={settings.content} onChange={(event) => setSettings({ ...settings, content: event.target.value as DigestSettings["content"] })}>
          <option value="full">Полная сводка</option>
          <option value="productivity">Продуктивный ли день</option>
          <option value="reports">Посещаемость и дэйлики</option>
        </select>
      </label>
      <button className="secondaryButton" disabled={saving}>
        <Bot size={18} />
        {saving ? "Сохраняю..." : "Сохранить настройки"}
      </button>
    </form>
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
        <h2>Список стажеров</h2>
        <div className="table">
          {dashboard.interns.map((intern) => (
            <button className="row clickableRow" key={intern.id} onClick={() => onOpenIntern(intern.id)}>
              <div className="person">
                <div className="avatar small" style={{ background: intern.avatarColor }}>
                  {intern.name.slice(0, 1)}
                </div>
                <div>
                  <strong>{intern.name}</strong>
                  <span>{intern.categoryLabel}</span>
                </div>
              </div>
              <span className={intern.activeToday ? "status ok" : "status"}>{intern.activeToday ? "онлайн сегодня" : "нет отметки"}</span>
              <span>{intern.reportsCount} отчетов</span>
              <strong>{intern.averageScore}%</strong>
            </button>
          ))}
          {!dashboard.interns.length && <p>В вашем департаменте пока нет стажеров.</p>}
        </div>
      </section>

      <ReportList reports={dashboard.reports} />
    </>
  );
}

function AiSummaryView({ summary, onOpenIntern }: { summary: AiSummary; onOpenIntern: (id: string) => void }) {
  return (
    <>
      <div className="metrics">
        <Metric icon={<BrainCircuit />} label="AI обработал отчетов" value={summary.overview.aiReviewedReports} />
        <Metric icon={<Sparkles />} label="Опросов с AI-профилем" value={summary.overview.internsWithSurvey} />
        <Metric icon={<BarChart3 />} label="Средняя продуктивность" value={`${summary.overview.averageScore}%`} />
        <Metric icon={<Users />} label="Зона внимания" value={summary.overview.needsAttention} />
      </div>

      <section className="internCardGrid">
        {summary.interns.map((intern) => (
          <button className="internAiCard" key={intern.user.id} onClick={() => onOpenIntern(intern.user.id)}>
            <div className="person">
              <div className="avatar small" style={{ background: intern.user.avatarColor }}>
                {intern.user.name.slice(0, 1)}
              </div>
              <div>
                <strong>{intern.user.name}</strong>
                <span>{intern.user.categoryLabel}</span>
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
            {intern.surveyAnalysis?.suggestedTrack && <small>Трек: {intern.surveyAnalysis.suggestedTrack}</small>}
            {intern.latestReportAi?.confidence && <small>Уверенность AI: {intern.latestReportAi.confidence}</small>}
          </button>
        ))}
        {!summary.interns.length && <p>В вашем департаменте пока нет AI-профилей стажеров.</p>}
      </section>
    </>
  );
}

function CriteriaBars({ review }: { review?: AiReview }) {
  if (!review?.criteria) return <p>Критерии AI появятся после новой обработки отчета.</p>;

  const items = [
    ["Конкретность результата", review.criteria.resultClarity],
    ["Ясность плана", review.criteria.planClarity],
    ["Контроль блокеров", review.criteria.blockerControl],
    ["Инициативность", review.criteria.initiative]
  ] as const;

  return (
    <div className="criteriaList">
      {items.map(([label, value]) => (
        <div className="criteriaItem" key={label}>
          <div>
            <span>{label}</span>
            <strong>{value}%</strong>
          </div>
          <div className="bar">
            <i style={{ width: `${value}%` }} />
          </div>
        </div>
      ))}
      <p>{review.explanation}</p>
    </div>
  );
}

function InternProfileView({ profile, onBack }: { profile: InternProfile; onBack: () => void }) {
  const analysis = profile.survey?.analysis;

  return (
    <section className="flow">
      <button className="backButton" onClick={onBack}>
        <ChevronLeft size={18} />
        Назад к списку
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
          <h2>Качества, навыки и цель через AI</h2>
          {analysis ? (
            <>
              <h3>Профессиональные навыки</h3>
              <p>{analysis.skillsSummary || "AI не вернул отдельную сводку по навыкам."}</p>
              <h3>Опыт</h3>
              <p>{analysis.experienceSummary || "AI не вернул отдельную сводку по опыту."}</p>
              <h3>Цель стажировки</h3>
              <p>{analysis.goalAlignment || "AI не вернул оценку цели стажировки."}</p>
              {analysis.suggestedTrack && (
                <>
                  <h3>Рекомендуемый трек</h3>
                  <p>{analysis.suggestedTrack}</p>
                </>
              )}
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
              {analysis.mentorFocus?.length ? (
                <>
                  <h3>Фокус тимлида</h3>
                  <div className="tagLine">
                    {analysis.mentorFocus.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </>
              ) : null}
              <p>{analysis.recommendation}</p>
            </>
          ) : (
            <p>Стажер еще не прошел первичный опрос.</p>
          )}
        </div>

        <div className="panel">
          <h2>План и дедлайн</h2>
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
        <h2>Дэйлики, прогнанные через AI</h2>
        <h3>Матрица потенциала под план</h3>
        <PlanFitMatrix profile={profile} />
        <div className="reportGrid">
          {profile.reports.map((report) => (
            <article className="reportCard" key={report.id}>
              <div className="reportTop">
                <strong>{report.date}</strong>
                <span>{report.aiReview?.productivityScore || 0}%</span>
              </div>
              <p>{report.aiReview?.summary || "AI-сводка отсутствует."}</p>
              <small>
                Модель: {report.aiReview?.model || "не обработано"} · Статус: {report.status === "late" ? "поздно" : "вовремя"}
              </small>
              <CriteriaBars review={report.aiReview} />
              <div className="tagLine">
                {(report.aiReview?.risks || []).map((risk) => (
                  <span key={risk}>{risk}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
