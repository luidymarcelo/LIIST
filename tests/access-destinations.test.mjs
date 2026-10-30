import assert from "node:assert/strict";
import test from "node:test";
import { accessDestinations } from "../lib/access-destinations.ts";

const pizzaria = { id: "s1", name: "Dom Ruan Centro", document: "52998224725" };
const praia = { id: "s2", name: "Dom Ruan Praia", document: "11222333000181" };

test("admin da plataforma vai para a administração", () => {
  const destinations = accessDestinations({ isPlatformAdmin: true, ownerCompanyName: null, memberships: [] });
  assert.deepEqual(destinations.map((item) => item.href), ["/admin"]);
});

test("dono da empresa vai para Minha loja", () => {
  const destinations = accessDestinations({ isPlatformAdmin: false, ownerCompanyName: "Pizzaria Dom Ruan", memberships: [] });
  assert.equal(destinations.length, 1);
  assert.equal(destinations[0].href, "/empresa");
  assert.equal(destinations[0].title, "Pizzaria Dom Ruan");
});

test("gerente recebe uma opção por filial vinculada, com o documento da filial", () => {
  const destinations = accessDestinations({
    isPlatformAdmin: false,
    ownerCompanyName: null,
    memberships: [{ tenantName: "Pizzaria Dom Ruan", roles: ["branch_manager"], isActive: true, stores: [pizzaria, praia] }],
  });
  assert.deepEqual(destinations.map((item) => [item.kind, item.title, item.document]), [
    ["branch", "Dom Ruan Centro", "52998224725"],
    ["branch", "Dom Ruan Praia", "11222333000181"],
  ]);
});

test("equipe da loja vai para a operação e vê as próprias funções", () => {
  const [destination] = accessDestinations({
    isPlatformAdmin: false,
    ownerCompanyName: null,
    memberships: [{ tenantName: "Pizzaria Dom Ruan", roles: ["waiter", "cashier"], isActive: true, stores: [pizzaria] }],
  });
  assert.equal(destination.kind, "operation");
  assert.equal(destination.href, "/operacao");
  assert.match(destination.description, /Garçom, Caixa/);
});

test("quem acumula gerência e atendimento recebe as duas opções", () => {
  const destinations = accessDestinations({
    isPlatformAdmin: false,
    ownerCompanyName: null,
    memberships: [{ tenantName: "Pizzaria Dom Ruan", roles: ["branch_manager", "waiter"], isActive: true, stores: [pizzaria] }],
  });
  assert.deepEqual(destinations.map((item) => item.kind), ["branch", "operation"]);
});

test("ignora vínculos inativos, papel de dono e filiais sem documento válido", () => {
  const destinations = accessDestinations({
    isPlatformAdmin: false,
    ownerCompanyName: null,
    memberships: [
      { tenantName: "A", roles: ["waiter"], isActive: false, stores: [pizzaria] },
      { tenantName: "B", roles: ["owner"], isActive: true, stores: [pizzaria] },
      { tenantName: "C", roles: ["kitchen"], isActive: true, stores: [{ id: "s3", name: "Sem doc", document: null }] },
      { tenantName: "D", roles: ["waiter"], isActive: true, stores: [{ id: "s4", name: "Dígito errado", document: "52998224726" }] },
    ],
  });
  assert.deepEqual(destinations, []);
});

test("admin que também é dono vê as duas opções, admin primeiro", () => {
  const destinations = accessDestinations({ isPlatformAdmin: true, ownerCompanyName: "Pizzaria Dom Ruan", memberships: [] });
  assert.deepEqual(destinations.map((item) => item.kind), ["admin", "company"]);
});
