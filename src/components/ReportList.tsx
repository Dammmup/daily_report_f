import type { Report } from "../api";

export function ReportList({ reports }: { reports: Report[] }) {
  return (
    <section className="panel">
      <h2>AI-сводка отчетов</h2>
      <div className="reportGrid">
        {reports.map((report) => (
          <article className="reportCard" key={report.id}>
            <div className="reportTop">
              <strong>{report.user?.name || report.date}</strong>
              <span>{report.aiReview?.productivityScore || 0}%</span>
            </div>
            <p>{report.aiReview?.summary || report.yesterday}</p>
            <div className="tagLine">
              {(report.aiReview?.nextActions || []).slice(0, 2).map((action) => (
                <span key={action}>{action}</span>
              ))}
            </div>
            {report.aiReview?.deadlineImpactDays ? <small>Влияние на дедлайн: +{report.aiReview.deadlineImpactDays} дн.</small> : null}
          </article>
        ))}
        {!reports.length && <p>Отчетов пока нет.</p>}
      </div>
    </section>
  );
}
