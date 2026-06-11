import { AlertTriangle, CheckCircle2, Sparkles, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type AssignmentApplyResult, type AssignmentDraft, type AssignmentDraftItem, type Plan } from "../api";
import { Avatar } from "./Avatar";

export function AssignmentDraftPanel({ plan, onApplied }: { plan: Plan | null; onApplied: (plan: Plan) => void }) {
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDraft(null);
    setSelectedUsers({});
    setMessage("");
  }, [plan?.id]);

  const selectedAssignments = useMemo(() => {
    if (!draft) return [];
    return draft.items
      .map((item) => ({ stepId: item.stepId, userId: selectedUsers[item.stepId] }))
      .filter((item) => Boolean(item.userId));
  }, [draft, selectedUsers]);

  function assignableAlternatives(item: AssignmentDraftItem) {
    return item.alternatives.filter((candidate) => candidate.user.category === draft?.plan?.category);
  }

  async function generateDraft() {
    if (!plan) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api<AssignmentDraft>(`/api/department-plan/${plan.id}/assignment-draft`, { method: "POST" });
      const initialSelection: Record<string, string> = {};
      result.items.forEach((item) => {
        const firstAssignable = item.alternatives.find((candidate) => candidate.user.category === result.plan?.category);
        if (firstAssignable) initialSelection[item.stepId] = firstAssignable.user.id;
      });
      setDraft(result);
      setSelectedUsers(initialSelection);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подготовить AI-распределение.");
    } finally {
      setBusy(false);
    }
  }

  async function applyDraft() {
    if (!plan || !selectedAssignments.length) return;
    setApplying(true);
    setMessage("");
    try {
      const result = await api<AssignmentApplyResult>(`/api/department-plan/${plan.id}/assignments/apply`, {
        method: "POST",
        body: JSON.stringify({ assignments: selectedAssignments })
      });
      onApplied(result.plan);
      setDraft(null);
      setSelectedUsers({});
      setMessage(`Назначено шагов: ${result.applied.length}${result.skipped.length ? `, пропущено: ${result.skipped.length}` : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось применить назначения.");
    } finally {
      setApplying(false);
    }
  }

  if (!plan || plan.status === "completed" || plan.status === "archived") return null;

  return (
    <section className="assignmentPanel">
      <div className="reportTop">
        <div>
          <h3>AI-распределение шагов</h3>
          <p className="mutedText">AI-PM подберет стажеров по навыкам, продуктивности, посещаемости и текущей загрузке.</p>
        </div>
        <button className="secondaryButton" type="button" onClick={generateDraft} disabled={busy}>
          <Sparkles size={16} />
          {busy ? "Готовлю..." : "Подготовить черновик"}
        </button>
      </div>

      {draft ? (
        <>
          <div className="assignmentSummary">
            <CheckCircle2 size={18} />
            <span>{draft.summary}</span>
          </div>
          <div className="assignmentGrid">
            {draft.items.map((item) => {
              const options = assignableAlternatives(item);
              return (
                <article className="assignmentCard" key={item.stepId}>
                  <div className="assignmentCardHeader">
                    <div>
                      <strong>{item.stepTitle}</strong>
                      <small>Дедлайн: {item.deadline}</small>
                    </div>
                    <span className={`assignmentScore ${item.confidence}`}>{item.score}/100</span>
                  </div>
                  <p>{item.stepDescription || "Описание шага не заполнено."}</p>
                  <div className="person compactPerson">
                    <Avatar small name={item.recommendedUser.name} avatarColor={item.recommendedUser.avatarColor} avatarUrl={item.recommendedUser.avatarUrl} />
                    <div>
                      <strong>{item.recommendedUser.name}</strong>
                      <span>{item.recommendedUser.categoryLabel || "департамент не выбран"}</span>
                    </div>
                  </div>
                  <p className="assignmentReason">{item.reason}</p>
                  {item.risks.length ? (
                    <div className="assignmentRisks">
                      <AlertTriangle size={15} />
                      <span>{item.risks.join(" ")}</span>
                    </div>
                  ) : null}
                  <label>
                    Кого назначить
                    <select
                      value={selectedUsers[item.stepId] || ""}
                      onChange={(event) => setSelectedUsers((current) => ({ ...current, [item.stepId]: event.target.value }))}
                      disabled={!options.length}
                    >
                      <option value="">Не назначать</option>
                      {options.map((candidate) => (
                        <option key={candidate.user.id} value={candidate.user.id}>
                          {candidate.user.name} · {candidate.score}/100
                        </option>
                      ))}
                    </select>
                  </label>
                  {!options.length ? <small className="errorText">Нет применимых кандидатов внутри департамента.</small> : null}
                </article>
              );
            })}
          </div>
          {draft.skippedSteps.length ? (
            <small className="mutedText">Пропущено шагов: {draft.skippedSteps.length}. Уже назначенные, завершенные и отмененные шаги AI не перезаписывает.</small>
          ) : null}
          <div className="buttonRow">
            <button className="ghostButton lightButton" type="button" onClick={() => setDraft(null)}>
              Сбросить черновик
            </button>
            <button className="primaryButton" type="button" onClick={applyDraft} disabled={applying || !selectedAssignments.length}>
              <UserCheck size={18} />
              {applying ? "Применяю..." : `Применить назначения (${selectedAssignments.length})`}
            </button>
          </div>
        </>
      ) : null}

      {message ? <small className={message.startsWith("Назначено") ? "successText" : "errorText"}>{message}</small> : null}
    </section>
  );
}
