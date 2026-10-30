"use client";

// Central dos administradores: solicitações de cadastro e situação de cada empresa (ativa, em teste, suspensa).
import { Check, Inbox, Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatDocumentAuto } from "../../lib/branch-document";
import { companyStatus, SEGMENT_OPTIONS, TRIAL_OPTIONS } from "../../lib/company-signup";
import { supabase } from "../../lib/supabase";

type RequestStatus = "pending" | "approved" | "rejected";

type CompanyRequestRow = {
  id: string;
  status: RequestStatus;
  owner_name: string;
  owner_phone: string;
  email: string;
  company_name: string;
  document: string;
  city: string;
  address: string | null;
  segment: string;
  message: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  duplicate_document: boolean;
};

export type CompanyStatusRow = {
  tenant_id: string;
  is_active: boolean;
  effective_active: boolean;
  trial_ends_at: string | null;
  approved_at: string | null;
  suspended_reason: string | null;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function migrationMessage(message: string) {
  return /admin_list_company|approve_company|reject_company|admin_set_company|schema cache|does not exist/i.test(message)
    ? "A estrutura de solicitações ainda não foi aplicada neste Supabase. Rode a migration 031_company_signup_requests.sql."
    : message;
}

function formatPhone(digits: string) {
  return digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : digits.length === 10 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}` : digits;
}

function segmentLabel(value: string) {
  return SEGMENT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function CompanyRequests({ onApproved, onCreateManually }: { onApproved: () => void; onCreateManually: () => void }) {
  const [rows, setRows] = useState<CompanyRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showReviewed, setShowReviewed] = useState(false);

  const applyResult = useCallback(({ data, error }: { data: unknown; error: { message: string } | null }) => {
    setLoading(false);
    if (error) {
      setMessage(migrationMessage(error.message));
      return;
    }
    setMessage("");
    setRows((data ?? []) as CompanyRequestRow[]);
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    applyResult(await supabase.rpc("admin_list_company_requests"));
  }, [applyResult]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.rpc("admin_list_company_requests").then((result) => {
      if (active) applyResult(result);
    });
    return () => {
      active = false;
    };
  }, [applyResult]);

  const pending = rows.filter((row) => row.status === "pending");
  const reviewed = rows.filter((row) => row.status !== "pending");

  return (
    <section className="company-requests">
      <div className="company-requests-toolbar">
        <p>{pending.length ? `${pending.length} ${pending.length === 1 ? "solicitação aguardando" : "solicitações aguardando"} análise.` : "Nenhuma solicitação aguardando."}</p>
        <div>
          <button className="admin-secondary" type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading}><RefreshCw size={15} /> Atualizar</button>
          <button className="admin-link" type="button" onClick={onCreateManually}><Plus size={15} /> Cadastrar por um cliente</button>
        </div>
      </div>
      {message ? <p className="admin-message" role="alert">{message}</p> : null}
      {loading && !rows.length ? <p className="admin-muted">Carregando solicitações...</p> : null}
      {!loading && !pending.length && !message ? (
        <div className="admin-form-panel admin-company-empty"><Inbox size={24} /><strong>Tudo em dia</strong><span>Quando uma loja pedir acesso em /cadastro, o pedido aparece aqui depois que ela confirmar o e-mail.</span></div>
      ) : null}
      {pending.map((row) => <PendingRequestCard key={row.id} row={row} onDone={() => { void load(); onApproved(); }} />)}
      {reviewed.length ? (
        <details className="company-requests-history" open={showReviewed} onToggle={(event) => setShowReviewed(event.currentTarget.open)}>
          <summary>Já analisadas ({reviewed.length})</summary>
          <ul>
            {reviewed.map((row) => (
              <li key={row.id}>
                <strong>{row.company_name}</strong>
                <span className={`request-status-badge ${row.status}`}>{row.status === "approved" ? "Aprovada" : "Recusada"}</span>
                <small>{row.email} · {row.reviewed_at ? dateTime.format(new Date(row.reviewed_at)) : ""}{row.rejection_reason ? ` · ${row.rejection_reason}` : ""}</small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function PendingRequestCard({ row, onDone }: { row: CompanyRequestRow; onDone: () => void }) {
  const [trialDays, setTrialDays] = useState("14");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("approve_company_request", { p_request_id: row.id, p_trial_days: trialDays ? Number(trialDays) : null });
    setBusy(false);
    if (rpcError || data?.error) {
      setError(data?.error ?? migrationMessage(rpcError?.message ?? "Não foi possível aprovar."));
      return;
    }
    onDone();
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("reject_company_request", { p_request_id: row.id, p_reason: reason });
    setBusy(false);
    if (rpcError || data?.error) {
      setError(data?.error ?? migrationMessage(rpcError?.message ?? "Não foi possível recusar."));
      return;
    }
    onDone();
  }

  return (
    <article className="admin-form-panel company-request-card">
      <header>
        <div><h2>{row.company_name}</h2><small>{segmentLabel(row.segment)} · {row.city}</small></div>
        <small>Recebida em {dateTime.format(new Date(row.created_at))}</small>
      </header>
      <dl>
        <div><dt>Responsável</dt><dd>{row.owner_name}</dd></div>
        <div><dt>E-mail</dt><dd>{row.email}</dd></div>
        <div><dt>WhatsApp</dt><dd><a href={`https://wa.me/55${row.owner_phone}`} target="_blank" rel="noopener noreferrer">{formatPhone(row.owner_phone)}</a></dd></div>
        <div><dt>{row.document.length === 11 ? "CPF" : "CNPJ"}</dt><dd>{formatDocumentAuto(row.document)}</dd></div>
        {row.address ? <div><dt>Endereço</dt><dd>{row.address}</dd></div> : null}
      </dl>
      {row.message ? <blockquote>{row.message}</blockquote> : null}
      {row.duplicate_document ? <p className="admin-message" role="note">Atenção: outra conta também pediu acesso com este {row.document.length === 11 ? "CPF" : "CNPJ"}. Confirme com o responsável antes de aprovar.</p> : null}
      {error ? <p className="admin-message" role="alert">{error}</p> : null}
      {rejecting ? (
        <form className="company-request-reject" onSubmit={reject}>
          <label>Motivo da recusa (a loja vê este texto)<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={600} required /></label>
          <div><button className="admin-primary danger" type="submit" disabled={busy}>{busy ? "Recusando..." : "Confirmar recusa"}</button><button className="admin-link" type="button" onClick={() => setRejecting(false)}>Cancelar</button></div>
        </form>
      ) : (
        <footer>
          <label><span className="sr-only">Período de teste</span><select value={trialDays} onChange={(event) => setTrialDays(event.target.value)}>{TRIAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <button className="admin-primary" type="button" onClick={() => void approve()} disabled={busy}><Check size={16} /> {busy ? "Aprovando..." : "Aprovar"}</button>
          <button className="admin-secondary" type="button" onClick={() => setRejecting(true)} disabled={busy}><X size={16} /> Recusar</button>
        </footer>
      )}
    </article>
  );
}

