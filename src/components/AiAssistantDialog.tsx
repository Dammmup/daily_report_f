import { Bot, Send, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, type Plan, type PlanFitResponse } from "../api";

type AssistantPlan = Pick<Plan, "id" | "title" | "category" | "adjustedDeadline"> & {
  categoryLabel?: string;
};

const quickQuestions = [
  "Кто сможет продумать архитектуру по текущему плану?",
  "Кому лучше поручить логику и сложные задачи?",
  "Кто сможет выполнить план без сильного риска по дедлайну?",
  "Кто сейчас в зоне риска и почему?",
  "Кого можно подтянуть из другого департамента?"
];

export function AiAssistantDialog({ plans = [] }: { plans?: AssistantPlan[] }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("Сможет ли стажер выполнить план, описанный тимлидом?");
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [result, setResult] = useState<PlanFitResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!planId && plans[0]?.id) setPlanId(plans[0].id);
  }, [planId, plans]);

  async function ask(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      setResult(
        await api<PlanFitResponse>("/api/assistant/plan-fit", {
          method: "POST",
          body: JSON.stringify({
            question,
            planId: planId || undefined
          })
        })
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <button className="assistantFab" onClick={() => setOpen(true)} title="AI-ассистент">
          <Bot size={22} />
        </button>
      )}

      {open && (
        <div className="modalBackdrop">
          <section className="assistantModal">
            <div className="modalHeader">
              <div>
                <strong>AI-ассистент по плану</strong>
                <span>Подбор стажеров по AI-профилям миниопроса, дэйликам и баллам</span>
              </div>
              <button className="iconButton" onClick={() => setOpen(false)} title="Закрыть">
                <X size={18} />
              </button>
            </div>

            <div className="quickQuestions">
              {quickQuestions.map((item) => (
                <button type="button" className="chip" key={item} onClick={() => setQuestion(item)}>
                  {item}
                </button>
              ))}
            </div>

            <form className="form" onSubmit={ask}>
              {plans.length ? (
                <label>
                  План проекта
                  <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Вопрос
                <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
              </label>
              <button className="primaryButton" disabled={loading}>
                <Send size={18} />
                {loading ? "AI анализирует..." : "Спросить"}
              </button>
            </form>

            {result && (
              <div className="assistantResult">
                {result.plan && (
                  <div className="notice">
                    План: {result.plan.title} · {result.plan.categoryLabel} · дедлайн {result.plan.adjustedDeadline}
                  </div>
                )}
                {result.fallbackUsed && <div className="codeBox">В департаменте плана не хватило подходящих AI-профилей, поэтому ассистент расширил поиск.</div>}
                <p>{result.answer}</p>
                <div className="assistantCandidates">
                  {result.candidates.map((candidate) => (
                    <article className="candidateCard" key={candidate.user.id}>
                      <div className="scoreLine">
                        <strong>{candidate.user.name}</strong>
                        <span>{candidate.score}/100</span>
                      </div>
                      <small>{candidate.user.categoryLabel || "департамент не выбран"} · {candidate.source === "same_department" ? "свой департамент" : "другой департамент"}</small>
                      <p>{candidate.matchReason}</p>
                      <div className="tagLine">
                        {candidate.risks.length ? candidate.risks.map((risk) => <span key={risk}>{risk}</span>) : <span>рисков по профилю не видно</span>}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
