import { BrainCircuit, ExternalLink, FileText, Link2, RefreshCw, Trash2, Trello } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, type Category, type ExternalResource, type ExternalResourceAiCheck, type IntegrationProvider, type IntegrationStatus, type ProviderExternalResource } from "../api";

const providerLabels: Record<IntegrationProvider, string> = {
  google_drive: "Google Drive",
  trello: "Trello",
  notion: "Notion",
  manual: "Другая ссылка"
};

const providerIcons: Record<string, string> = {
  google_drive: "📁",
  notion: "📝",
  trello: "📋",
  manual: "🔗"
};

const resourceTypeLabels: Record<ExternalResource["resourceType"], string> = {
  folder: "Папка",
  document: "Документ",
  board: "Доска",
  card: "Карточка",
  page: "Страница",
  database: "База",
  other: "Другое"
};

function isOAuthProvider(provider: Exclude<IntegrationProvider, "manual">): provider is "google_drive" | "notion" {
  return provider === "google_drive" || provider === "notion";
}

export function ExternalResourcesPanel({
  linkedEntityType,
  linkedEntityId,
  planId,
  category
}: {
  linkedEntityType: "department" | "plan" | "step";
  linkedEntityId: string;
  planId?: string;
  category?: Category;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [resources, setResources] = useState<ExternalResource[]>([]);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [searchingProvider, setSearchingProvider] = useState<string | null>(null);
  const [providerSearch, setProviderSearch] = useState("");
  const [providerResources, setProviderResources] = useState<ProviderExternalResource[]>([]);
  const [trelloToken, setTrelloToken] = useState("");
  const [trelloName, setTrelloName] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    provider: "google_drive" as IntegrationProvider,
    resourceType: "document" as ExternalResource["resourceType"],
    title: "",
    externalUrl: "",
    contentSummary: ""
  });

  async function load(force = false) {
    if (!force && loaded) return;
    const params = new URLSearchParams({ linkedEntityType, linkedEntityId });
    const [result, statusResult] = await Promise.all([
      api<ExternalResource[]>(`/api/integrations/resources?${params.toString()}`),
      api<IntegrationStatus>("/api/integrations/status")
    ]);
    setResources(result);
    setStatus(statusResult);
    setLoaded(true);
  }

  useEffect(() => {
    setLoaded(false);
    setResources([]);
    setMessage("");
  }, [linkedEntityId, linkedEntityType]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const created = await api<ExternalResource>("/api/integrations/resources", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          linkedEntityType,
          linkedEntityId,
          category
        })
      });
      setResources((current) => [created, ...current]);
      setForm({ ...form, title: "", externalUrl: "", contentSummary: "" });
      setMessage("Ресурс привязан.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось привязать ресурс.");
    } finally {
      setBusy(false);
    }
  }

  async function attachProviderResource(resource: ProviderExternalResource) {
    setBusy(true);
    setMessage("");
    try {
      const created = await api<ExternalResource>("/api/integrations/resources", {
        method: "POST",
        body: JSON.stringify({
          provider: resource.provider,
          externalId: resource.externalId,
          externalUrl: resource.externalUrl,
          title: resource.title,
          resourceType: resource.resourceType,
          linkedEntityType,
          linkedEntityId,
          category,
          contentSummary: `Выбран из подключенного сервиса ${providerLabels[resource.provider]}.`
        })
      });
      setResources((current) => [created, ...current]);
      setMessage("Ресурс привязан.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось привязать ресурс.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteResource(id: string) {
    await api(`/api/integrations/resources/${id}`, { method: "DELETE" });
    setResources((current) => current.filter((resource) => resource.id !== id));
  }

  async function runAiCheck(resource: ExternalResource) {
    setCheckingId(resource.id);
    setMessage("");
    try {
      const check = await api<ExternalResourceAiCheck>(`/api/integrations/resources/${resource.id}/ai-check`, {
        method: "POST",
        body: JSON.stringify({ planId })
      });
      setResources((current) => current.map((item) => (item.id === resource.id ? { ...item, latestAiCheck: check, lastAiCheckAt: check.createdAt } : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI-проверка не удалась.");
    } finally {
      setCheckingId(null);
    }
  }

  async function startOAuth(provider: "google_drive" | "notion") {
    setConnectingProvider(provider);
    setMessage("");
    try {
      const result = await api<{ url: string }>(`/api/integrations/oauth/${provider}/start`, { method: "POST" });
      window.location.href = result.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось начать OAuth-подключение.");
      setConnectingProvider(null);
    }
  }

  async function connectTrello(event: FormEvent) {
    event.preventDefault();
    setConnectingProvider("trello");
    setMessage("");
    try {
      await api("/api/integrations/manual-token", {
        method: "POST",
        body: JSON.stringify({
          provider: "trello",
          accessToken: trelloToken,
          externalAccountName: trelloName || "Trello token",
          category
        })
      });
      setTrelloToken("");
      setTrelloName("");
      await load(true);
      setMessage("Trello подключен.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подключить Trello.");
    } finally {
      setConnectingProvider(null);
    }
  }

  async function disconnect(provider: "google_drive" | "notion" | "trello") {
    await api(`/api/integrations/connections/${provider}`, { method: "DELETE" });
    await load(true);
  }

  async function searchProviderResources(provider: "google_drive" | "notion" | "trello") {
    setSearchingProvider(provider);
    setProviderResources([]);
    setMessage("");
    try {
      const params = new URLSearchParams({ query: providerSearch });
      const result = await api<{ resources: ProviderExternalResource[] }>(`/api/integrations/provider/${provider}/resources?${params.toString()}`);
      setProviderResources(result.resources);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "";
      if (errorMsg.includes("Переподключите") || errorMsg.includes("needsReauth")) {
        await load(true); // обновить статус подключений
      }
      setMessage(errorMsg || "Не удалось получить ресурсы из сервиса.");
    } finally {
      setSearchingProvider(null);
    }
  }

  return (
    <section className="externalResourcesPanel">
      <button
        className="ghostButton lightButton"
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
      >
        <Link2 size={16} />
        Интеграции и материалы
      </button>

      {open ? (
        <div className="externalResourcesBody">
          {status ? (
            <div className="integrationConnectGrid">
              {status.providers.map((item) => (
                <article className={`integrationConnectCard ${item.connection?.status === "needs_reauth" ? "needsReauth" : ""}`} key={item.provider}>
                  <div className="integrationCardHeader">
                    <span className="providerIcon">{providerIcons[item.provider]}</span>
                    <div>
                      <strong>{providerLabels[item.provider]}</strong>
                      <small>
                        {item.connection?.status === "needs_reauth"
                          ? "⚠️ Требуется переподключение"
                          : item.connected
                            ? `✅ Подключено${item.connection?.externalAccountName ? `: ${item.connection.externalAccountName}` : ""}`
                            : item.authMode === "oauth"
                              ? item.oauthConfigured
                                ? "Можно подключить через OAuth"
                                : "OAuth env не настроен"
                              : "Подключение через Trello token"}
                      </small>
                    </div>
                  </div>
                  {item.connection?.status === "needs_reauth" && isOAuthProvider(item.provider) ? (
                    <button className="secondaryButton warningButton" type="button" onClick={() => startOAuth(item.provider as "google_drive" | "notion")} disabled={connectingProvider === item.provider}>
                      <RefreshCw size={14} />
                      {connectingProvider === item.provider ? "Открываю..." : "Переподключить"}
                    </button>
                  ) : item.connected ? (
                    <button className="ghostButton lightButton" type="button" onClick={() => disconnect(item.provider)}>
                      Отключить
                    </button>
                  ) : isOAuthProvider(item.provider) ? (
                    <button className="secondaryButton" type="button" onClick={() => startOAuth(item.provider as "google_drive" | "notion")} disabled={!item.oauthConfigured || connectingProvider === item.provider}>
                      {connectingProvider === item.provider ? "Открываю..." : "Подключить"}
                    </button>
                  ) : null}
                </article>
              ))}
              {!status.providers.find((item) => item.provider === "trello")?.connected ? (
                <form className="trelloTokenForm" onSubmit={connectTrello}>
                  <input value={trelloName} onChange={(event) => setTrelloName(event.target.value)} placeholder="Название подключения Trello" />
                  <input value={trelloToken} onChange={(event) => setTrelloToken(event.target.value)} placeholder="Trello token" />
                  <button className="secondaryButton" disabled={connectingProvider === "trello" || trelloToken.length < 8}>
                    {connectingProvider === "trello" ? "Подключаю..." : "Подключить Trello"}
                  </button>
                </form>
              ) : null}
              {status.providers.some((item) => item.connected && item.connection?.status !== "needs_reauth") ? (
                <div className="providerResourcePicker">
                  <input value={providerSearch} onChange={(event) => setProviderSearch(event.target.value)} placeholder="Поиск по подключенным сервисам" />
                  <div className="buttonRow">
                    {status.providers.filter((item) => item.connected && item.connection?.status !== "needs_reauth").map((item) => (
                      <button className="secondaryButton" type="button" key={item.provider} onClick={() => searchProviderResources(item.provider)} disabled={searchingProvider === item.provider}>
                        {providerIcons[item.provider]} {searchingProvider === item.provider ? "Ищу..." : `Найти в ${providerLabels[item.provider]}`}
                      </button>
                    ))}
                  </div>
                  {searchingProvider && !providerResources.length ? (
                    <div className="providerResourceResults">
                      {[1, 2, 3].map((i) => (
                        <article className="providerResourceResult skeleton" key={i}>
                          <div>
                            <div className="skeletonLine skeletonTitle" />
                            <div className="skeletonLine skeletonSub" />
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {providerResources.length ? (
                    <div className="providerResourceResults">
                      {providerResources.map((resource) => (
                        <article className="providerResourceResult" key={`${resource.provider}-${resource.externalId}`}>
                          <div>
                            <strong>{providerIcons[resource.provider]} {resource.title}</strong>
                            <small>{providerLabels[resource.provider]} · {resourceTypeLabels[resource.resourceType]}</small>
                          </div>
                          <button className="ghostButton lightButton" type="button" onClick={() => attachProviderResource(resource)} disabled={busy}>
                            Привязать
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <form className="externalResourceForm" onSubmit={submit}>
            <select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value as IntegrationProvider })}>
              {Object.entries(providerLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={form.resourceType} onChange={(event) => setForm({ ...form, resourceType: event.target.value as ExternalResource["resourceType"] })}>
              {Object.entries(resourceTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Название ресурса" />
            <input value={form.externalUrl} onChange={(event) => setForm({ ...form, externalUrl: event.target.value })} placeholder="https://..." />
            <textarea value={form.contentSummary} onChange={(event) => setForm({ ...form, contentSummary: event.target.value })} placeholder="Кратко: что внутри документа, доски или страницы" />
            <button className="secondaryButton" disabled={busy}>
              {busy ? "Привязываю..." : "Привязать"}
            </button>
          </form>

          <div className="externalResourceList">
            {resources.map((resource) => (
              <article className="externalResourceCard" key={resource.id}>
                <div className="reportTop">
                  <div>
                    <strong>{providerIcons[resource.provider]} {resource.title}</strong>
                    <small>{providerLabels[resource.provider]} · {resourceTypeLabels[resource.resourceType]}</small>
                  </div>
                  <div className="buttonRow compactButtons">
                    <a className="iconButton" href={resource.externalUrl} target="_blank" rel="noreferrer" title="Открыть ресурс">
                      <ExternalLink size={16} />
                    </a>
                    <button className="iconButton" type="button" onClick={() => runAiCheck(resource)} disabled={checkingId === resource.id} title="AI-проверка (автоматически читает содержимое)">
                      <BrainCircuit size={16} />
                    </button>
                    <button className="iconButton dangerIcon" type="button" onClick={() => deleteResource(resource.id)} title="Удалить связь">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {checkingId === resource.id ? (
                  <div className="aiCheckingIndicator">
                    <BrainCircuit size={16} className="spinIcon" />
                    <span>AI читает содержимое ресурса и анализирует соответствие плану...</span>
                  </div>
                ) : null}
                {resource.contentSummary ? <p>{resource.contentSummary}</p> : null}
                {resource.latestAiCheck ? (
                  <div className={`resourceAiCheck ${resource.latestAiCheck.riskLevel}`}>
                    <strong>Соответствие: {resource.latestAiCheck.matchScore}%</strong>
                    <p>{resource.latestAiCheck.summary}</p>
                    {resource.latestAiCheck.matchedSteps.length ? <small>Покрывает: {resource.latestAiCheck.matchedSteps.join(", ")}</small> : null}
                    {resource.latestAiCheck.missingRequirements.length ? <small>Не хватает: {resource.latestAiCheck.missingRequirements.join("; ")}</small> : null}
                    {resource.latestAiCheck.suggestedActions.length ? <small>Действия: {resource.latestAiCheck.suggestedActions.join("; ")}</small> : null}
                  </div>
                ) : (
                  <small className="mutedText">AI-проверка еще не запускалась.</small>
                )}
              </article>
            ))}
            {!resources.length && <small className="mutedText">Пока нет привязанных внешних материалов.</small>}
          </div>

          {message ? <small className={message === "Ресурс привязан." || message === "Trello подключен." ? "successText" : "errorText"}>{message}</small> : null}
        </div>
      ) : null}
    </section>
  );
}
