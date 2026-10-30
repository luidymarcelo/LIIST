// Rotas dos painéis (admin, empresa e filial). Cada seção tem endereço próprio para o "voltar" do navegador funcionar.
// A loja (catálogo editável) é a porta de entrada; o que é de uso raro fica em Configurações.
export type PortalMode = "admin" | "company" | "branch";
export type PortalSection = "loja" | "configuracoes";
export type SettingsTab = "resumo" | "dados" | "filiais" | "aparencia" | "pedidos" | "mesas" | "equipe" | "senha" | "excluir";

export type PortalRoute =
  | { view: "companies" }
  | { view: "new-company" }
  | { view: "requests" }
  | { view: "section"; section: PortalSection; tenantId?: string; tab?: SettingsTab };

const BASE_PATH: Record<PortalMode, string> = { admin: "/admin", company: "/empresa", branch: "/filial" };
const SETTINGS_SEGMENT = "configuracoes";
const STORE_SEGMENT = "loja";
const REQUESTS_SEGMENT = "solicitacoes";

const SETTINGS_TABS: Record<PortalMode, SettingsTab[]> = {
  admin: ["resumo", "dados", "filiais", "aparencia", "pedidos", "senha", "excluir"],
  company: ["dados", "pedidos", "aparencia", "mesas", "equipe", "filiais", "senha"],
  branch: ["dados"],
};

export function settingsTabs(mode: PortalMode): SettingsTab[] {
  return SETTINGS_TABS[mode];
}

export function defaultSettingsTab(mode: PortalMode): SettingsTab {
  return SETTINGS_TABS[mode][0];
}

export function defaultRoute(mode: PortalMode): PortalRoute {
  return mode === "admin" ? { view: "companies" } : { view: "section", section: "loja" };
}

function sectionRoute(mode: PortalMode, segments: string[], tenantId?: string): PortalRoute | null {
  const [segment = STORE_SEGMENT, tab, ...rest] = segments;
  const withTenant = tenantId ? { tenantId } : {};
  if (rest.length) return null;
  if (segment === STORE_SEGMENT) return tab ? null : { view: "section", section: "loja", ...withTenant };
  if (segment !== SETTINGS_SEGMENT) return null;
  const settingsTab = (tab ?? defaultSettingsTab(mode)) as SettingsTab;
  return settingsTabs(mode).includes(settingsTab) ? { view: "section", section: "configuracoes", ...withTenant, tab: settingsTab } : null;
}

// Endereços desconhecidos voltam para a tela inicial do painel em vez de quebrar.
export function parsePortalPath(mode: PortalMode, pathname: string): PortalRoute {
  const base = BASE_PATH[mode];
  const trimmed = pathname.replace(/\/+$/, "");
  if (trimmed !== base && !trimmed.startsWith(`${base}/`)) return defaultRoute(mode);
  let segments: string[];
  try {
    segments = trimmed.slice(base.length).split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch {
    return defaultRoute(mode);
  }
  if (mode !== "admin") return sectionRoute(mode, segments) ?? defaultRoute(mode);
  if (!segments.length) return { view: "companies" };
  if (segments.length === 1 && segments[0] === "nova-empresa") return { view: "new-company" };
  if (segments.length === 1 && segments[0] === REQUESTS_SEGMENT) return { view: "requests" };
  if (segments[0] === "empresas" && segments[1]) {
    return sectionRoute(mode, segments.slice(2), segments[1]) ?? { view: "companies" };
  }
  return { view: "companies" };
}

export function portalPath(mode: PortalMode, route: PortalRoute): string {
  const base = BASE_PATH[mode];
  if (route.view === "companies") return base;
  if (route.view === "new-company") return `${base}/nova-empresa`;
  if (route.view === "requests") return `${base}/${REQUESTS_SEGMENT}`;
  const tenantPrefix = mode === "admin" && route.tenantId ? `/empresas/${encodeURIComponent(route.tenantId)}` : "";
  if (route.section === "loja") return mode === "admin" ? `${base}${tenantPrefix}/${STORE_SEGMENT}` : base;
  const tab = route.tab && route.tab !== defaultSettingsTab(mode) ? `/${route.tab}` : "";
  return `${base}${tenantPrefix}/${SETTINGS_SEGMENT}${tab}`;
}
