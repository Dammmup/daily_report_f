import { BarChart3, CalendarCheck, FileText, PencilLine, Sparkles } from "lucide-react";
import type { Report } from "../api";
import { businessDateIso } from "../date";

export function ReportList({ reports, onEdit }: { reports: Report[]; onEdit?: (report: Report) => void }) {
  const aiReviewed = reports.filter((report) => report.aiReview).length;
  const average = reports.length ? Math.round(reports.reduce((sum, report) => sum + (report.aiReview?.productivityScore || 0), 0) / reports.length) : 0;

  return (
    <section className="panel activityPanel">
      <div className="homeSectionHeader compact">
        <div>
          <span>Timesheets & AI</span>
          <h2>AI-сводка отчетов</h2>
        </div>
        <FileText size={20} />
      </div>
      <div className="activityStats">
        <div>
          <CalendarCheck size={16} />
          <span>Всего</span>
          <strong>{reports.length}</strong>
        </div>
        <div>
          <Sparkles size={16} />
          <span>AI проверил</span>
          <strong>{aiReviewed}</strong>
        </div>
        <div>
          <BarChart3 size={16} />
          <span>Средний балл</span>
          <strong>{average}%</strong>
        </div>
      </div>
      <div className="reportGrid timelineReports">
        {reports.map((report) => (
          <article className="reportCard" key={report.id}>
            <div className="reportTop">
              <div>
                <strong>{report.user?.name || report.date}</strong>
                <small>{new Date(report.createdAt || report.date).toLocaleString("ru-RU")}</small>
              </div>
              <span className={scoreTone(report.aiReview?.productivityScore || 0)}>{report.aiReview?.productivityScore || 0}%</span>
            </div>
            <div className="reportScoreBar">
              <i style={{ width: `${Math.max(0, Math.min(100, report.aiReview?.productivityScore || 0))}%` }} />
            </div>
            <p>{report.aiReview?.summary || report.yesterday}</p>
            {report.linkedStepIds?.length ? <small>Связано с шагами плана: {report.linkedStepIds.length}</small> : null}
            <div className="tagLine">
              {(report.aiReview?.nextActions || []).slice(0, 2).map((action) => (
                <span key={action}>{action}</span>
              ))}
            </div>
            {onEdit && report.date === businessDateIso() ? (
              <button className="ghostButton" type="button" onClick={() => onEdit(report)}>
                <PencilLine size={16} />
                Редактировать
              </button>
            ) : null}
            {report.aiReview?.deadlineImpactDays ? <small>Влияние на дедлайн: +{report.aiReview.deadlineImpactDays} дн.</small> : null}
          </article>
        ))}
        {!reports.length && <p>Отчетов пока нет.</p>}
      </div>
    </section>
  );
}

function scoreTone(score: number) {
  if (score >= 75) return "scoreBadge good";
  if (score >= 45) return "scoreBadge warn";
  return "scoreBadge danger";
}
