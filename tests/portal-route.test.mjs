import assert from "node:assert/strict";
import test from "node:test";
import { parsePortalPath, portalPath } from "../lib/portal-route.ts";

test("the store editor is the company portal home", () => {
  assert.deepEqual(parsePortalPath("company", "/empresa"), { view: "section", section: "loja" });
  assert.equal(portalPath("company", { view: "section", section: "loja" }), "/empresa");
});

test("settings live behind their own address with one tab per subject", () => {
  assert.deepEqual(parsePortalPath("company", "/empresa/configuracoes"), { view: "section", section: "configuracoes", tab: "dados" });
  assert.deepEqual(parsePortalPath("company", "/empresa/configuracoes/mesas/"), { view: "section", section: "configuracoes", tab: "mesas" });
  assert.equal(portalPath("company", { view: "section", section: "configuracoes", tab: "dados" }), "/empresa/configuracoes");
  assert.equal(portalPath("company", { view: "section", section: "configuracoes", tab: "equipe" }), "/empresa/configuracoes/equipe");
});

test("admin routes carry the company being managed", () => {
  const route = parsePortalPath("admin", "/admin/empresas/abc-123/configuracoes/pedidos");
  assert.deepEqual(route, { view: "section", section: "configuracoes", tenantId: "abc-123", tab: "pedidos" });
  assert.equal(portalPath("admin", route), "/admin/empresas/abc-123/configuracoes/pedidos");
  assert.equal(portalPath("admin", { view: "section", section: "loja", tenantId: "abc-123" }), "/admin/empresas/abc-123/loja");
  assert.deepEqual(parsePortalPath("admin", "/admin/empresas/abc-123/configuracoes"), { view: "section", section: "configuracoes", tenantId: "abc-123", tab: "resumo" });
  assert.deepEqual(parsePortalPath("admin", "/admin"), { view: "companies" });
  assert.deepEqual(parsePortalPath("admin", "/admin/nova-empresa"), { view: "new-company" });
});

test("company signup requests have their own admin address", () => {
  assert.deepEqual(parsePortalPath("admin", "/admin/solicitacoes"), { view: "requests" });
  assert.equal(portalPath("admin", { view: "requests" }), "/admin/solicitacoes");
  assert.deepEqual(parsePortalPath("company", "/empresa/solicitacoes"), { view: "section", section: "loja" });
});

test("branch portal only reaches its own store data", () => {
  assert.deepEqual(parsePortalPath("branch", "/filial/configuracoes"), { view: "section", section: "configuracoes", tab: "dados" });
  assert.deepEqual(parsePortalPath("branch", "/filial/configuracoes/equipe"), { view: "section", section: "loja" });
  assert.equal(portalPath("branch", { view: "section", section: "loja" }), "/filial");
});

test("unknown, forbidden or malformed addresses fall back to the panel home", () => {
  assert.deepEqual(parsePortalPath("company", "/empresa/qualquer"), { view: "section", section: "loja" });
  assert.deepEqual(parsePortalPath("company", "/empresa/configuracoes/excluir"), { view: "section", section: "loja" });
  assert.deepEqual(parsePortalPath("company", "/empresa/configuracoes/dados/extra"), { view: "section", section: "loja" });
  assert.deepEqual(parsePortalPath("admin", "/admin/empresas/abc/configuracoes/equipe"), { view: "companies" });
  assert.deepEqual(parsePortalPath("admin", "/admin/xyz"), { view: "companies" });
  assert.deepEqual(parsePortalPath("admin", "/admin/empresas/%E0%A4%A/loja"), { view: "companies" });
});
