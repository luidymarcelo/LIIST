"use client";

import { Camera, Eye, ImagePlus, Package, Pencil, Plus, Search, Settings, Store, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { catalogThemeStyle } from "../../lib/catalog-theme";

// Editor "Minha loja": mesma apresentação do catálogo público (mesmas classes de CSS), com os controles sobre cada elemento.
export type EditorProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string | null;
  badge: string | null;
  categoryId: string | null;
  isActive: boolean;
  imageUrl: string | null;
  imageCount: number;
};

export type EditorCategory = { id: string; name: string };
export type QuickProductPatch = { name?: string; price?: number };

type StoreEditorProps = {
  companyName: string;
  branchName: string;
  themeColor: string;
  logoUrl: string | null;
  coverUrl: string | null;
  coverPending: boolean;
  savingCover: boolean;
  savingLogo: boolean;
  canEditLogo: boolean;
  categories: EditorCategory[];
  products: EditorProduct[];
  imageLimit: number;
  busyProductId: string;
  catalogLayout: string;
  publicUrl: string;
  settingsHref: string;
  tools: ReactNode;
  onOpenSettings: () => void;
  onPickCover: () => void;
  onSaveCover: () => void;
  onCancelCover: () => void;
  onRemoveCover: () => void;
  onPickLogo: () => void;
  onAddProduct: (categoryId?: string) => void;
  onEditProduct: (productId: string) => void;
  onDeleteProduct: (productId: string) => void;
  onToggleProduct: (productId: string) => void;
  onAddPhoto: (productId: string) => void;
  onQuickUpdate: (productId: string, patch: QuickProductPatch) => Promise<boolean>;
  onAddCategory: () => void;
  onDeleteCategory: (categoryId: string) => void;
};

const UNCATEGORIZED = "__sem-categoria__";

function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parsePrice(value: string): number | null {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const price = Number(normalized);
  return normalized && Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : null;
}

