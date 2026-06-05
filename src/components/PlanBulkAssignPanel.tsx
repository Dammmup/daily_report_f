import { useEffect, useMemo, useState } from "react";
import { UserCheck } from "lucide-react";
import { api, type Plan, type User } from "../api";

function assigneeLabel(user: Pick<User, "name" | "role">) {
  return `${user.name} · ${user.role === "lead" ? "тимлид" : "стажер"}`;
}

function getSingleAssignee(plan: Plan) {
  const firstAssignedTo = plan.steps[0]?.assignedTo;
  if (!firstAssignedTo) return "";
  return plan.steps.every((step) => step.assignedTo === firstAssignedTo) ? firstAssignedTo : "";
}

export function PlanBulkAssignPanel({
  plan,
  assignees,
  onAssigned
}: {
  plan: Plan;
  assignees: User[];
  onAssigned: (plan: Plan) => void;
}) {
  const currentAssignee = useMemo(() => getSingleAssignee(plan), [plan]);
  const [assignedTo, setAssignedTo] = useState(currentAssignee);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAssignedTo(currentAssignee);
    setMessage("");
  }, [currentAssignee, plan.id]);

  async function assignAll() {
    if (!assignedTo || !plan.steps.length) return;
    setSaving(true);
    setMessage("");
    try {
      const saved = await api<Plan>(`/api/department-plan/${plan.id}/assign-all`, {
        method: "POST",
        body: JSON.stringify({ assignedTo })
      });
      onAssigned(saved);
      const selected = assignees.find((item) => item.id === assignedTo);
      setMessage(selected ? `Назначено: ${assigneeLabel(selected)}` : "План назначен");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось назначить план.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="assignmentPanel bulkAssignPanel">
      <div className="reportTop">
        <h3>Исполнитель плана</h3>
        <span className="status ok">{plan.steps.length} шагов</span>
      </div>
      <label>
        Назначить все шаги
        <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} disabled={!assignees.length}>
          <option value="">Выберите исполнителя</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assigneeLabel(assignee)}
            </option>
          ))}
        </select>
      </label>
      <button className="primaryButton" type="button" onClick={assignAll} disabled={saving || !assignedTo || !plan.steps.length}>
        <UserCheck size={16} />
        {saving ? "Назначаю..." : "Назначить весь план"}
      </button>
      {message ? <small>{message}</small> : null}
      {!assignees.length ? <small className="errorText">Нет доступных исполнителей.</small> : null}
    </section>
  );
}