// Situação das empresas para a lista do admin. Sem a migration 031, devolve vazio e a lista segue como antes.
export function useCompanyStatuses(enabled: boolean) {
  const [statuses, setStatuses] = useState<Map<string, CompanyStatusRow>>(new Map());
  const applyRows = useCallback((data: unknown) => {
    setStatuses(new Map(((data ?? []) as CompanyStatusRow[]).map((row) => [row.tenant_id, row])));
  }, []);
  const reload = useCallback(async () => {
    if (!supabase || !enabled) return;
    const { data, error } = await supabase.rpc("admin_list_company_status");
    if (!error) applyRows(data);
  }, [enabled, applyRows]);
  useEffect(() => {
    if (!supabase || !enabled) return;
    let active = true;
    void supabase.rpc("admin_list_company_status").then(({ data, error }) => {
      if (active && !error) applyRows(data);
    });
    return () => {
      active = false;
    };
  }, [enabled, applyRows]);
  return { statuses, reload };
}

export function CompanyStatusControl({ tenantId, status, onChanged }: { tenantId: string; status: CompanyStatusRow | undefined; onChanged: () => void }) {
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!status) return null;
  const current = companyStatus(status);

  async function setActive(isActive: boolean, clearTrial = false) {
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("admin_set_company_status", {
      p_tenant_id: tenantId,
      p_is_active: isActive,
      p_reason: isActive ? null : reason,
      p_clear_trial: clearTrial,
    });
    setBusy(false);
    if (rpcError || data?.error) {
      setError(data?.error ?? migrationMessage(rpcError?.message ?? "Não foi possível alterar."));
      return;
    }
    setSuspending(false);
    setReason("");
    onChanged();
  }

  return (
    <div className="company-status-control">
      <b className={`company-status-badge ${current.tone}`} title={status.suspended_reason ?? undefined}>{current.label}</b>
      {suspending ? (
        <form onSubmit={(event) => { event.preventDefault(); void setActive(false); }}>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo (a loja vê)" maxLength={200} aria-label="Motivo da suspensão" />
          <button className="admin-primary danger" type="submit" disabled={busy}>Suspender</button>
          <button className="admin-link" type="button" onClick={() => setSuspending(false)}>Cancelar</button>
        </form>
      ) : current.tone === "active" || current.tone === "trial" ? (
        <span>
          {current.tone === "trial" ? <button className="admin-link" type="button" onClick={() => void setActive(true, true)} disabled={busy}>Ativar plano</button> : null}
          <button className="admin-link danger" type="button" onClick={() => setSuspending(true)} disabled={busy}>Suspender</button>
        </span>
      ) : (
        <button className="admin-link" type="button" onClick={() => void setActive(true, true)} disabled={busy}>Reativar</button>
      )}
      {error ? <small className="admin-message" role="alert">{error}</small> : null}
    </div>
  );
}

