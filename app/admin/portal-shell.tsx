"use client";

import { ArrowLeft, Building2, ClipboardList, Inbox, LogOut, Settings, Store } from "lucide-react";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { LiistBrand } from "../../components/liist-brand";
import { portalPath, type PortalMode, type PortalRoute, type PortalSection } from "../../lib/portal-route";

type ShellBranch = { id: string; name: string };

const CONTEXT_LABEL: Record<PortalMode, string> = {
  admin: "Administração",
  company: "Área do lojista",
  branch: "Área da filial",
};

export function sectionLabel(mode: PortalMode, section: PortalSection): string {
  if (section === "configuracoes") return "Configurações";
  return mode === "admin" ? "Catálogo da empresa" : "Minha loja";
}

// Clique comum navega sem recarregar; Ctrl/⌘ + clique e botão do meio continuam abrindo nova aba.
function isPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PortalLink({ mode, route, onNavigate, className, current, children }: {
  mode: PortalMode;
  route: PortalRoute;
  onNavigate: (route: PortalRoute) => void;
  className?: string;
  current?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      className={className}
      href={portalPath(mode, route)}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onNavigate(route);
      }}
    >
      {children}
    </a>
  );
}

export function PortalSidebar({ mode, route, tenantName, tenantId, branches, activeBranchId, email, onNavigate, onBranchChange, onSignOut }: {
  mode: PortalMode;
  route: PortalRoute;
  tenantName?: string;
  tenantId?: string;
  branches: ShellBranch[];
  activeBranchId: string;
  email: string;
  onNavigate: (route: PortalRoute) => void;
  onBranchChange: (branchId: string) => void;
  onSignOut: () => void;
}) {
  const insideCompany = mode !== "admin" || (route.view === "section" && Boolean(tenantId));
  const activeSection = route.view === "section" ? route.section : null;
  const activeBranch = branches.find((branch) => branch.id === activeBranchId);
  const navRef = useRef<HTMLElement>(null);

  // No celular o menu rola na horizontal: mantém a seção aberta à vista.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeSection, route.view]);

  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar-brand"><LiistBrand compact context={CONTEXT_LABEL[mode]} /></div>

      {mode === "admin" && insideCompany ? (
        <PortalLink className="portal-back-link" mode={mode} route={{ view: "companies" }} onNavigate={onNavigate}><ArrowLeft size={15} /> Todas as empresas</PortalLink>
      ) : null}

      {insideCompany && tenantName ? (
        <div className="portal-context">
          <strong>{tenantName}</strong>
          {branches.length > 1 ? (
            <label>
              <span className="sr-only">Filial</span>
              <select value={activeBranchId} onChange={(event) => onBranchChange(event.target.value)}>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
          ) : activeBranch ? <small>{activeBranch.name}</small> : null}
        </div>
      ) : null}

      <nav className="portal-nav" ref={navRef} aria-label="Seções do painel">
        {mode === "admin" && !insideCompany ? (
          <>
            <PortalLink mode={mode} route={{ view: "companies" }} onNavigate={onNavigate} current={route.view === "companies"}><Building2 size={18} /><span>Empresas</span></PortalLink>
            <PortalLink mode={mode} route={{ view: "requests" }} onNavigate={onNavigate} current={route.view === "requests" || route.view === "new-company"}><Inbox size={18} /><span>Solicitações</span></PortalLink>
          </>
        ) : (
          <>
            <PortalLink mode={mode} route={{ view: "section", section: "loja", tenantId }} onNavigate={onNavigate} current={activeSection === "loja"}><Store size={18} /><span>{sectionLabel(mode, "loja")}</span></PortalLink>
            {mode !== "admin" ? <a href="/pedidos"><ClipboardList size={18} /><span>Pedidos</span></a> : null}
            <PortalLink mode={mode} route={{ view: "section", section: "configuracoes", tenantId }} onNavigate={onNavigate} current={activeSection === "configuracoes"}><Settings size={18} /><span>{sectionLabel(mode, "configuracoes")}</span></PortalLink>
          </>
        )}
      </nav>

      <div className="portal-sidebar-footer">
        <Link href="/">Ver catálogo público</Link>
        <span title={email}>{email}</span>
        <button type="button" onClick={onSignOut}><LogOut size={15} /> Sair</button>
      </div>
    </aside>
  );
}

export function PortalTabs<T extends string>({ mode, label, tabs, active, routeFor, onNavigate }: {
  mode: PortalMode;
  label: string;
  tabs: Array<{ id: T; label: string }>;
  active: T;
  routeFor: (tab: T) => PortalRoute;
  onNavigate: (route: PortalRoute) => void;
}) {
  if (tabs.length < 2) return null;
  return (
    <nav className="portal-tabs" aria-label={label}>
      {tabs.map((tab) => (
        <PortalLink key={tab.id} mode={mode} route={routeFor(tab.id)} onNavigate={onNavigate} current={tab.id === active}>{tab.label}</PortalLink>
      ))}
    </nav>
  );
}

export function PortalHeader({ title, context, actions }: { title: string; context?: string; actions?: ReactNode }) {
  return (
    <header className="portal-header">
      <div>
        {context ? <p>{context}</p> : null}
        <h1>{title}</h1>
      </div>
      {actions ? <div className="portal-header-actions">{actions}</div> : null}
    </header>
  );
}
