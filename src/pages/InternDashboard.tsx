import { Activity, BarChart3, Bot, CalendarCheck, CheckCircle2, ClipboardList, FileText, ListChecks, MapPin, Send, Target } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, uploadFile, type AttendanceSummary, type Category, type Plan, type Report, type StepThread, type User } from "../api";
import { Header } from "../components/Header";
import { Metric } from "../components/Metric";
import { ReportList } from "../components/ReportList";
import { categoryOptions } from "../constants";
import { businessDateIso } from "../date";

export function InternDashboard({ user, onUser }: { user: User; onUser: (user: User) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [mood, setMood] = useState<"focused" | "normal" | "blocked">("focused");
  const [form, setForm] = useState({ yesterday: "", todayPlan: "", blockers: "", linkedStepIds: [] as string[] });
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [stepMessage, setStepMessage] = useState("");
  const [stepBusyId, setStepBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dailyFormRef = useRef<HTMLFormElement>(null);
  const planRef = useRef<HTMLElement>(null);

  async function refresh() {
    const [reportList, planList, attendanceData] = await Promise.all([
      api<Report[]>("/api/reports"),
      api<Plan[]>("/api/department-plans"),
      api<AttendanceSummary>("/api/attendance/summary")
    ]);
    setReports(reportList);
    setPlans(planList.filter(isActivePlan));
    setAttendanceSummary(attendanceData);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function checkIn() {
    setAttendanceMessage("");
    try {
      if (attendanceSummary?.officeLocation && !navigator.geolocation) {
        setAttendanceMessage("Браузер не поддерживает геолокацию. Откройте Mini App в Telegram или современном браузере.");
        return;
      }

      const position = attendanceSummary?.officeLocation
        ? await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }))
        : null;

      await api("/api/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({
          mood,
          latitude: position?.coords.latitude,
          longitude: position?.coords.longitude,
          accuracyMeters: position?.coords.accuracy
        })
      });
      setAttendanceMessage("Отметка сохранена");
      await refresh();
    } catch (error) {
      const geoError = typeof error === "object" && error && "code" in error ? (error as { code: number }) : null;
      setAttendanceMessage(
        geoError?.code === 1
          ? "Разрешите геолокацию в Telegram или браузере, чтобы подтвердить присутствие в офисе."
          : geoError?.code === 2
            ? "Не удалось получить координаты. Проверьте GPS и попробуйте еще раз."
            : geoError?.code === 3
              ? "Геолокация отвечает слишком долго. Подойдите к окну или попробуйте еще раз."
              : error instanceof Error
                ? error.message
                : "Не удалось сохранить отметку."
      );
    }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (editingReportId) {
        await api(`/api/reports/${editingReportId}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await api("/api/reports", { method: "POST", body: JSON.stringify(form) });
      }
      setForm({ yesterday: "", todayPlan: "", blockers: "", linkedStepIds: [] });
      setEditingReportId(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function claimStep(stepId: string) {
    setStepBusyId(stepId);
    setStepMessage("");
    try {
      const saved = await api<Plan>(`/api/department-plan/steps/${stepId}/claim`, { method: "POST" });
      setPlans((current) => current.map((plan) => (plan.id === saved.id ? saved : plan)));
      setStepMessage("Шаг взят в работу");
    } catch (error) {
      setStepMessage(error instanceof Error ? error.message : "Не удалось взять шаг");
    } finally {
      setStepBusyId(null);
    }
  }

  async function updateMyStepStatus(stepId: string, status: Plan["steps"][number]["status"]) {
    setStepBusyId(stepId);
    setStepMessage("");
    try {
      const saved = await api<Plan>(`/api/department-plan/steps/${stepId}/my-status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setPlans((current) => current.map((plan) => (plan.id === saved.id ? saved : plan)));
      setStepMessage("Статус шага обновлен");
    } catch (error) {
      setStepMessage(error instanceof Error ? error.message : "Не удалось обновить статус");
    } finally {
      setStepBusyId(null);
    }
  }

  const average = useMemo(() => {
    const scores = reports.map((report) => report.aiReview?.productivityScore || 0);
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  }, [reports]);

  const planStepRows = useMemo(() => plans.flatMap((plan) => (plan.steps || []).map((step) => ({ plan, step }))), [plans]);
  const assignedSteps = useMemo(
    () => planStepRows.filter(({ step }) => step.assignedTo === user.id && step.status !== "done" && step.status !== "canceled"),
    [planStepRows, user.id]
  );
  const completedAssignedSteps = useMemo(
    () => planStepRows.filter(({ step }) => step.assignedTo === user.id && step.status === "done"),
    [planStepRows, user.id]
  );
  const reportLinkableSteps = useMemo(() => [...assignedSteps, ...completedAssignedSteps], [assignedSteps, completedAssignedSteps]);
  const availableSteps = useMemo(
    () => planStepRows.filter(({ step }) => !step.assignedTo && step.status !== "done" && step.status !== "canceled"),
    [planStepRows]
  );
  const todayReport = useMemo(() => reports.find((report) => isToday(report.date) || isToday(report.createdAt)), [reports]);
  const completedSteps = useMemo(() => planStepRows.filter(({ step }) => step.status === "done").length, [planStepRows]);
  const planProgress = planStepRows.length ? Math.round((completedSteps / planStepRows.length) * 100) : 0;
  const nearestDeadline = useMemo(
    () => [...plans].sort((left, right) => left.adjustedDeadline.localeCompare(right.adjustedDeadline))[0]?.adjustedDeadline,
    [plans]
  );

  return (
    <section className="flow">
      <Header eyebrow={user.categoryLabel || "Стажер"} title="Рабочий день" icon={<Activity />} />

      <section className="internCommandCenter">
        <div className="internCommandHeader">
          <div>
            <span>Сегодня</span>
            <h2>Отметка, дэйлик, шаг</h2>
            <p>Главные действия вынесены наверх. Остальные детали можно открыть ниже, когда они понадобятся.</p>
          </div>
          <div className="moodStrip" aria-label="Настроение дня">
            {(["focused", "normal", "blocked"] as const).map((item) => (
              <button key={item} className={mood === item ? "active" : ""} onClick={() => setMood(item)} type="button">
                {item === "focused" ? "В фокусе" : item === "normal" ? "Обычный день" : "Есть блокер"}
              </button>
            ))}
          </div>
        </div>

        <div className="internActionGrid">
          <button className={attendanceSummary?.checkedInToday ? "internActionCard done" : "internActionCard"} onClick={checkIn} type="button">
            <span className="actionIcon"><CalendarCheck size={22} /></span>
            <strong>{attendanceSummary?.checkedInToday ? "Отметка есть" : "Отметиться"}</strong>
            <small>
              {attendanceSummary?.officeLocation
                ? `${attendanceSummary.currentWeekOfficeDays || 0}/${attendanceSummary.minWeeklyOfficeDays || 2} офиса за неделю`
                : "Офисная точка не задана"}
            </small>
          </button>
          <button className={todayReport ? "internActionCard done" : "internActionCard"} onClick={() => dailyFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} type="button">
            <span className="actionIcon"><FileText size={22} /></span>
            <strong>{todayReport ? "Дэйлик отправлен" : "Написать дэйлик"}</strong>
            <small>{todayReport?.aiReview ? `AI оценка ${todayReport.aiReview.productivityScore}%` : "Вчера, сегодня, блокеры"}</small>
          </button>
          <button className={assignedSteps.length || completedAssignedSteps.length ? "internActionCard done" : "internActionCard"} onClick={() => planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} type="button">
            <span className="actionIcon"><ListChecks size={22} /></span>
            <strong>{assignedSteps.length ? "Шаг в работе" : completedAssignedSteps.length ? "Шаг завершен" : "Взять шаг"}</strong>
            <small>{assignedSteps[0]?.step.title || completedAssignedSteps[0]?.step.title || (availableSteps.length ? `${availableSteps.length} свободных шагов` : "Ждем план или назначение")}</small>
          </button>
        </div>

        {(attendanceMessage || stepMessage) && (
          <div className="actionMessage">
            {attendanceMessage ? <small className={attendanceMessage === "Отметка сохранена" ? "successText" : "errorText"}>{attendanceMessage}</small> : null}
            {stepMessage ? <small className={stepMessage.includes("Не") ? "errorText" : "successText"}>{stepMessage}</small> : null}
          </div>
        )}
      </section>

      <div className="metrics compactMetrics">
        <Metric icon={<CalendarCheck />} label="Отчетов" value={reports.length} />
        <Metric icon={<BarChart3 />} label="Средняя продуктивность" value={`${average}%`} />
        <Metric icon={<Target />} label="Дедлайн" value={nearestDeadline || "не задан"} />
        <Metric
          icon={<MapPin />}
          label="Офис за неделю"
          value={`${attendanceSummary?.currentWeekOfficeDays || 0}/${attendanceSummary?.minWeeklyOfficeDays || 2}`}
        />
        <Metric icon={<Bot />} label="Telegram" value={user.telegramLinked ? "привязан" : "ожидает"} />
      </div>

      <section className="panel internPlanPanel" ref={planRef}>
        <div className="sectionTitleLine">
          <div>
            <span>План департамента</span>
            <h2>{plans.length ? "Активные планы" : "План еще не создан"}</h2>
          </div>
          {planStepRows.length ? (
            <div className="planProgressBadge">
              <strong>{planProgress}%</strong>
              <span>{completedSteps}/{planStepRows.length} готово</span>
            </div>
          ) : null}
        </div>

        {plans.length ? (
          <>
            <div className="deadline compactDeadline">
              <span>Активных планов: {plans.length}</span>
              <strong>Ближайший дедлайн: {nearestDeadline || "не задан"}</strong>
            </div>
            <div className="progressBar wideProgress">
              <i style={{ width: `${planProgress}%` }} />
            </div>

            {assignedSteps.length ? (
              <div className="internTaskSection">
                <h3><CheckCircle2 size={18} /> Ваши шаги</h3>
                <div className="internTaskGrid">
                  {assignedSteps.map(({ plan, step }) => (
                    <InternPlanStepCard
                      key={step.id}
                      step={step}
                      planTitle={plan.title}
                      mine
                      busy={stepBusyId === step.id}
                      onClaim={() => claimStep(step.id)}
                      onStatus={(status) => updateMyStepStatus(step.id, status)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {completedAssignedSteps.length ? (
              <div className="internTaskSection">
                <h3><CheckCircle2 size={18} /> Завершенные шаги</h3>
                <div className="internTaskGrid">
                  {completedAssignedSteps.map(({ plan, step }) => (
                    <InternPlanStepCard
                      key={step.id}
                      step={step}
                      planTitle={plan.title}
                      mine
                      busy={stepBusyId === step.id}
                      onClaim={() => claimStep(step.id)}
                      onStatus={(status) => updateMyStepStatus(step.id, status)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {availableSteps.length ? (
              <div className="internTaskSection">
                <h3><ClipboardList size={18} /> Свободные шаги</h3>
                <div className="internTaskGrid">
                  {availableSteps.slice(0, 8).map(({ plan, step }) => (
                    <InternPlanStepCard
                      key={step.id}
                      step={step}
                      planTitle={plan.title}
                      busy={stepBusyId === step.id}
                      onClaim={() => claimStep(step.id)}
                      onStatus={(status) => updateMyStepStatus(step.id, status)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {!assignedSteps.length && !completedAssignedSteps.length && !availableSteps.length ? (
              <p className="mutedText">Все шаги уже назначены или закрыты. Дэйлик можно отправить без привязки к шагу.</p>
            ) : null}

            {plans.length ? (
              <div className="timeline compactTimeline">
                {plans.slice(0, 4).map((plan) => (
                  <span key={plan.id}>{plan.title} · {plan.adjustedDeadline}</span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p>Тимлид еще не утвердил план проекта для вашего департамента. Дэйлики можно писать сейчас, а шаги появятся после создания плана.</p>
        )}
      </section>

      <DepartmentChangePanel user={user} onUser={onUser} />

      <form className="panel form dailyReportPanel" onSubmit={submitReport} ref={dailyFormRef}>
        <h2>{editingReportId ? "Редактирование дэйлика" : "Дневной отчет"}</h2>
        <label>
          Что сделано вчера
          <textarea value={form.yesterday} onChange={(event) => setForm({ ...form, yesterday: event.target.value })} />
        </label>
        <label>
          План на сегодня
          <textarea value={form.todayPlan} onChange={(event) => setForm({ ...form, todayPlan: event.target.value })} />
        </label>
        <label>
          Технические неполадки или блокеры
          <textarea value={form.blockers} onChange={(event) => setForm({ ...form, blockers: event.target.value })} />
        </label>
        {reportLinkableSteps.length ? (
          <div className="linkedStepsBox">
            <strong>К каким шагам относится дэйлик</strong>
            {reportLinkableSteps.map(({ plan, step }) => (
              <label className="checkLine" key={step.id}>
                <input
                  type="checkbox"
                  checked={form.linkedStepIds.includes(step.id)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      linkedStepIds: event.target.checked ? [...form.linkedStepIds, step.id] : form.linkedStepIds.filter((id) => id !== step.id)
                    })
                  }
                />
                <span>
                  {plan.title}: {step.title}
                  {step.status === "done" ? " · готово" : ""}
                  {step.overdue ? " · просрочено" : ""}
                </span>
              </label>
            ))}
          </div>
        ) : null}
        <button className="primaryButton" disabled={busy}>
          <Send size={18} />
          {busy ? "AI проверяет..." : editingReportId ? "Сохранить изменения" : "Отправить отчет"}
        </button>
      </form>

      <ReportList
        reports={reports}
        onEdit={(report) => {
          setEditingReportId(report.id);
          setForm({
            yesterday: report.yesterday,
            todayPlan: report.todayPlan,
            blockers: report.blockers,
            linkedStepIds: report.linkedStepIds || []
          });
        }}
      />
    </section>
  );
}

function InternPlanStepCard({
  step,
  planTitle,
  mine,
  busy,
  onClaim,
  onStatus
}: {
  step: Plan["steps"][number];
  planTitle: string;
  mine?: boolean;
  busy: boolean;
  onClaim: () => void;
  onStatus: (status: Plan["steps"][number]["status"]) => void;
}) {
  return (
    <article className={mine ? "internStepCard mine" : "internStepCard"}>
      <div className="internStepHeader">
        <span className={`status ${step.status === "done" ? "ok" : ""}`}>{stepStatusText(step.status)}</span>
        <small>До {step.deadline}{step.overdue ? " · просрочено" : ""}</small>
      </div>
      <span className="stepPlanLabel">{planTitle}</span>
      <strong>{step.title}</strong>
      <p>{step.description || "Описание появится после уточнения шага."}</p>
      {(step.technicalSpec || step.technicalInstruction) && (
        <div className="stepMaterialPreview">
          {step.technicalSpec ? <span>ТЗ добавлено</span> : null}
          {step.technicalInstruction ? <span>Инструкция добавлена</span> : null}
        </div>
      )}
      {mine ? (
        <>
          <div className="stepStatusActions">
            <button className="secondaryButton" type="button" onClick={() => onStatus("in_progress")} disabled={busy || step.status === "in_progress"}>
              В работе
            </button>
            <button className="primaryButton" type="button" onClick={() => onStatus("done")} disabled={busy || step.status === "done"}>
              Готово
            </button>
          </div>
          <InternStepThread stepId={step.id} />
        </>
      ) : (
        <button className="primaryButton" type="button" onClick={onClaim} disabled={busy}>
          {busy ? "Назначаю..." : "Взять шаг"}
        </button>
      )}
    </article>
  );
}

function stepStatusText(status: Plan["steps"][number]["status"]) {
  if (status === "done") return "готово";
  if (status === "in_progress") return "в работе";
  if (status === "canceled") return "отменено";
  return "ожидает";
}

function isActivePlan(plan: Plan) {
  return plan.status === "draft" || plan.status === "approved";
}

function isToday(value?: string) {
  return Boolean(value && businessDateIso(new Date(value)) === businessDateIso());
}

function DepartmentChangePanel({ user, onUser }: { user: User; onUser: (user: User) => void }) {
  const [category, setCategory] = useState<Category>(user.category || "erp-development");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const lockedToday = isToday(user.lastDepartmentChangedAt);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const result = await api<{ user: User }>("/api/department", {
        method: "POST",
        body: JSON.stringify({ category, reason })
      });
      onUser(result.user);
      setReason("");
      setMessage("Департамент обновлен");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сменить департамент");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Департамент стажера</h2>
      <p className="mutedText">
        Текущий департамент: {user.categoryLabel || "не выбран"}. Стажер может сменить департамент один раз в день, если объяснит причину.
      </p>
      <label>
        Новый департамент
        <select value={category} onChange={(event) => setCategory(event.target.value as Category)} disabled={lockedToday}>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Причина смены
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Например: хочу перейти в ML, потому что задача и навыки больше соответствуют этому направлению"
          disabled={lockedToday}
        />
      </label>
      <button className="secondaryButton" disabled={saving || lockedToday || category === user.category}>
        {lockedToday ? "Сегодня уже меняли департамент" : saving ? "Сохраняю..." : "Сменить департамент"}
      </button>
      {user.lastDepartmentChangeReason && <small>Последняя причина: {user.lastDepartmentChangeReason}</small>}
      {message && <small>{message}</small>}
    </form>
  );
}

function InternStepThread({ stepId }: { stepId: string }) {
  const [thread, setThread] = useState<StepThread | null>(null);
  const [comment, setComment] = useState("");
  const [artifact, setArtifact] = useState({ title: "", url: "" });
  const [uploading, setUploading] = useState(false);

  async function load() {
    setThread(await api<StepThread>(`/api/department-plan/steps/${stepId}/thread`));
  }

  useEffect(() => {
    load();
  }, [stepId]);

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
        Материалы результата{thread?.artifacts.length ? ` · ${thread.artifacts.length}` : ""}
      </button>
      {thread ? (
        <>
          <div className="tagLine">
            {thread.artifacts.map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
            ))}
            {!thread.artifacts.length ? <span>Материалы еще не прикреплены</span> : null}
          </div>
          <div className="tagLine">
            {thread.comments.slice(-3).map((item) => (
              <span key={item.id}>{item.user?.name || "user"}: {item.text}</span>
            ))}
            {!thread.comments.length ? <span>Комментариев пока нет</span> : null}
          </div>
          <form className="inlineForm" onSubmit={addComment}>
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий по шагу" />
            <button className="secondaryButton">Добавить</button>
          </form>
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
