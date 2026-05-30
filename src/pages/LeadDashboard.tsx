import { BarChart3, Bot, BrainCircuit, CalendarCheck, CheckCircle2, ChevronLeft, Save, Send, Sparkles, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, type AiReview, type AiSummary, type Dashboard, type InternProfile, type Plan, type Report, type User } from "../api";
import { Header } from "../components/Header";
import { Metric } from "../components/Metric";
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
  const [departmentPlan, setDepartmentPlan] = useState<Plan | null>(null);
  const [selectedIntern, setSelectedIntern] = useState<InternProfile | null>(null);
  const [tab, setTab] = useState<"overview" | "ai">("overview");
  const [planForm, setPlanForm] = useState<PlanForm>({
    title: "Проект департамента",
    baseDeadline: "2026-06-20",
    milestones: "Анализ требований\nРеализация MVP\nТестирование\nДемо тимлиду"
  });
  const [savingPlan, setSavingPlan] = useState(false);

  async function refresh() {
    const [dashboardData, summaryData, planData] = await Promise.all([
      api<Dashboard>("/api/dashboard"),
      api<AiSummary>("/api/ai-summary"),
      api<Plan | null>("/api/my-plan")
    ]);
    setDashboard(dashboardData);
    setAiSummary(summaryData);
    setDepartmentPlan(planData);
    if (planData) {
      setPlanForm({
        title: planData.title,
        baseDeadline: planData.baseDeadline,
        milestones: planData.milestones.join("\n")
      });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function openIntern(id: string) {
    setSelectedIntern(await api<InternProfile>(`/api/interns/${id}`));
  }

  async function submitDepartmentPlan(event: FormEvent) {
    event.preventDefault();
    setSavingPlan(true);
    try {
      const milestones = planForm.milestones
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const saved = await api<Plan>("/api/department-plan", {
        method: "POST",
        body: JSON.stringify({ ...planForm, milestones })
      });
      setDepartmentPlan(saved);
      await refresh();
    } finally {
      setSavingPlan(false);
    }
  }

  if (!dashboard || !aiSummary) return <ShellLoading />;

  if (selectedIntern) {
    return <InternProfileView profile={selectedIntern} onBack={() => setSelectedIntern(null)} />;
  }

  return (
    <section className="flow">
      <Header eyebrow={user.categoryLabel || "Тимлид"} title={tab === "overview" ? "Активность стажеров" : "AI-сводка стажеров"} icon={<Users />} />
      <TelegramHelp user={user} />

      <section className="split">
        <LeadDailyPanel />
        <TelegramDigestPanel />
      </section>

      <section className="split">
        <form className="panel form" onSubmit={submitDepartmentPlan}>
          <h2>План проекта департамента</h2>
          <p className="mutedText">План создается и утверждается только для вашего департамента. Стажеры этого департамента будут писать дэйлики по нему.</p>
          <label>
            Название
            <input value={planForm.title} onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })} />
          </label>
          <label>
            Базовый дедлайн
            <input type="date" value={planForm.baseDeadline} onChange={(event) => setPlanForm({ ...planForm, baseDeadline: event.target.value })} />
          </label>
          <label>
            Этапы
            <textarea value={planForm.milestones} onChange={(event) => setPlanForm({ ...planForm, milestones: event.target.value })} />
          </label>
          <button className="primaryButton" disabled={savingPlan}>
            <Save size={18} />
            {savingPlan ? "Сохраняю..." : departmentPlan ? "Обновить утвержденный план" : "Создать и утвердить план"}
          </button>
        </form>

        <div className="panel">
          <h2>Утвержденный план</h2>
          {departmentPlan ? (
            <>
              <div className="deadline">
                <span>Базовый дедлайн: {departmentPlan.baseDeadline}</span>
                <strong>Текущий: {departmentPlan.adjustedDeadline}</strong>
              </div>
              <div className="status ok">
                <CheckCircle2 size={14} />
                {departmentPlan.status === "approved" ? "утвержден" : "черновик"}
              </div>
              <p>{departmentPlan.aiRationale}</p>
              <div className="timeline">
                {departmentPlan.milestones.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </>
          ) : (
            <p>План еще не создан. После утверждения он появится у всех стажеров вашего департамента.</p>
          )}
        </div>
      </section>

      <div className="tabs inlineTabs">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          Обзор
        </button>
        <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>
          AI-сводка
        </button>
      </div>

      {tab === "overview" ? <Overview dashboard={dashboard} onOpenIntern={openIntern} /> : <AiSummaryView summary={aiSummary} onOpenIntern={openIntern} />}
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