// Situação da empresa da conta logada (painéis do dono e da filial). Nulo enquanto carrega ou sem a migration 031.
export type MyCompanyStatus = { is_active: boolean; suspended: boolean; trial_ends_at: string | null; suspended_reason: string | null };

export function useMyCompanyStatus(tenantId: string | undefined, enabled: boolean) {
  // Guarda de qual empresa é a situação: ao trocar de empresa, a anterior deixa de valer sem precisar limpar o estado.
  const [loaded, setLoaded] = useState<{ tenantId: string; status: MyCompanyStatus } | null>(null);
  useEffect(() => {
    if (!supabase || !enabled || !tenantId) return;
    let active = true;
    void supabase.rpc("get_my_company_status", { p_tenant_id: tenantId }).then(({ data, error }) => {
      if (active && !error && data) setLoaded({ tenantId, status: data as MyCompanyStatus });
    });
    return () => {
      active = false;
    };
  }, [tenantId, enabled]);
  return enabled && loaded && loaded.tenantId === tenantId ? loaded.status : null;
}

export function CompanySuspendedNotice({ status }: { status: MyCompanyStatus }) {
  const expired = !status.suspended;
  return (
    <section className="admin-form-panel access-denied-panel company-suspended-notice" role="alert">
      <h2>{expired ? "O período de teste terminou" : "Loja suspensa"}</h2>
      <p>{expired ? "Seu catálogo saiu do ar e a edição está bloqueada até a ativação do plano." : status.suspended_reason ? `Motivo: ${status.suspended_reason}` : "Seu catálogo saiu do ar e a edição está bloqueada."}</p>
      <p>Fale com a equipe LIIST para reativar.</p>
    </section>
  );
}

export function TrialBanner({ status }: { status: MyCompanyStatus }) {
  if (!status.is_active || !status.trial_ends_at) return null;
  const label = companyStatus({ is_active: true, trial_ends_at: status.trial_ends_at }).label;
  return <p className="company-trial-banner">{label}. Depois disso, o catálogo sai do ar até a ativação do plano.</p>;
}