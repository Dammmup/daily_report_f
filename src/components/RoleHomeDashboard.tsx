import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MapPin,
  NotebookPen,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Plan, User } from "../api";

export type HomeMetric = {
  label: string;
  value: string | number;
  caption?: string;
  trend?: string;
  tone?: "good" | "warn" | "danger" | "neutral";
  icon: ReactNode;
};

export type HomeAction = {
  label: string;
  title: string;
  helper: string;
  icon: ReactNode;
  done?: boolean;
  tone?: "green" | "blue" | "amber" | "dark";
  onClick?: () => void;
};

export type HomePlan = {
  id: string;
  title: string;
  category?: string;
  lead?: string;
  deadline?: string;
  progress: number;
  done?: number;
  total?: number;
  status?: string;
  onOpen?: () => void;
  tasks?: {
    id: string;
    title: string;
    meta?: string;
    status?: Plan["steps"][number]["status"];
  }[];
};

export type HomePerson = {
  id: string;
  name: string;
  caption: string;
  avatarColor: string;
  avatarUrl?: string;
  score?: number;
  active?: boolean;
  tags?: string[];
  onOpen?: () => void;
};

export type HomeAlert = {
  id: string;
  title: string;
  text: string;
  tone?: "good" | "warn" | "danger" | "info";
  actionLabel?: string;
  onAction?: () => void;
};

