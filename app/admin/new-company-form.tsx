"use client";

import { Plus } from "lucide-react";
import type { FormEvent } from "react";
import { OwnerFields, StoreFields } from "../../components/company-fields";
import { MIN_PASSWORD_LENGTH, TRIAL_OPTIONS, type AccountFields, type CompanyRequestErrors, type CompanyRequestFields } from "../../lib/company-signup";

// Criação de empresa pelo admin: a mesma ficha do cadastro do lojista, mais o acesso e o período de teste.
type NewCompanyFormProps = {
  fields: CompanyRequestFields;
  errors: CompanyRequestErrors;
  account: AccountFields;
  trialDays: string;
  busy: boolean;
  onFieldChange: <K extends keyof CompanyRequestFields>(key: K, value: CompanyRequestFields[K]) => void;
  onAccountChange: (account: AccountFields) => void;
  onTrialDaysChange: (trialDays: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function NewCompanyForm({ fields, errors, account, trialDays, busy, onFieldChange, onAccountChange, onTrialDaysChange, onSubmit }: NewCompanyFormProps) {
  return (
    <form className="admin-form-panel new-company-form" onSubmit={onSubmit} noValidate>
      <p className="admin-muted">Os mesmos dados do cadastro feito pelo lojista. A primeira filial recebe o nome da loja; o dono confirma o endereço no mapa no primeiro acesso.</p>
      <h3 className="new-company-legend">Responsável</h3>
      <div className="admin-form-grid">
        <OwnerFields fields={fields} errors={errors} onChange={onFieldChange} nameLabel="Nome do responsável" />
        <label>E-mail de acesso<input type="email" value={account.email} onChange={(event) => onAccountChange({ ...account, email: event.target.value })} autoComplete="off" required /></label>
        <label>Senha de acesso<input type="password" value={account.password} onChange={(event) => onAccountChange({ ...account, password: event.target.value })} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required /><small className="signup-hint">Pelo menos {MIN_PASSWORD_LENGTH} caracteres.</small></label>
      </div>
      <h3 className="new-company-legend">Loja</h3>
      <div className="admin-form-grid">
        <StoreFields fields={fields} errors={errors} onChange={onFieldChange} />
        <label>Período de teste<select value={trialDays} onChange={(event) => onTrialDaysChange(event.target.value)}>{TRIAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      <button className="admin-primary" type="submit" disabled={busy}><Plus size={17} /> {busy ? "Criando..." : "Criar empresa e acesso"}</button>
    </form>
  );
}
