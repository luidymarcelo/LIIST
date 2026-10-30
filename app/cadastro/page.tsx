"use client";

import type { Session } from "@supabase/supabase-js";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { LiistBrand } from "../../components/liist-brand";
import { OwnerFields, StoreFields } from "../../components/company-fields";
import { companyRequestParams, EMPTY_COMPANY_FIELDS, MIN_PASSWORD_LENGTH, validateAccount, validateCompanyRequest, type CompanyRequestErrors, type CompanyRequestFields } from "../../lib/company-signup";
import { supabase } from "../../lib/supabase";

type SignupStep = "checking" | "form" | "sending" | "confirm-email";

function signupErrorMessage(message: string) {
  if (/already registered|already been registered/i.test(message)) return "Este e-mail já tem conta. Entre por Entrar e envie a solicitação de lá.";
  if (/rate limit/i.test(message)) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (/signups not allowed|signup is disabled/i.test(message)) return "O cadastro está desativado no momento. Fale com a equipe LIIST.";
  return message;
}

export default function SignupPage() {
  const [step, setStep] = useState<SignupStep>(supabase ? "checking" : "form");
  const [session, setSession] = useState<Session | null>(null);
  const [fields, setFields] = useState<CompanyRequestFields>(EMPTY_COMPANY_FIELDS);
  const [errors, setErrors] = useState<CompanyRequestErrors>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      const name = data.session?.user.user_metadata?.full_name;
      if (typeof name === "string") setFields((current) => ({ ...current, ownerName: current.ownerName || name }));
      setStep("form");
    });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof CompanyRequestFields>(key: K, value: CompanyRequestFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase não configurado neste computador.");
      return;
    }
    const nextErrors = validateCompanyRequest(fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Revise os campos destacados.");
      return;
    }
    if (!session && Object.keys(validateAccount({ email, password })).length) {
      setMessage(`Informe um e-mail válido e uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    setStep("sending");
    setMessage("");
    const params = companyRequestParams(fields);

    // Já logado (ex.: solicitação recusada antes): envia direto.
    if (session) {
      const { data, error } = await supabase.rpc("submit_company_request", params);
      if (error || data?.error) {
        setMessage(data?.error ?? error?.message ?? "Não foi possível enviar a solicitação.");
        setStep("form");
        return;
      }
      window.location.assign("/acesso");
      return;
    }

    // Conta nova: os dados ficam guardados na conta e a solicitação é enviada depois que o e-mail for confirmado.
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/acesso`,
        data: { full_name: params.p_owner_name, liist_company_request: params },
      },
    });
    if (error) {
      setMessage(signupErrorMessage(error.message));
      setStep("form");
      return;
    }
    if (data.session) {
      // Projeto sem confirmação de e-mail: já dá para enviar.
      const { data: sent, error: sendError } = await supabase.rpc("submit_company_request", params);
      if (sendError || sent?.error) setMessage(sent?.error ?? sendError?.message ?? "");
      window.location.assign("/acesso");
      return;
    }
    setStep("confirm-email");
  }

  return (
    <main className="access-page">
      <section className="access-shell access-signup">
        <Link className="access-brand-link" href="/" aria-label="LIIST Commerce: voltar à página inicial"><LiistBrand className="access-brand" /></Link>
        {step === "checking" ? (
          <p className="access-status" role="status">Carregando...</p>
        ) : step === "confirm-email" ? (
          <>
            <MailCheck className="signup-done-icon" size={32} />
            <h1>Confirme seu e-mail</h1>
            <p>Enviamos um link para <strong>{email.trim()}</strong>. Depois de confirmar, sua solicitação chega para a equipe LIIST e você recebe o acesso assim que for aprovada.</p>
            <div className="access-footer"><Link href="/acesso">Já confirmei, quero entrar</Link><Link href="/">Voltar ao início</Link></div>
          </>
        ) : (
          <>
            <h1>Quero usar a LIIST</h1>
            <p>Conte sobre a sua loja. A equipe LIIST analisa a solicitação e libera o seu acesso.</p>
            <form className="access-form signup-form" onSubmit={submit} noValidate>
              <fieldset>
                <legend>Sobre você</legend>
                <OwnerFields fields={fields} errors={errors} onChange={update} />
                {!session ? (
                  <>
                    <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
                    <label>Crie uma senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required /><small className="signup-hint">Pelo menos {MIN_PASSWORD_LENGTH} caracteres.</small></label>
                  </>
                ) : <p className="signup-hint">Enviando como {session.user.email}.</p>}
              </fieldset>
              <fieldset>
                <legend>Sobre a loja</legend>
                <StoreFields fields={fields} errors={errors} onChange={update} />
                <label><span>Quer contar algo? <span className="signup-optional">(opcional)</span></span><textarea value={fields.message} onChange={(event) => update("message", event.target.value)} maxLength={600} rows={3} /></label>
              </fieldset>
              {message ? <p className="access-error" role="alert">{message}</p> : null}
              <button className="admin-primary" type="submit" disabled={step === "sending"}>{step === "sending" ? "Enviando..." : "Enviar solicitação"}</button>
            </form>
            <div className="access-footer"><Link href="/acesso">Já tenho conta</Link><Link href="/">Voltar ao início</Link></div>
          </>
        )}
      </section>
    </main>
  );
}
