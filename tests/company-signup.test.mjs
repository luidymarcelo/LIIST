import assert from "node:assert/strict";
import test from "node:test";
import { companyCreationBody, companyStatus, formatPhone, validateAccount, validateCompanyRequest } from "../lib/company-signup.ts";

const NOW = new Date("2026-10-28T12:00:00Z");
const valid = {
  ownerName: "Ruan Silva",
  ownerPhone: "(47) 99999-1234",
  companyName: "Pizzaria Dom Ruan",
  document: "529.982.247-25",
  city: "Joinville/SC",
  address: "",
  segment: "restaurant",
  message: "",
};

test("status da empresa: ativa, em teste, teste vencido e suspensa", () => {
  assert.deepEqual(companyStatus({ is_active: true, trial_ends_at: null }, NOW), { tone: "active", label: "Ativa" });
  assert.deepEqual(companyStatus({ is_active: true, trial_ends_at: "2026-11-05T12:00:00Z" }, NOW), { tone: "trial", label: "Em teste até 05/11" });
  assert.deepEqual(companyStatus({ is_active: true, trial_ends_at: "2026-10-20T12:00:00Z" }, NOW), { tone: "expired", label: "Teste vencido" });
  assert.deepEqual(companyStatus({ is_active: false, trial_ends_at: "2026-11-05T12:00:00Z" }, NOW), { tone: "suspended", label: "Suspensa" });
});

test("solicitação completa não tem erros", () => {
  assert.deepEqual(validateCompanyRequest(valid), {});
});

test("aponta cada campo obrigatório que falta ou está errado", () => {
  const errors = validateCompanyRequest({ ...valid, ownerName: " ", ownerPhone: "123", companyName: "", document: "529.982.247-26", city: "" });
  assert.deepEqual(Object.keys(errors).sort(), ["city", "companyName", "document", "ownerName", "ownerPhone"]);
  assert.match(errors.document, /CPF ou CNPJ/);
});

test("aceita CNPJ e celular com 11 ou fixo com 10 dígitos", () => {
  assert.deepEqual(validateCompanyRequest({ ...valid, document: "11.222.333/0001-81", ownerPhone: "4733334444" }), {});
});

test("formata o WhatsApp enquanto digita", () => {
  assert.equal(formatPhone("47"), "(47");
  assert.equal(formatPhone("4733334444"), "(47) 3333-4444");
  assert.equal(formatPhone("47999991234"), "(47) 99999-1234");
  assert.equal(formatPhone("4799999123456"), "(47) 99999-1234");
});

test("conta de acesso: e-mail válido e senha com pelo menos 8 caracteres", () => {
  assert.deepEqual(validateAccount({ email: "dono@loja.com", password: "12345678" }), {});
  assert.deepEqual(Object.keys(validateAccount({ email: "dono@", password: "1234567" })).sort(), ["email", "password"]);
});

test("cadastro pelo admin gera a mesma loja do cadastro do lojista", () => {
  const body = companyCreationBody({ ...valid, address: " Rua A, 10 " }, { email: " Dono@Loja.com ", password: "12345678" }, "14");
  assert.deepEqual(body, {
    name: "Ruan Silva",
    email: "dono@loja.com",
    password: "12345678",
    company: {
      name: "Pizzaria Dom Ruan",
      slug: "pizzaria-dom-ruan",
      branch_name: "Pizzaria Dom Ruan",
      branch_slug: "pizzaria-dom-ruan",
      branch_cnpj: "52998224725",
      whatsapp_phone: "47999991234",
      owner_phone: "47999991234",
      segment: "restaurant",
      city: "Joinville/SC",
      address: "Rua A, 10",
      trial_days: 14,
    },
  });
  const noTrial = companyCreationBody(valid, { email: "a@b.co", password: "12345678" }, "");
  assert.equal(noTrial.company.trial_days, null);
  assert.equal(noTrial.company.address, null);
});
