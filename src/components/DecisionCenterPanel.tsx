import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCw, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type DecisionCenter, type Plan, type PlanFitResponse } from "../api";

export function DecisionCenterPanel({ data }: { data: DecisionCenter }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedStepId, setSelectedStepId] = useState("");
  const [fit, setFit] = useState<PlanFitResponse | null>(null);
  const [loadingFit, setLoadingFit] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadPlans() {
      const endpoint = data.scope === "all" ? "/api/admin/plans" : "/api/department-plans";
      const planList = (await api<Plan[]>(endpoint)).filter((plan) => plan.status === "approved" || plan.status === "draft");
      if (!mounted) return;
      setPlans(planList);
      setSelectedPlanId((current) => current || planList[0]?.id || data.plan?.id || "");
    }

    void loadPlans();
    return () => {
      mounted = false;
    };
  }, [data.plan?.id, data.scope]);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) || null, [plans, selectedPlanId]);
  const selectedStep = useMemo(() => selectedPlan?.steps.find((step) => step.id === selectedStepId) || null, [selectedPlan, selectedStepId]);
  const candidates = fit?.candidates || (selectedPlanId === data.plan?.id && !selectedStepId ? data.recommended : []);

  useEffect(() => {
    if (!selectedPlanId) {
      setFit(null);
      return;
    }

    let mounted = true;
    async function loadFit() {
      setLoadingFit(true);
      try {
        const targetText = selectedStep
          ? `Кто лучше подойдет на задачу "${selectedStep.title}" в выбранном плане?`
          : "Кто лучше подойдет на выбранный действующий план?";
        const result = await api<PlanFitResponse>("/api/assistant/plan-fit", {
          method: "POST",
          body: JSON.stringify({
            question: targetText,
            planId: selectedPlanId,
            stepId: selectedStepId || undefined
          })
        });
        if (mounted) setFit(result);
      } finally {
        if (mounted) setLoadingFit(false);
      }
    }

    void loadFit();
    return () => {
      mounted = false;
    };
  }, [selectedPlanId, selectedStepId, selectedStep]);

  return (
    <section className="panel decisionPanel">
      <div className="decisionHeader">
        <div>
          <h2>Центр решений</h2>
          <p>{data.summary}</p>
        </div>
        <Target />
      </div>

      <div className="decisionSelector">
        <label>
          Действующий план
          <select
            value={selectedPlanId}
            onChange={(event) => {
              setSelectedPlanId(event.target.value);
              setSelectedStepId("");
              setFit(null);
            }}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title} · {plan.categoryLabel || plan.category}
              </option>
            ))}
          </select>
        </label>
        <label>
          Задача внутри плана
          <select
            value={selectedStepId}
            onChange={(event) => {
              setSelectedStepId(event.target.value);
              setFit(null);
            }}
            disabled={!selectedPlan?.steps.length}
          >
            <option value="">Весь план</option>
            {selectedPlan?.steps.map((step, index) => (
              <option key={step.id} value={step.id}>
                {index + 1}. {step.title}
              </option>
            ))}
          </select>
        </label>
        <div className="decisionTargetCard">
          <span>{selectedStep ? "Подбор под задачу" : "Подбор под план"}</span>
          <strong>{selectedStep?.title || selectedPlan?.title || "План не выбран"}</strong>
          {loadingFit ? <small><RefreshCw size={14} /> AI обновляет рекомендации...</small> : <small>{candidates.length ? `Кандидатов: ${candidates.length}` : "Кандидатов пока нет"}</small>}
        </div>
      </div>

      <div className="decisionGrid">
        <article>
          <strong>
            <CheckCircle2 size={17} />
            Кого поставить на план
          </strong>
          {candidates.length ? (
            candidates.map((candidate) => (
              <div className="decisionItem decisionCandidate" key={candidate.user.id}>
                <div className="decisionCandidateTop">
                  {candidate.user.avatarUrl ? <img className="avatar small" src={candidate.user.avatarUrl} alt={candidate.user.name} /> : <span className="avatar small" style={{ background: candidate.user.avatarColor }}>{candidate.user.name.slice(0, 1)}</span>}
                  <div>
                    <span>{candidate.user.name}</span>
                    <small>{candidate.user.categoryLabel || "департамент не выбран"} · {candidate.source === "same_department" ? "свой департамент" : "другой департамент"}</small>
                  </div>
                  <b>{candidate.score}/100</b>
                </div>
                <div className="reportScoreBar">
                  <i style={{ width: `${Math.max(0, Math.min(100, candidate.score))}%` }} />
                </div>
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
