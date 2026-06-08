import { Bot, BrainCircuit, CheckCircle2, MessageSquareText, Send, Sparkles, Target, X } from "lucide-react";
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

    function onOpenDialog() {
      setOpen(true);
    }
    window.addEventListener("dailyreport:openAiDialog", onOpenDialog);
    return () => window.removeEventListener("dailyreport:openAiDialog", onOpenDialog);
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
          <section className="assistantModal assistantCommandModal">
            <div className="modalHeader assistantCommandHeader">
              <div>
                <strong>AI-ассистент по плану</strong>
                <span>Подбор стажеров по AI-профилям миниопроса, дэйликам и баллам</span>
              </div>
              <button className="iconButton" onClick={() => setOpen(false)} title="Закрыть">
                <X size={18} />
              </button>
            </div>

            <div className="assistantCommandGrid">
              <aside className="assistantPromptRail">
                <div className="assistantRailIntro">
                  <BrainCircuit size={22} />
                  <strong>Сценарии для тимлида</strong>
                  <small>Выберите быстрый вопрос или напишите свой. AI смотрит на план, навыки, дэйлики и риски.</small>
                </div>
                <div className="quickQuestions">
                  {quickQuestions.map((item) => (
                    <button type="button" className={question === item ? "chip active" : "chip"} key={item} onClick={() => setQuestion(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </aside>

              <div className="assistantChatArea">
                <form className="assistantAskForm" onSubmit={ask}>
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
                    Вопрос к AI-PM
                    <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
                  </label>
                  <button className="primaryButton" disabled={loading}>
                    <Send size={18} />
                    {loading ? "AI анализирует..." : "Спросить"}
                  </button>
                </form>

                <div className="assistantConversation">
                  <article className="assistantBubble userBubble">
                    <MessageSquareText size={16} />
                    <p>{question}</p>
                  </article>
                  {loading ? (
                    <article className="assistantBubble aiBubble loadingBubble">
                      <Sparkles size={16} />
                      <p>AI сверяет навыки, продуктивность, посещаемость и риски по плану...</p>
                    </article>
                  ) : null}
                  {result ? (
                    <article className="assistantBubble aiBubble">
                      <Bot size={16} />
                      <div>
                        {result.plan && (
                          <div className="assistantPlanNotice">
                            <Target size={15} />
                            <span>{result.plan.title} · {result.plan.categoryLabel} · дедлайн {result.plan.adjustedDeadline}</span>
                          </div>
                        )}
                        {result.fallbackUsed ? <div className="assistantFallbackNotice">AI расширил поиск за пределы департамента, потому что подходящих профилей внутри не хватило.</div> : null}
                        <p>{result.answer}</p>
                        <div className="assistantCandidates">
                          {result.candidates.map((candidate) => (
                            <article className="candidateCard" key={candidate.user.id}>
                              <div className="scoreLine">
                                <strong>{candidate.user.name}</strong>
                                <span>{candidate.score}/100</span>
                              </div>
                              <div className="reportScoreBar">
                                <i style={{ width: `${Math.max(0, Math.min(100, candidate.score))}%` }} />
                              </div>
                              <small>{candidate.user.categoryLabel || "департамент не выбран"} · {candidate.source === "same_department" ? "свой департамент" : "другой департамент"}</small>
                              <p>{candidate.matchReason}</p>
                              <div className="tagLine">
                                {candidate.risks.length ? candidate.risks.map((risk) => <span key={risk}>{risk}</span>) : <span><CheckCircle2 size={13} /> рисков по профилю не видно</span>}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    </article>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
