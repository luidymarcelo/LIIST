// Para onde cada conta vai depois do login. O papel vem do cadastro do usuário, não da tela por onde ele entra.
import { isValidDocument } from "./branch-document.ts";

export type AccessKind = "admin" | "company" | "branch" | "operation";

export interface AccessStore {
  id: string;
  name: string;
  document: string | null;
}

export interface AccessMembership {
  tenantName: string;
  roles: string[];
  isActive: boolean;
  stores: AccessStore[];
}

export interface AccessDestination {
  key: string;
  kind: AccessKind;
  href: string;
  title: string;
  description: string;
  // CPF ou CNPJ da filial, que os painéis de filial e de operação usam para abrir a unidade certa.
  document?: string;
}

export interface AccessProfile {
  isPlatformAdmin: boolean;
  ownerCompanyName: string | null;
  memberships: AccessMembership[];
}

// Mesmas chaves que os painéis já leem do navegador.
export const BRANCH_DOCUMENT_STORAGE_KEY = "liist-branch-cnpj";
export const OPERATION_DOCUMENT_STORAGE_KEY = "liist-operation-cnpj";

const OPERATION_ROLE_LABEL: Record<string, string> = {
  waiter: "Garçom",
  cashier: "Caixa",
  kitchen: "Cozinha",
  supervisor: "Supervisor",
};

export function accessDestinations({ isPlatformAdmin, ownerCompanyName, memberships }: AccessProfile): AccessDestination[] {
  const destinations: AccessDestination[] = [];
  if (isPlatformAdmin) {
    destinations.push({ key: "admin", kind: "admin", href: "/admin", title: "Administração da plataforma", description: "Todas as empresas" });
  }
  if (ownerCompanyName) {
    destinations.push({ key: "company", kind: "company", href: "/empresa", title: ownerCompanyName, description: "Dono da empresa" });
  }
  for (const membership of memberships) {
    if (!membership.isActive) continue;
    const operationRoles = membership.roles.filter((role) => role in OPERATION_ROLE_LABEL);
    for (const store of membership.stores) {
      const document = (store.document ?? "").replace(/\D/g, "");
      // Os painéis recusam documento com dígito verificador errado; oferecer esse destino faria a tela ir e voltar.
      if (!isValidDocument(document)) continue;
      if (membership.roles.includes("branch_manager")) {
        destinations.push({ key: `branch:${store.id}`, kind: "branch", href: "/filial", title: store.name, description: `Gerente da filial · ${membership.tenantName}`, document });
      }
      if (operationRoles.length) {
        const labels = operationRoles.map((role) => OPERATION_ROLE_LABEL[role]).join(", ");
        destinations.push({ key: `operation:${store.id}`, kind: "operation", href: "/operacao", title: store.name, description: `${labels} · ${membership.tenantName}`, document });
      }
    }
  }
  return destinations;
}

// Guarda a filial escolhida onde o painel de destino espera encontrá-la.
export function rememberDestination(destination: AccessDestination, storage: Pick<Storage, "setItem">): void {
  if (!destination.document) return;
  if (destination.kind === "branch") storage.setItem(BRANCH_DOCUMENT_STORAGE_KEY, destination.document);
  if (destination.kind === "operation") storage.setItem(OPERATION_DOCUMENT_STORAGE_KEY, destination.document);
}
