import assert from "node:assert/strict";
import test from "node:test";
import { fetchStoreDocuments, withStoreDocuments } from "../lib/store-documents.ts";

function fakeClient({ rpcResult, tableResult }) {
  const calls = [];
  return {
    calls,
    rpc(name, args) {
      calls.push(["rpc", name, args]);
      return Promise.resolve(rpcResult);
    },
    from(table) {
      return {
        select(columns) {
          return {
            in(column, values) {
              calls.push(["select", table, columns, column, values]);
              return Promise.resolve(tableResult);
            },
          };
        },
      };
    },
  };
}

test("busca o documento das filiais pela função do banco", async () => {
  const client = fakeClient({ rpcResult: { data: [{ store_id: "a", document: "52998224725" }], error: null } });
  const documents = await fetchStoreDocuments(client, ["a", "b"]);
  assert.deepEqual([...documents], [["a", "52998224725"]]);
  assert.deepEqual(client.calls, [["rpc", "get_store_documents", { p_store_ids: ["a", "b"] }]]);
});

test("sem a migration 032, lê a coluna direto como antes", async () => {
  const client = fakeClient({
    rpcResult: { data: null, error: { code: "PGRST202", message: "Could not find the function public.get_store_documents" } },
    tableResult: { data: [{ id: "a", cnpj: "11222333000181" }], error: null },
  });
  const documents = await fetchStoreDocuments(client, ["a"]);
  assert.deepEqual([...documents], [["a", "11222333000181"]]);
  assert.equal(client.calls[1][2], "id, cnpj");
});

test("outro erro não vira leitura direta e não derruba a tela", async () => {
  const client = fakeClient({ rpcResult: { data: null, error: { code: "42501", message: "permission denied" } } });
  const documents = await fetchStoreDocuments(client, ["a"]);
  assert.equal(documents.size, 0);
  assert.equal(client.calls.length, 1);
});

test("sem filiais, não chama o banco", async () => {
  const client = fakeClient({});
  assert.equal((await fetchStoreDocuments(client, [])).size, 0);
  assert.equal(client.calls.length, 0);
});

test("completa as filiais com o documento sem apagar o que já veio", () => {
  const rows = [{ id: "a", name: "Centro" }, { id: "b", name: "Sul", cnpj: "11222333000181" }];
  const merged = withStoreDocuments(rows, new Map([["a", "52998224725"]]));
  assert.deepEqual(merged, [{ id: "a", name: "Centro", cnpj: "52998224725" }, { id: "b", name: "Sul", cnpj: "11222333000181" }]);
  assert.notEqual(merged[0], rows[0]);
});
