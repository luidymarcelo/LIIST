"use client";

import { formatDocumentAuto } from "../lib/branch-document";
import { formatPhone, SEGMENT_OPTIONS, type CompanyRequestErrors, type CompanyRequestFields } from "../lib/company-signup";

// Ficha da empresa usada no cadastro do lojista e na criação pelo admin: mesmos campos, nomes e regras.
type CompanyFieldsProps = {
  fields: CompanyRequestFields;
  errors: CompanyRequestErrors;
  onChange: <K extends keyof CompanyRequestFields>(key: K, value: CompanyRequestFields[K]) => void;
};

function fieldA11y(errors: CompanyRequestErrors, key: keyof CompanyRequestFields) {
  return { "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `erro-${key}` : undefined };
}

function FieldError({ errors, field }: { errors: CompanyRequestErrors; field: keyof CompanyRequestFields }) {
  return errors[field] ? <small className="signup-field-error" id={`erro-${field}`}>{errors[field]}</small> : null;
}

export function OwnerFields({ fields, errors, onChange, nameLabel = "Seu nome" }: CompanyFieldsProps & { nameLabel?: string }) {
  return (
    <>
      <label>{nameLabel}<input value={fields.ownerName} onChange={(event) => onChange("ownerName", event.target.value)} autoComplete="name" required {...fieldA11y(errors, "ownerName")} /><FieldError errors={errors} field="ownerName" /></label>
      <label>WhatsApp<input value={fields.ownerPhone} onChange={(event) => onChange("ownerPhone", formatPhone(event.target.value))} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" required {...fieldA11y(errors, "ownerPhone")} /><FieldError errors={errors} field="ownerPhone" /></label>
    </>
  );
}

export function StoreFields({ fields, errors, onChange }: CompanyFieldsProps) {
  return (
    <>
      <label>Nome da loja<input value={fields.companyName} onChange={(event) => onChange("companyName", event.target.value)} required {...fieldA11y(errors, "companyName")} /><FieldError errors={errors} field="companyName" /></label>
      <label>CPF ou CNPJ<input value={fields.document} onChange={(event) => onChange("document", formatDocumentAuto(event.target.value))} inputMode="numeric" maxLength={18} required {...fieldA11y(errors, "document")} /><small className="signup-hint">O CPF não aparece no catálogo.</small><FieldError errors={errors} field="document" /></label>
      <label>Ramo<select value={fields.segment} onChange={(event) => onChange("segment", event.target.value)}>{SEGMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Cidade<input value={fields.city} onChange={(event) => onChange("city", event.target.value)} autoComplete="address-level2" placeholder="Ex.: Joinville/SC" required {...fieldA11y(errors, "city")} /><FieldError errors={errors} field="city" /></label>
      <label><span>Endereço <span className="signup-optional">(opcional)</span></span><input value={fields.address} onChange={(event) => onChange("address", event.target.value)} autoComplete="street-address" /></label>
    </>
  );
}
