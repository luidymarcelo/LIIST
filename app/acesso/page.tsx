"use client";

import type { Session } from "@supabase/supabase-js";
import { Building2, ChevronRight, ClipboardList, Hourglass, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { LiistBrand } from "../../components/liist-brand";
import { accessDestinations, rememberDestination, type AccessDestination, type AccessKind } from "../../lib/access-destinations";
import { loadAccessProfile } from "../../lib/access-profile";
import { supabase } from "../../lib/supabase";

type AccessStep = "checking" | "login" | "resolving" | "choose" | "no-access" | "request-pending" | "request-rejected";
type CompanyRequest = { status: "pending" | "approved" | "rejected"; company_name: string; rejection_reason: string | null };

// Conta sem acesso: procura a solicitação de cadastro. Se só existe a guardada no cadastro, envia agora (o e-mail já foi confirmado).
async function loadCompanyRequest(session: Session): Promise<{ request: CompanyRequest | null; error: string }> {
  if (!supabase) return { request: null, error: "" };
  const { data, error } = await supabase.from("company_requests").select("status, company_name, rejection_reason").order("created_at", { ascending: false }).limit(1);
  if (error) return { request: null, error: "" };
  const latest = (data?.[0] ?? null) as CompanyRequest | null;
  if (latest) return { request: latest, error: "" };
  const stored = session.user.user_metadata?.liist_company_request;
  if (!stored || typeof stored !== "object") return { request: null, error: "" };
  const { data: sent, error: sendError } = await supabase.rpc("submit_company_request", stored);
  if (sendError || sent?.error) return { request: null, error: sent?.error ?? sendError?.message ?? "" };
  return { request: { status: "pending", company_name: String((stored as { p_company_name?: string }).p_company_name ?? ""), rejection_reason: null }, error: "" };
}

const DESTINATION_ICON: Record<AccessKind, typeof Building2> = {
  admin: ShieldCheck,
  company: Building2,
  branch: Store,
  operation: ClipboardList,
};

function loginErrorMessage(message: string | undefined) {
  if (message === "Invalid login credentials") return "E-mail ou senha incorretos.";
  if (message && /email not confirmed/i.test(message)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  return message ?? "Não foi possível entrar.";
}

function goTo(destination: AccessDestination) {
  try {
    rememberDestination(destination, window.localStorage);
  } catch {
    // Sem armazenamento local, o painel da filial pede para escolher a unidade de novo.
  }
  window.location.assign(destination.href);
}

export default function AccessPage() {
  const [step, setStep] = useState<AccessStep>("checking");
  const [destinations, setDestinations] = useState<AccessDestination[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [companyRequest, setCompanyRequest] = useState<CompanyRequest | null>(null);

  async function resolveAccess(session: Session) {
    const userId = session.user.id;
    if (!supabase) return;
    setStep("resolving");
    setMessage("");
    try {
      const nextDestinations = accessDestinations(await loadAccessProfile(supabase, userId));
      // "?trocar=1" vem de um painel que não conseguiu abrir: mostra a lista em vez de voltar direto para ele.
      const wantsToChoose = new URLSearchParams(window.location.search).has("trocar");
      if (nextDestinations.length === 1 && !wantsToChoose) {
        goTo(nextDestinations[0]);
        return;
      }
      setDestinations(nextDestinations);
      if (nextDestinations.length) {
        setStep("choose");
        return;
      }
      const { request, error } = await loadCompanyRequest(session);
      setCompanyRequest(request);
      setMessage(error);
      setStep(request?.status === "pending" ? "request-pending" : request?.status === "rejected" ? "request-rejected" : "no-access");
    } catch (error) {
      setMessage(error instanceof Error ? `Não foi possível carregar seus acessos: ${error.message}` : "Não foi possível carregar seus acessos.");
      setStep("login");
    }
  }

  useEffect(() => {
    if (!supabase) {
      setStep("login");
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) void resolveAccess(data.session);
      else setStep("login");
    });
    return () => {
      active = false;
    };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase não configurado neste computador. Configure o arquivo .env.local e reinicie o servidor.");
      return;
    }
    setStep("resolving");
    setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) {
      setMessage(loginErrorMessage(error?.message));
      setStep("login");
      return;
    }
    await resolveAccess(data.session);
  }

  async function switchAccount() {
    await supabase?.auth.signOut();
    setDestinations([]);
    setCompanyRequest(null);
    setPassword("");
    setMessage("");
    setStep("login");
  }

  return (
    <main className="access-page">
      <section className="access-shell access-login">
        <Link className="access-brand-link" href="/" aria-label="LIIST Commerce: voltar à página inicial"><LiistBrand className="access-brand" /></Link>
        {step === "checking" || step === "resolving" ? (
          <p className="access-status" role="status">Entrando...</p>
        ) : step === "choose" ? (
          <>
            <h1>Para onde você quer ir?</h1>
            <p>{destinations.length > 1 ? "Sua conta tem mais de um acesso." : "Este é o acesso liberado para a sua conta."}</p>
            <nav className="access-list" aria-label="Seus acessos">
              {destinations.map((destination) => {
                const Icon = DESTINATION_ICON[destination.kind];
                return (
                  <button className="access-list-item" type="button" key={destination.key} onClick={() => goTo(destination)}>
                    <Icon size={20} />
                    <span><strong>{destination.title}</strong><small>{destination.description}</small></span>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </nav>
            <div className="access-footer"><button className="access-text-button" type="button" onClick={() => void switchAccount()}>Entrar com outra conta</button></div>
          </>
        ) : step === "request-pending" ? (
          <>
            <Hourglass className="signup-done-icon" size={32} />
            <h1>Solicitação em análise</h1>
            <p>Recebemos o pedido{companyRequest?.company_name ? <> da <strong>{companyRequest.company_name}</strong></> : null}. A equipe LIIST vai analisar e liberar o seu acesso. Quando for aprovado, é só entrar por aqui de novo.</p>
            <div className="access-footer"><button className="access-text-button" type="button" onClick={() => void switchAccount()}>Sair</button><Link href="/">Voltar ao início</Link></div>
          </>
        ) : step === "request-rejected" ? (
          <>
            <h1>Solicitação não aprovada</h1>
            <p>{companyRequest?.rejection_reason ? <>Motivo: {companyRequest.rejection_reason}</> : "A solicitação não foi aprovada."}</p>
            <Link className="admin-primary access-cta" href="/cadastro">Enviar nova solicitação</Link>
            <div className="access-footer"><button className="access-text-button" type="button" onClick={() => void switchAccount()}>Sair</button><Link href="/">Voltar ao início</Link></div>
          </>
        ) : step === "no-access" ? (
          <>
            <h1>Sem acesso liberado</h1>
            <p>Esta conta ainda não está ligada a nenhuma empresa ou filial. Se você trabalha numa loja, peça ao dono para liberar seu acesso. Se quer usar a LIIST na sua loja, envie uma solicitação.</p>
            {message ? <p className="access-error" role="alert">{message}</p> : null}
            <Link className="admin-primary access-cta" href="/cadastro">Quero usar a LIIST</Link>
            <div className="access-footer"><button className="access-text-button" type="button" onClick={() => void switchAccount()}>Entrar com outra conta</button><Link href="/">Voltar ao início</Link></div>
          </>
        ) : (
          <>
            <h1>Entrar</h1>
            <p>Use o e-mail e a senha da sua conta. Você vai direto para a sua área.</p>
            <form className="access-form" onSubmit={signIn}>
              <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
              <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={6} required /></label>
              {message ? <p className="access-error" role="alert">{message}</p> : null}
              <button className="admin-primary" type="submit">Entrar</button>
            </form>
            <div className="access-footer"><Link href="/cadastro">Quero usar a LIIST na minha loja</Link><Link href="/">Voltar ao início</Link></div>
          </>
        )}
      </section>
    </main>
  );
}
