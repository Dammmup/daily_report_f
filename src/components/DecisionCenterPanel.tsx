import { AlertTriangle, CheckCircle2, ClipboardList, Target, Users } from "lucide-react";
import type { DecisionCenter } from "../api";

export function DecisionCenterPanel({ data }: { data: DecisionCenter }) {
  return (
    <section className="panel decisionPanel">
      <div className="decisionHeader">
        <div>
          <h2>Центр решений</h2>
          <p>{data.summary}</p>
        </div>
        <Target />
      </div>

      <div className="decisionGrid">
        <article>
          <strong>
            <CheckCircle2 size={17} />
            Кого поставить на план
          </strong>
          {data.recommended.length ? (
            data.recommended.map((candidate) => (
              <div className="decisionItem" key={candidate.user.id}>
                <span>{candidate.user.name}</span>
                <b>{candidate.score}/100</b>
                <small>{candidate.matchReason}</small>
              </div>
            ))
          ) : (
            <p>Нет кандидатов с AI-профилем. Нужно, чтобы стажеры прошли миниопрос.</p>
          )}
        </article>

        <article>
          <strong>
            <AlertTriangle size={17} />
            Зона внимания
          </strong>
          {data.attention.length ? (
            data.attention.map((item) => (
              <div className="decisionItem" key={item.user.id}>
                <span>{item.user.name}</span>
                <b>{item.severity}</b>
                <small>{item.reason}</small>
              </div>
            ))
          ) : (
            <p>Критичных просадок сейчас не видно.</p>
          )}
        </article>

        <article>
          <strong>
            <Users size={17} />
            Нет дэйлика сегодня
          </strong>
          {data.missingReports.length ? (
            <div className="tagLine">
              {data.missingReports.slice(0, 8).map((user) => (
                <span key={user.id}>{user.name}</span>
              ))}
            </div>
          ) : (
            <p>Все нужные дэйлики на сегодня закрыты.</p>
          )}
        </article>

        <article>
          <strong>
            <ClipboardList size={17} />
            Блокеры по плану
          </strong>
          {data.blockerReports.length ? (
            data.blockerReports.map((report) => (
              <div className="decisionItem" key={`${report.user.id}-${report.date}`}>
                <span>{report.user.name}</span>
                <b>{report.date}</b>
                <small>{report.blockers}</small>
              </div>
            ))
          ) : (
            <p>Свежих блокеров в дэйликах не найдено.</p>
          )}
        </article>
      </div>
    </section>
  );
}
