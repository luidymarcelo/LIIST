import assert from "node:assert/strict";
import test from "node:test";
import {
  detectDocumentKind,
  formatDocument,
  formatDocumentAuto,
  isValidCnpj,
  isValidCpf,
  isValidDocument,
} from "../lib/branch-document.ts";

test("valida CPF pelos dígitos verificadores", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("529.982.247-26"), false);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("5299822472"), false);
});

test("valida CNPJ pelos dígitos verificadores", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11.222.333/0001-82"), false);
  assert.equal(isValidCnpj("00.000.000/0000-00"), false);
});

test("aceita CPF ou CNPJ conforme o tipo escolhido", () => {
  assert.equal(isValidDocument("529.982.247-25", "cpf"), true);
  assert.equal(isValidDocument("529.982.247-25", "cnpj"), false);
  assert.equal(isValidDocument("11.222.333/0001-81", "cnpj"), true);
  assert.equal(isValidDocument("11.222.333/0001-81", "cpf"), false);
});

test("aceita qualquer documento válido quando o tipo não é informado", () => {
  assert.equal(isValidDocument("52998224725"), true);
  assert.equal(isValidDocument("11222333000181"), true);
  assert.equal(isValidDocument("123"), false);
});

test("formata com a máscara do tipo e limita a quantidade de dígitos", () => {
  assert.equal(formatDocument("52998224725", "cpf"), "529.982.247-25");
  assert.equal(formatDocument("5299822472599", "cpf"), "529.982.247-25");
  assert.equal(formatDocument("5299", "cpf"), "529.9");
  assert.equal(formatDocument("11222333000181", "cnpj"), "11.222.333/0001-81");
});

test("máscara automática usa CPF até 11 dígitos e CNPJ acima disso", () => {
  assert.equal(formatDocumentAuto("52998224725"), "529.982.247-25");
  assert.equal(formatDocumentAuto("112223330001"), "11.222.333/0001");
  assert.equal(formatDocumentAuto("11.222.333/0001-81"), "11.222.333/0001-81");
  assert.equal(formatDocumentAuto("112223330001819"), "11.222.333/0001-81");
});

test("detecta o tipo pelo tamanho do documento salvo", () => {
  assert.equal(detectDocumentKind("529.982.247-25"), "cpf");
  assert.equal(detectDocumentKind("11222333000181"), "cnpj");
  assert.equal(detectDocumentKind(""), "cnpj");
  assert.equal(detectDocumentKind(null), "cnpj");
});