export function RoleHomeDashboard({
  user,
  roleLabel,
  title,
  subtitle,
  metrics,
  actions,
  plans,
  people = [],
  alerts,
  score,
  scoreLabel = "AI индекс",
  focusTitle = "Рабочий фокус",
  focusSubtitle = "Планы, шаги и сигналы собраны в одном месте."
}: {
  user: User;
  roleLabel: string;
  title: string;
  subtitle: string;
  metrics: HomeMetric[];
  actions: HomeAction[];
  plans: HomePlan[];
  people?: HomePerson[];
  alerts: HomeAlert[];
  score: number;
  scoreLabel?: string;
  focusTitle?: string;
  focusSubtitle?: string;
}) {
  const [note, setNote] = useState("");
  const noteKey = `dailyreport-note-${user.id}`;
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long"
      }).format(new Date()),
    []
  );
  const safeScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));

  useEffect(() => {
    setNote(localStorage.getItem(noteKey) || "");
  }, [noteKey]);

  function saveNote(value: string) {
    setNote(value);
    localStorage.setItem(noteKey, value);
  }

  return (
    <section className="roleHome">
      <div className="roleHero">
        <div className="roleHeroCopy">
          <span>{dateLabel} · {roleLabel}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="roleActionTiles">
          {actions.map((action) => (
            <button className={`roleActionTile ${action.done ? "done" : ""} ${action.tone || "green"}`} key={action.label} type="button" onClick={action.onClick}>
              <span>{action.icon}</span>
              <strong>{action.title}</strong>
              <small>{action.helper}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="homeDashboardGrid">
        <div className="homeMainColumn">
          <div className="homeMetricStrip">
            {metrics.map((metric) => (
              <article className={`homeMetricCard ${metric.tone || "neutral"}`} key={metric.label}>
                <span className="homeMetricIcon">{metric.icon}</span>
                <div>
                  <small>{metric.label}</small>
                  <strong>{metric.value}</strong>
                  {metric.caption ? <em>{metric.caption}</em> : null}
                </div>
                {metric.trend ? <b>{metric.trend}</b> : null}
              </article>
            ))}
          </div>

          <section className="homeProjectPanel">
            <div className="homeSectionHeader">
              <div>
                <span>{focusTitle}</span>
                <h2>{focusSubtitle}</h2>
              </div>
              <ClipboardList size={20} />
            </div>

            {plans.length ? (
              <div className="homeProjectList">
                {plans.map((plan) => (
                  <article className="homeProjectRow" key={plan.id}>
                    <button className="homeProjectSummary" type="button" onClick={plan.onOpen}>
                      <div className="projectMark">{plan.title.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>{plan.title}</strong>
                        <span>{[plan.category, plan.lead, plan.deadline ? `дедлайн ${plan.deadline}` : ""].filter(Boolean).join(" · ")}</span>
                      </div>
                      <div className="homeProgressCell">
                        <span>{plan.status || "активен"}</span>
                        <strong>{plan.progress}%</strong>
                      </div>
                    </button>
                    <div className="homeProgressBar">
                      <i style={{ width: `${Math.max(0, Math.min(100, plan.progress))}%` }} />
                    </div>
                    {typeof plan.total === "number" ? (
                      <div className="homeProjectFacts">
                        <span>{plan.done || 0}/{plan.total} готово</span>
                        <span>{Math.max((plan.total || 0) - (plan.done || 0), 0)} в работе или ожидании</span>
                      </div>
                    ) : null}
                    {plan.tasks?.length ? <TaskLanes tasks={plan.tasks} /> : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="homeEmptyState">
                <Target size={22} />
                <strong>План пока не выбран</strong>
                <span>Как только появится активный план или назначенный шаг, он будет первым в рабочем столе.</span>
              </div>
            )}
          </section>

          {people.length ? (
            <section className="homePeoplePanel">
              <div className="homeSectionHeader compact">
                <div>
                  <span>Команда и потенциал</span>
                  <h2>Быстрый просмотр стажеров</h2>
                </div>
                <Users size={20} />
              </div>
              <div className="homePeopleGrid">
                {people.slice(0, 6).map((person) => (
                  <button className="homePersonCard" key={person.id} type="button" onClick={person.onOpen}>
                    {person.avatarUrl ? <img className="avatar" src={person.avatarUrl} alt={person.name} /> : <span className="avatar" style={{ background: person.avatarColor }}>{person.name.slice(0, 1)}</span>}
                    <div>
                      <strong>{person.name}</strong>
                      <small>{person.caption}</small>
                      <div className="homePersonTags">
                        {(person.tags || []).slice(0, 2).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    {typeof person.score === "number" ? <b>{person.score}%</b> : person.active ? <CheckCircle2 size={18} /> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="homeRightRail">
          <section className="homeGaugePanel">
            <div className="homeSectionHeader compact">
              <div>
                <span>{scoreLabel}</span>
                <h2>Сводка дня</h2>
              </div>
              <Sparkles size={20} />
            </div>
            <div className="homeGauge" style={{ "--score": `${safeScore * 3.6}deg` } as CSSProperties}>
              <strong>{safeScore}</strong>
              <span>/100</span>
            </div>
            <p>{safeScore >= 75 ? "День выглядит продуктивным." : safeScore >= 45 ? "Есть рабочая динамика, но стоит проверить блокеры." : "Нужен фокус тимлида или уточнение задач."}</p>
          </section>

          <section className="homeMapPanel">
            <div className="homeMiniMap" aria-hidden="true">
              <span className="mapPinOne"><MapPin size={16} /></span>
              <span className="mapPinTwo"><Bot size={14} /></span>
              <span className="mapRoute" />
            </div>
            <div>
              <strong>Офис, Telegram и планы</strong>
              <small>Сигналы из платформы и бота попадают в одну рабочую картину.</small>
            </div>
          </section>

          <section className="homeAlertsPanel">
            <div className="homeSectionHeader compact">
              <div>
                <span>Smart alerts</span>
                <h2>Что требует внимания</h2>
              </div>
              <Bell size={20} />
            </div>
            <div className="homeAlertList">
              {alerts.length ? (
                alerts.slice(0, 5).map((alert) => (
                  <article className={`homeAlert ${alert.tone || "info"}`} key={alert.id}>
                    <span>{alert.tone === "danger" ? <AlertTriangle size={16} /> : alert.tone === "good" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}</span>
                    <div>
                      <strong>{alert.title}</strong>
                      <small>{alert.text}</small>
                      {alert.actionLabel ? (
                        <button type="button" onClick={alert.onAction}>
                          {alert.actionLabel}
                          <ArrowUpRight size={13} />
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p>Критичных уведомлений сейчас нет.</p>
              )}
            </div>
          </section>

          <section className="homeNotePanel">
            <div className="homeSectionHeader compact">
              <div>
                <span>Private notepad</span>
                <h2>Заметка</h2>
              </div>
              <NotebookPen size={20} />
            </div>
            <textarea value={note} onChange={(event) => saveNote(event.target.value)} placeholder="Быстрая мысль, вопрос к AI или напоминание..." />
          </section>
        </aside>
      </div>
    </section>
  );
}

function TaskLanes({ tasks }: { tasks: NonNullable<HomePlan["tasks"]> }) {
  const lanes = [
    { key: "todo", label: "Новые" },
    { key: "in_progress", label: "В работе" },
    { key: "done", label: "Готово" }
  ] as const;

  return (
    <div className="homeTaskLanes">
      {lanes.map((lane) => {
        const laneTasks = tasks.filter((task) => (task.status || "todo") === lane.key).slice(0, 3);
        return (
          <div className={`homeTaskLane ${lane.key}`} key={lane.key}>
            <strong>{lane.label} ({laneTasks.length})</strong>
            {laneTasks.length ? (
              laneTasks.map((task) => (
                <span className="homeTaskPill" key={task.id}>
                  {task.title}
                  {task.meta ? <small>{task.meta}</small> : null}
                </span>
              ))
            ) : (
              <em>Пусто</em>
            )}
          </div>
        );
      })}
    </div>
  );
}
