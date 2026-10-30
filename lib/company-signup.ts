// Cadastro de empresa pelo próprio lojista e situação da empresa (ativa, em teste, suspensa).
import { isValidDocument } from "./branch-document.ts";

export type CompanySegment = "restaurant" | "pharmacy" | "construction" | "retail" | "services";

export const SEGMENT_OPTIONS: Array<{ value: CompanySegment; label: string }> = [
  { value: "restaurant", label: "Restaurante, lanchonete ou pizzaria" },
  { value: "retail", label: "Loja e varejo" },
  { value: "construction", label: "Material de construção" },
  { value: "pharmacy", label: "Farmácia" },
  { value: "services", label: "Serviços" },
];

export interface CompanyRequestFields {
  ownerName: string;
  ownerPhone: string;
  companyName: string;
  document: string;
  city: string;
  address: string;
  segment: string;
  message: string;
}

export const EMPTY_COMPANY_FIELDS: CompanyRequestFields = { ownerName: "", ownerPhone: "", companyName: "", document: "", city: "", address: "", segment: "restaurant", message: "" };

export type CompanyRequestErrors = Partial<Record<keyof CompanyRequestFields, string>>;

export function validateCompanyRequest(fields: CompanyRequestFields): CompanyRequestErrors {
  const errors: CompanyRequestErrors = {};
  if (fields.ownerName.trim().length < 2) errors.ownerName = "Informe o nome do responsável.";
  if (!/^\d{10,11}$/.test(fields.ownerPhone.replace(/\D/g, ""))) errors.ownerPhone = "Informe o WhatsApp com DDD.";
  if (fields.companyName.trim().length < 2) errors.companyName = "Informe o nome da loja.";
  if (!isValidDocument(fields.document)) errors.document = "Informe um CPF ou CNPJ válido.";
  if (fields.city.trim().length < 2) errors.city = "Informe a cidade.";
  return errors;
}

// Formato que a função submit_company_request do banco recebe.
export function companyRequestParams(fields: CompanyRequestFields) {
  return {
    p_owner_name: fields.ownerName.trim(),
    p_owner_phone: fields.ownerPhone.replace(/\D/g, ""),
    p_company_name: fields.companyName.trim(),
    p_document: fields.document.replace(/\D/g, ""),
    p_city: fields.city.trim(),
    p_address: fields.address.trim() || null,
    p_segment: fields.segment || "retail",
    p_message: fields.message.trim() || null,
  };
}

export const MIN_PASSWORD_LENGTH = 8;

// Mesmas opções na aprovação de solicitação e na criação pelo admin.
export const TRIAL_OPTIONS = [
  { value: "", label: "Sem teste (já ativa)" },
  { value: "7", label: "7 dias de teste" },
  { value: "14", label: "14 dias de teste" },
  { value: "30", label: "30 dias de teste" },
];

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export interface AccountFields {
  email: string;
  password: string;
}

export function validateAccount(account: AccountFields): Partial<Record<keyof AccountFields, string>> {
  const errors: Partial<Record<keyof AccountFields, string>> = {};
  if (!/^\S+@\S+\.\S+$/.test(account.email.trim())) errors.email = "Informe um e-mail válido.";
  if (account.password.length < MIN_PASSWORD_LENGTH) errors.password = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  return errors;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Corpo da função create-store-user quando o admin cria a empresa: mesma ficha do cadastro do lojista.
// A primeira filial leva o nome da loja; a localização no mapa é confirmada pelo dono no primeiro acesso.
export function companyCreationBody(fields: CompanyRequestFields, account: AccountFields, trialDays: string) {
  const params = companyRequestParams(fields);
  const slug = slugify(params.p_company_name);
  return {
    name: params.p_owner_name,
    email: account.email.trim().toLowerCase(),
    password: account.password,
    company: {
      name: params.p_company_name,
      slug,
      branch_name: params.p_company_name,
      branch_slug: slug,
      branch_cnpj: params.p_document,
      whatsapp_phone: params.p_owner_phone,
      owner_phone: params.p_owner_phone,
      segment: params.p_segment,
      city: params.p_city,
      address: params.p_address,
      trial_days: trialDays ? Number(trialDays) : null,
    },
  };
}

export type CompanyStatusTone = "active" | "trial" | "expired" | "suspended";

export function companyStatus(
  company: { is_active: boolean | null; trial_ends_at: string | null },
  now: Date = new Date(),
): { tone: CompanyStatusTone; label: string } {
  if (company.is_active === false) return { tone: "suspended", label: "Suspensa" };
  if (!company.trial_ends_at) return { tone: "active", label: "Ativa" };
  const trialEnd = new Date(company.trial_ends_at);
  if (trialEnd.getTime() <= now.getTime()) return { tone: "expired", label: "Teste vencido" };
  const day = trialEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return { tone: "trial", label: `Em teste até ${day}` };
}