// Texto que vira campo ao clicar: Enter ou sair do campo salva, Esc desiste.
function InlineEdit({ value, display, label, inputMode, parse, onSave, className }: {
  value: string;
  display: ReactNode;
  label: string;
  inputMode?: "decimal" | "text";
  parse: (raw: string) => string | null;
  onSave: (next: string) => Promise<boolean>;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const restoreFocusRef = useRef(false);
  const errorId = useId();

  useEffect(() => {
    if (editing) inputRef.current?.select();
    else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [editing]);

  function close(restoreFocus: boolean) {
    busyRef.current = true;
    restoreFocusRef.current = restoreFocus;
    setInvalid(false);
    setEditing(false);
  }

  async function commit(source: "enter" | "blur") {
    if (busyRef.current) return;
    const parsed = parse(draft);
    if (parsed === null) {
      // Saindo do campo com valor inválido, desiste em vez de prender o foco.
      if (source === "blur") close(false);
      else setInvalid(true);
      return;
    }
    if (parsed === value) {
      close(source === "enter");
      return;
    }
    busyRef.current = true;
    setSaving(true);
    const saved = await onSave(parsed);
    setSaving(false);
    busyRef.current = false;
    if (saved) close(source === "enter");
    else setInvalid(true);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit("enter");
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }

  if (!editing) {
    return (
      <button ref={triggerRef} className={`inline-edit-trigger ${className ?? ""}`.trim()} type="button" title={`Clique para alterar ${label}`} aria-label={`Alterar ${label}`} onClick={() => { busyRef.current = false; setDraft(value); setInvalid(false); setEditing(true); }}>
        {display}
        <Pencil size={13} aria-hidden="true" />
      </button>
    );
  }

  return (
    <span className="inline-edit-field">
      <input
        ref={inputRef}
        className={`inline-edit-input ${className ?? ""} ${invalid ? "invalid" : ""}`.trim()}
        value={draft}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        inputMode={inputMode}
        readOnly={saving}
        onChange={(event) => { setDraft(event.target.value); setInvalid(false); }}
        onKeyDown={handleKey}
        onBlur={() => void commit("blur")}
      />
      {invalid ? <small id={errorId} className="inline-edit-error" role="alert">Valor inválido. Enter salva, Esc cancela.</small> : null}
    </span>
  );
}

function EditorProductCard({ product, imageLimit, busy, onEdit, onDelete, onToggle, onAddPhoto, onQuickUpdate }: {
  product: EditorProduct;
  imageLimit: number;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onAddPhoto: () => void;
  onQuickUpdate: (patch: QuickProductPatch) => Promise<boolean>;
}) {
  const canAddPhoto = product.imageCount < imageLimit;
  return (
    <article className={product.isActive ? "product-card editor-product-card" : "product-card editor-product-card is-paused"}>
      <button className="editor-product-photo" type="button" disabled={busy || !canAddPhoto} title={canAddPhoto ? "Adicionar foto" : `Limite de ${imageLimit} foto(s) atingido`} aria-label={`Adicionar foto de ${product.name}`} onClick={onAddPhoto}>
        {product.imageUrl ? <img className="product-card-image" src={product.imageUrl} alt={product.name} /> : <span className="product-card-image catalog-image-placeholder"><Package size={28} /></span>}
        {canAddPhoto ? <span className="editor-photo-hint"><ImagePlus size={14} /> Foto</span> : null}
      </button>
      <div className="product-content">
        <div>
          {!product.isActive ? <span className="editor-paused-badge">Pausado · o cliente não vê</span> : product.badge ? <span className="product-badge">{product.badge}</span> : null}
          <h2>
            <InlineEdit
              label={`o nome de ${product.name}`}
              value={product.name}
              display={product.name}
              parse={(raw) => raw.trim() || null}
              onSave={(name) => onQuickUpdate({ name })}
            />
          </h2>
          {product.description ? <p>{product.description}</p> : null}
        </div>
        <footer>
          <span className="price-stack">
            <strong>
              <InlineEdit
                label={`o preço de ${product.name}`}
                value={product.price.toFixed(2).replace(".", ",")}
                display={formatPrice(product.price)}
                inputMode="decimal"
                parse={(raw) => {
                  const price = parsePrice(raw);
                  return price === null ? null : price.toFixed(2).replace(".", ",");
                }}
                onSave={(raw) => onQuickUpdate({ price: parsePrice(raw) ?? product.price })}
              />
            </strong>
            {product.unit ? <small>{product.unit}</small> : null}
          </span>
          <div className="editor-product-actions">
            <button className="editor-availability" type="button" role="switch" aria-checked={product.isActive} aria-label={`${product.name} disponível para o cliente`} disabled={busy} onClick={onToggle} title={product.isActive ? "Pausar: o cliente deixa de ver" : "Mostrar para o cliente"}>
              <span aria-hidden="true" /><em>{product.isActive ? "Disponível" : "Pausado"}</em>
            </button>
            <button className="editor-icon-button" type="button" disabled={busy} title="Editar tudo (descrição, fotos, categoria...)" aria-label={`Editar ${product.name}`} onClick={onEdit}><Pencil size={16} /></button>
            <button className="editor-icon-button danger" type="button" disabled={busy} title="Excluir" aria-label={`Excluir ${product.name}`} onClick={onDelete}><Trash2 size={16} /></button>
          </div>
        </footer>
      </div>
    </article>
  );
}

export function StoreEditor(props: StoreEditorProps) {
  const { categories } = props;
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const products = normalizedQuery ? props.products.filter((product) => product.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery)) : props.products;
  const knownCategoryIds = new Set(categories.map((category) => category.id));
  const sections = [
    ...categories.map((category) => ({ id: category.id, name: category.name, products: products.filter((product) => product.categoryId === category.id) })),
    { id: UNCATEGORIZED, name: "Sem categoria", products: products.filter((product) => !product.categoryId || !knownCategoryIds.has(product.categoryId)) },
  ].filter((section) => (section.id !== UNCATEGORIZED && !normalizedQuery) || section.products.length);

  function scrollToSection(sectionId: string) {
    document.getElementById(`editor-section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="store-editor direct-store-theme" style={catalogThemeStyle(props.themeColor)}>
      <div className="store-editor-toolbar">
        <p><strong>Você está editando sua loja.</strong> Clique no nome ou no preço para alterar. As mudanças aparecem para o cliente na hora.</p>
        <div className="store-editor-toolbar-actions">
          {props.tools}
          <a className="admin-secondary" href={props.publicUrl} target="_blank" rel="noopener noreferrer"><Eye size={16} /> Ver como cliente</a>
          <button className="admin-primary" type="button" onClick={() => props.onAddProduct()}><Plus size={16} /> Adicionar produto</button>
        </div>
      </div>

      <section className="direct-store-page">
        <section className="merchant-presentation">
          <div className="merchant-hero">
            {props.coverUrl ? <img className="merchant-cover" src={props.coverUrl} alt={`Capa de ${props.branchName}`} /> : <div className="merchant-cover catalog-image-placeholder" role="img" aria-label="Loja sem capa"><Store size={54} /></div>}
            <div className="editor-cover-actions">
              {props.coverPending ? (
                <>
                  <button className="admin-primary" type="button" disabled={props.savingCover} onClick={props.onSaveCover}>{props.savingCover ? "Salvando..." : "Salvar capa"}</button>
                  <button className="editor-overlay-button" type="button" disabled={props.savingCover} onClick={props.onCancelCover}><X size={15} /> Cancelar</button>
                </>
              ) : (
                <>
                  <button className="editor-overlay-button" type="button" disabled={props.savingCover} onClick={props.onPickCover}><Camera size={15} /> {props.coverUrl ? "Trocar capa" : "Adicionar capa"}</button>
                  {props.coverUrl ? <button className="editor-overlay-button" type="button" disabled={props.savingCover} title="Remover capa" aria-label="Remover capa" onClick={props.onRemoveCover}><Trash2 size={15} /></button> : null}
                </>
              )}
            </div>
          </div>
          <div className="merchant-info-card">
            <span className={props.logoUrl ? "merchant-profile company-profile" : "merchant-profile"}>
              {props.logoUrl ? <img src={props.logoUrl} alt={`Logo de ${props.companyName}`} /> : <Store size={30} />}
            </span>
            {props.canEditLogo ? (
              <button className="editor-logo-button" type="button" disabled={props.savingLogo} title="Trocar foto da loja" aria-label="Trocar foto da loja" onClick={props.onPickLogo}><Camera size={15} /></button>
            ) : null}
            <div className="merchant-info-content">
              <div className="merchant-info-heading">
                <div>
                  <div className="merchant-title-line"><h1>{props.companyName}</h1></div>
                  <p className="merchant-branch-name">{props.branchName}</p>
                </div>
              </div>
              <a className="editor-settings-link" href={props.settingsHref} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey) return; event.preventDefault(); props.onOpenSettings(); }}>
                <Settings size={15} /> Endereço, horário e WhatsApp ficam em Configurações
              </a>
            </div>
          </div>
        </section>

        <section className="catalog-surface">
          <nav className="category-strip" aria-label="Categorias">
            <span className="category-nav-title">Categorias</span>
            {sections.map((section) => <button type="button" key={section.id} onClick={() => scrollToSection(section.id)}><span>{section.name}</span></button>)}
            <button className="editor-add-category" type="button" onClick={props.onAddCategory}><Plus size={14} /> <span>Nova categoria</span></button>
          </nav>
          {props.products.length > 6 ? (
            <label className="editor-search"><Search size={16} /><span className="sr-only">Buscar produto</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto pelo nome" /></label>
          ) : null}
          {normalizedQuery && !products.length ? <p className="admin-muted">Nenhum produto com “{query.trim()}”.</p> : null}

          {!props.products.length ? (
            <div className="editor-empty">
              <Package size={30} />
              <h2>Sua loja ainda não tem produtos</h2>
              <p>Adicione o primeiro produto aqui ou traga todos de uma vez pela planilha do Excel.</p>
              <button className="admin-primary" type="button" onClick={() => props.onAddProduct()}><Plus size={16} /> Adicionar o primeiro produto</button>
            </div>
          ) : null}

          <div className="catalog-category-list">
            {sections.map((section) => (
              <section className="catalog-category-section" id={`editor-section-${section.id}`} key={section.id}>
                <header className="catalog-category-heading">
                  <h2>{section.name}</h2>
                  <span>
                    {section.products.length} {section.products.length === 1 ? "item" : "itens"}
                    {section.id !== UNCATEGORIZED && !section.products.length ? <button className="editor-text-button" type="button" onClick={() => props.onDeleteCategory(section.id)}>Excluir categoria</button> : null}
                  </span>
                </header>
                <div className={`product-grid ${props.catalogLayout}`}>
                  {section.products.map((product) => (
                    <EditorProductCard
                      key={product.id}
                      product={product}
                      imageLimit={props.imageLimit}
                      busy={props.busyProductId === product.id}
                      onEdit={() => props.onEditProduct(product.id)}
                      onDelete={() => props.onDeleteProduct(product.id)}
                      onToggle={() => props.onToggleProduct(product.id)}
                      onAddPhoto={() => props.onAddPhoto(product.id)}
                      onQuickUpdate={(patch) => props.onQuickUpdate(product.id, patch)}
                    />
                  ))}
                  <button className="editor-add-product" type="button" onClick={() => props.onAddProduct(section.id === UNCATEGORIZED ? undefined : section.id)}>
                    <Plus size={18} /> Adicionar produto{section.id === UNCATEGORIZED ? "" : ` em ${section.name}`}
                  </button>
                </div>
              </section>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
