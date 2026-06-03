import { Activity, BarChart3, Bot, CalendarCheck, MapPin, Send, Target } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, uploadFile, type AttendanceSummary, type Category, type Plan, type Report, type StepThread, type User } from "../api";
import { Header } from "../components/Header";
import { Metric } from "../components/Metric";
import { ReportList } from "../components/ReportList";
import { categoryOptions } from "../constants";

export function InternDashboard({ user, onUser }: { user: User; onUser: (user: User) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [mood, setMood] = useState<"focused" | "normal" | "blocked">("focused");
  const [form, setForm] = useState({ yesterday: "", todayPlan: "", blockers: "", linkedStepIds: [] as string[] });
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [reportList, currentPlan, attendanceData] = await Promise.all([
      api<Report[]>("/api/reports"),
      api<Plan | null>("/api/my-plan"),
      api<AttendanceSummary>("/api/attendance/summary")
    ]);
    setReports(reportList);
    setPlan(currentPlan);
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

  const average = useMemo(() => {
    const scores = reports.map((report) => report.aiReview?.productivityScore || 0);
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  }, [reports]);

  const assignedSteps = useMemo(
    () => (plan?.steps || []).filter((step) => step.assignedTo === user.id && step.status !== "done" && step.status !== "canceled"),
    [plan, user.id]
  );

  return (
    <section className="flow">
      <Header eyebrow={user.categoryLabel || "Стажер"} title="Рабочий кабинет" icon={<Activity />} />
      <div className="metrics">
        <Metric icon={<CalendarCheck />} label="Отчетов" value={reports.length} />
        <Metric icon={<BarChart3 />} label="Средняя продуктивность" value={`${average}%`} />
        <Metric icon={<Target />} label="Дедлайн" value={plan?.adjustedDeadline || "не задан"} />
        <Metric
          icon={<MapPin />}
          label="Офис за неделю"
          value={`${attendanceSummary?.currentWeekOfficeDays || 0}/${attendanceSummary?.minWeeklyOfficeDays || 2}`}
        />
        <Metric icon={<Bot />} label="Telegram" value={user.telegramLinked ? "привязан" : "ожидает"} />
      </div>

      <section className="split">
        <div className="panel">
          <h2>Отметка посещаемости</h2>
          <div className="segmented">
            {(["focused", "normal", "blocked"] as const).map((item) => (
              <button key={item} className={mood === item ? "active" : ""} onClick={() => setMood(item)}>
                {item === "focused" ? "В фокусе" : item === "normal" ? "Обычный день" : "Есть блокер"}
              </button>
            ))}
          </div>
          <button className="primaryButton" onClick={checkIn}>
            <CalendarCheck size={18} />
            {attendanceSummary?.officeLocation ? "Отметиться в офисе" : "Отметиться сегодня"}
          </button>
          {attendanceSummary?.officeLocation ? (
            <small>
              {attendanceSummary.requirementMet ? "Норма офиса выполнена" : "Нужно быть в офисе минимум 2 раза в неделю"}
              {attendanceSummary.latest?.distanceMeters ? ` · последнее расстояние ${attendanceSummary.latest.distanceMeters} м` : ""}
            </small>
          ) : (
            <small>Офисная точка еще не задана тимлидом.</small>
          )}
          {attendanceMessage && <small className={attendanceMessage === "Отметка сохранена" ? "successText" : "errorText"}>{attendanceMessage}</small>}
        </div>

        <div className="panel">
          <h2>План департамента</h2>
          {plan ? (
            <>
              <div className="deadline">
                <span>Базовый дедлайн: {plan.baseDeadline}</span>
                <strong>Текущий: {plan.adjustedDeadline}</strong>
              </div>
              <p>{plan.aiRationale}</p>
              <div className="timeline">
                {plan.milestones.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              {plan.steps?.length ? (
                <div className="planSteps">
                  <h3>Шаги плана</h3>
                  <div className="stepList">
                    {plan.steps.map((step) => (
                      <article className={step.assignedTo === user.id ? "stepItem assigned" : "stepItem"} key={step.id}>
                        <div>
                          <strong>{step.title}</strong>
                          <p>{step.description}</p>
                          {step.technicalSpec ? (
                            <div className="stepDetails">
                              <strong>ТЗ</strong>
                              <p>{step.technicalSpec}</p>
                            </div>
                          ) : null}
                          {step.technicalInstruction ? (
                            <div className="stepDetails">
                              <strong>Инструкция</strong>
                              <p>{step.technicalInstruction}</p>
                            </div>
                          ) : null}
                          <small>
                            До {step.deadline} ·{" "}
                            {step.status === "done"
                              ? "готово"
                              : step.status === "in_progress"
                                ? "в работе"
                                : step.status === "canceled"
                                  ? "отменено"
                                  : "ожидает"}
                            {step.overdue ? " · просрочено" : ""}
                            {step.assignedTo === user.id ? " · назначено вам" : ""}
                          </small>
                        </div>
                        {step.assignedTo === user.id ? <InternStepThread stepId={step.id} /> : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p>Тимлид еще не утвердил план проекта для вашего департамента. Дэйлики можно писать, но они будут привязаны к плану после его создания.</p>
          )}
        </div>
      </section>

      <DepartmentChangePanel user={user} onUser={onUser} />

      <form className="panel form" onSubmit={submitReport}>
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
        {assignedSteps.length ? (
          <div className="linkedStepsBox">
            <strong>К каким шагам относится дэйлик</strong>
            {assignedSteps.map((step) => (
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
                  {step.title}
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

function isToday(value?: string) {
  return Boolean(value && value.slice(0, 10) === new Date().toISOString().slice(0, 10));
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
        Обсуждение и артефакты
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
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий по шагу" />
            <button className="secondaryButton">Добавить</button>
          </form>
          <form className="inlineForm" onSubmit={addArtifact}>
            <input value={artifact.title} onChange={(event) => setArtifact({ ...artifact, title: event.target.value })} placeholder="Название файла" />
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
