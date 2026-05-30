import { Activity, BarChart3, Bot, CalendarCheck, Send, Target } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type Plan, type Report, type User } from "../api";
import { Header } from "../components/Header";
import { Metric } from "../components/Metric";
import { ReportList } from "../components/ReportList";

export function InternDashboard({ user }: { user: User }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [mood, setMood] = useState<"focused" | "normal" | "blocked">("focused");
  const [form, setForm] = useState({ yesterday: "", todayPlan: "", blockers: "" });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [reportList, currentPlan] = await Promise.all([api<Report[]>("/api/reports"), api<Plan | null>("/api/my-plan")]);
    setReports(reportList);
    setPlan(currentPlan);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function checkIn() {
    await api("/api/attendance/check-in", { method: "POST", body: JSON.stringify({ mood }) });
    await refresh();
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/reports", { method: "POST", body: JSON.stringify(form) });
      setForm({ yesterday: "", todayPlan: "", blockers: "" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const average = useMemo(() => {
    const scores = reports.map((report) => report.aiReview?.productivityScore || 0);
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  }, [reports]);

  return (
    <section className="flow">
      <Header eyebrow={user.categoryLabel || "Стажер"} title="Рабочий кабинет" icon={<Activity />} />
      <div className="metrics">
        <Metric icon={<CalendarCheck />} label="Отчетов" value={reports.length} />
        <Metric icon={<BarChart3 />} label="Средняя продуктивность" value={`${average}%`} />
        <Metric icon={<Target />} label="Дедлайн" value={plan?.adjustedDeadline || "не задан"} />
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
            Отметиться сегодня
          </button>
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
            </>
          ) : (
            <p>Тимлид еще не утвердил план проекта для вашего департамента. Дэйлики можно писать, но они будут привязаны к плану после его создания.</p>
          )}
        </div>
      </section>

      <form className="panel form" onSubmit={submitReport}>
        <h2>Дневной отчет</h2>
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
        <button className="primaryButton" disabled={busy}>
          <Send size={18} />
          {busy ? "AI проверяет..." : "Отправить отчет"}
        </button>
      </form>

      <ReportList reports={reports} />
    </section>
  );
}
