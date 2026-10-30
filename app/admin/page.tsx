"use client";

import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  ImagePlus,
  Images,
  KeyRound,
  LayoutDashboard,
  Link2,
  LocateFixed,
  LogOut,
  MapPin,
  MessageSquareText,
  Package,
  Palette,
  Pencil,
  Inbox,
  Plus,
  Power,
  Printer,
  RefreshCw,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Store,
  Trash2,
  TriangleAlert,
  Truck,
  Upload,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import type { DataValidation, Worksheet } from "exceljs";
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { LiistBrand } from "../../components/liist-brand";
import { companyCreationBody, EMPTY_COMPANY_FIELDS, validateAccount, validateCompanyRequest, type AccountFields, type CompanyRequestErrors, type CompanyRequestFields } from "../../lib/company-signup";
import { DOCUMENT_PLACEHOLDER, detectDocumentKind, documentMaxLength, formatDocument, isValidDocument, type DocumentKind } from "../../lib/branch-document";
import { BRANCH_DOCUMENT_STORAGE_KEY } from "../../lib/access-destinations";
import { defaultRoute, defaultSettingsTab, parsePortalPath, portalPath, settingsTabs, type PortalRoute, type PortalSection, type SettingsTab } from "../../lib/portal-route";
import { fetchStoreDocuments, STORE_READABLE_COLUMNS, withStoreDocuments } from "../../lib/store-documents";
import { supabase } from "../../lib/supabase";
import {
  CompanyOperations,
  type CompanyPortalSection,
} from "./company-operations";
import { PortalHeader, PortalSidebar, PortalTabs, sectionLabel } from "./portal-shell";
import { StoreEditor, type EditorProduct, type QuickProductPatch } from "./store-editor";
import { NewCompanyForm } from "./new-company-form";
import { CompanyRequests, CompanyStatusControl, CompanySuspendedNotice, TrialBanner, useCompanyStatuses, useMyCompanyStatus, type CompanyStatusRow } from "./company-monitoring";

const publicEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const publicSupabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publicSupabaseAnonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type Tenant = { id: string; name: string; slug: string; is_active?: boolean; theme_color?: string; profile_image_url?: string | null };
type Branch = {
  id: string;
  name: string;
  slug: string;
  cnpj?: string | null;
  tenant_id: string;
  whatsapp_phone?: string | null;
  address?: string | null;
  cover_image_url?: string | null;
  cover_note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  minimum_order?: number | null;
  delivery_fee?: number | null;
  delivery_time_label?: string | null;
  is_active?: boolean;
};
type ProductImage = { id: string; image_url: string; sort_order: number };
type ProductOptionItem = { id: string; name: string; price_delta: number; sort_order: number; is_active: boolean };
type ProductOptionGroup = {
  id: string;
  name: string;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  is_active: boolean;
  option_group_items?: ProductOptionItem[];
  product_option_groups?: Array<{ product_id: string; sort_order: number }>;
};
type Category = { id: string; name: string; sort_order: number };
type Product = {
  id: string;
  external_id: string | null;
  name: string;
  description: string | null;
  price: number;
  unit: string | null;
  stock_quantity: number | null;
  image_url: string | null;
  badge: string | null;
  category_id: string | null;
  is_active: boolean;
  updated_at: string | null;
  product_images?: ProductImage[];
  option_groups?: ProductOptionGroup[];
};

type CatalogImportRow = {
  rowNumber: number;
  category: string;
  name: string;
  description: string | null;
  price: number;
  unit: string | null;
  stock: number | null;
  badge: string | null;
  sku: string | null;
  isActive: boolean;
};

type CatalogImportCategory = {
  name: string;
  sortOrder: number | null;
};

type CatalogImportOptionRow = {
  rowNumber: number;
  group: string;
  product: string;
  required: boolean;
  max: number;
  option: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
};


type CatalogImportAdditionGroup = {
  name: string;
  required: boolean;
  max: number;
  isActive: boolean;
  sortOrder: number;
};

type MeasurementUnit = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type CatalogImportMeasurementUnit = {
  code: string;
  name: string;
  sortOrder: number | null;
};

type CatalogEditorMode = "product" | "category";
type OptionDraft = { name: string; priceDelta: string };
type FreightParameterMode = "inherit" | "enabled" | "disabled";
type DeliveryFeeType = "fixed" | "per_km";
type BranchDeliveryFeeTypeMode = "inherit" | DeliveryFeeType;
type StockControlMode = "inherit" | "enabled" | "disabled";
type AdditionsMode = "inherit" | "enabled" | "disabled";
type CompactInternalCatalogMode = "inherit" | "enabled" | "disabled";
type CatalogLayout = "horizontal" | "showcase";
type BranchCatalogLayoutMode = "inherit" | CatalogLayout;
type ProductImageLimitMode = "inherit" | number;
type OrderMode = "whatsapp" | "internal" | "both";
type BranchOrderMode = "inherit" | OrderMode;
type PrintMode = "disabled" | "manual" | "automatic" | "manual_and_automatic";
type BranchPrintMode = "inherit" | PrintMode;
type BusinessHoursDay = { weekday: number; isOpen: boolean; opensAt: string; closesAt: string };
type BusinessHoursConfig = { days: BusinessHoursDay[] };
type CompanySettingsSection = "overview" | "identity" | "access" | "parameters" | "danger";
type IdentityFeedback = { status: "saving" | "success" | "error"; message: string };
type AdminCompanyIdentityRow = {
  tenant_id: string;
  is_active: boolean;
  theme_color: string | null;
  profile_image_url: string | null;
};
type OrderedWorksheet = Worksheet & { orderNo: number };
type ParameterScope = "company" | "branch";
type BranchLocationTarget = "branch" | "existing";
type LocationIssue = { target: BranchLocationTarget; message: string };
type BranchLocationValue = { address: string; latitude: string; longitude: string };
type OpenStreetMapPlace = { display_name?: string; lat?: string; lon?: string };
type BranchDetailsForm = {
  name: string;
  cnpj: string;
  phone: string;
  coverNote: string;
  isActive: boolean;
};
type PortalMode = "admin" | "company" | "branch";
const SETTINGS_SECTION_BY_TAB: Partial<Record<SettingsTab, CompanySettingsSection>> = { resumo: "overview", aparencia: "identity", pedidos: "parameters", senha: "access", excluir: "danger" };

function settingsTabLabel(tab: SettingsTab, mode: PortalMode) {
  const labels: Record<SettingsTab, string> = {
    resumo: "Resumo",
    dados: mode === "admin" ? "Dados da filial" : "Dados da loja",
    filiais: "Filiais",
    aparencia: "Logo e cores",
    pedidos: "Pedidos e entrega",
    mesas: "Mesas e QR Code",
    equipe: "Equipe",
    senha: mode === "admin" ? "Acesso do dono" : "Senha",
    excluir: "Excluir empresa",
  };
  return labels[tab];
}

const FREIGHT_PARAMETER_KEY = "calculate_delivery_fee";
const DELIVERY_FEE_TYPE_PARAMETER_KEY = "delivery_fee_type";
const CATALOG_LAYOUT_PARAMETER_KEY = "catalog_layout";
const PRODUCT_IMAGE_LIMIT_PARAMETER_KEY = "product_image_limit";
const STOCK_CONTROL_PARAMETER_KEY = "control_stock";
const ADDITIONS_PARAMETER_KEY = "enable_additions";
const ORDER_MODE_PARAMETER_KEY = "order_mode";
const INTERNAL_CATALOG_COMPACT_PARAMETER_KEY = "compact_internal_catalog";
const PRINT_MODE_PARAMETER_KEY = "internal_print_mode";
const BUSINESS_HOURS_PARAMETER_KEY = "business_hours";
const PRODUCT_IMAGE_LIMIT_MIN = 1;
const PRODUCT_IMAGE_LIMIT_MAX = 10;
const COVER_NOTE_MAX_LENGTH = 160;
// Sem cnpj: o documento vem por fetchStoreDocuments (migration 032).
const BRANCH_DETAIL_SELECT = STORE_READABLE_COLUMNS;
const addressLocationCache = new Map<string, BranchLocationValue>();
const coordinateAddressCache = new Map<string, string>();

const EMPTY_PRODUCT_FORM = {
  name: "",
  description: "",
  price: "",
  unit: "unidade",
  stock: "",
  badge: "",
  categoryId: "",
};

const CATALOG_IMAGE_BUCKET = "catalog-images";
const CATALOG_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const CATALOG_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const IMPORT_HEADERS = ["Categoria", "Produto", "Status", "Descrição", "Preço", "Unidade", "Estoque", "Selo", "Código/SKU"] as const;
type ImportHeader = (typeof IMPORT_HEADERS)[number];
const REQUIRED_IMPORT_HEADERS = ["Categoria", "Produto", "Preço"] as const;
const PRODUCT_STATUS_OPTIONS = ["Ativo", "Desativado"] as const;
const EXCEL_CATEGORY_TABLE_NAME = "CatalogCategories";
const EXCEL_ADDITION_GROUP_TABLE_NAME = "CatalogAdditionGroups";
const EXCEL_MEASUREMENT_UNIT_TABLE_NAME = "CatalogMeasurementUnits";
const BUSINESS_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const BUSINESS_WEEKDAYS = [
  { value: 1, short: "Seg", label: "Segunda-feira" },
  { value: 2, short: "Ter", label: "Terça-feira" },
  { value: 3, short: "Qua", label: "Quarta-feira" },
  { value: 4, short: "Qui", label: "Quinta-feira" },
  { value: 5, short: "Sex", label: "Sexta-feira" },
  { value: 6, short: "Sáb", label: "Sábado" },
  { value: 0, short: "Dom", label: "Domingo" },
];

type WorksheetWithRangeValidation = Worksheet & {
  dataValidations: {
    add: (address: string, validation: DataValidation) => void;
  };
};

function addExcelRangeValidation(worksheet: Worksheet, address: string, validation: DataValidation) {
  (worksheet as WorksheetWithRangeValidation).dataValidations.add(address, validation);
}

const adminProductUpdatedAtFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function formatAdminProductUpdatedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : adminProductUpdatedAtFormatter.format(date);
}
const CATEGORY_IMPORT_HEADERS = ["Categoria", "Ordem"] as const;
const MEASUREMENT_UNIT_IMPORT_HEADERS = ["Código", "Nome"] as const;
const ADDITION_GROUP_HEADERS = ["Grupo", "Obrigat\u00f3rio", "M\u00e1ximo", "Status", "Ordem"] as const;
const ADDITION_IMPORT_HEADERS = ["Grupo", "Produto", "Adicional", "Acr\u00e9scimo", "Status", "Ordem"] as const;
const LEGACY_OPTION_IMPORT_HEADERS = ["Grupo", "Produto", "Obrigat\u00f3rio", "M\u00e1ximo", "Opcional", "Acr\u00e9scimo", "Status", "Ordem"] as const;
const OPTION_IMPORT_HEADERS = ADDITION_IMPORT_HEADERS;
const OPTION_STATUS_OPTIONS = ["Ativo", "Desativado"] as const;
const IMPORT_COLUMN_WIDTHS: Record<ImportHeader, number> = {
  Categoria: 24,
  Produto: 32,
  Status: 16,
  Descrição: 48,
  Preço: 14,
  Unidade: 16,
  Estoque: 14,
  Selo: 20,
  "Código/SKU": 20,
};

function catalogImportHeaders(controlsStock: boolean): ImportHeader[] {
  return controlsStock ? [...IMPORT_HEADERS] : IMPORT_HEADERS.filter((header) => header !== "Estoque");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function productStatusValue(value: unknown): boolean | null {
  const status = normalizeText(excelValueToText(value));
  if (!status || status === "ativo") return true;
  if (status === "desativado" || status === "inativo") return false;
  return null;
}

function excelValueToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.result !== undefined) return excelValueToText(record.result);
    if (record.text !== undefined) return excelValueToText(record.text);
    if (Array.isArray(record.richText)) {
      return record.richText
        .map((part) => typeof part === "object" && part !== null && "text" in part ? String((part as { text: unknown }).text) : "")
        .join("")
        .trim();
    }
  }
  return String(value).trim();
}

function parseBrazilianNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const text = excelValueToText(value).replace(/R\$/gi, "").replace(/\s/g, "");
  if (!text) return Number.NaN;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return Number(normalized);
}

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function moneyInputNumber(value: string) {
  const parsed = parseBrazilianNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function supabaseErrorMessage(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  return error instanceof Error
    ? error.message
    : String(record?.message ?? record?.details ?? record?.hint ?? "");
}

function isMeasurementUnitsUnavailable(error: unknown) {
  const message = supabaseErrorMessage(error);
  return /measurement_units/i.test(message) && /PGRST205|relation .* does not exist|schema cache/i.test(message);
}

function readableMeasurementUnitError(error: unknown) {
  const message = supabaseErrorMessage(error);
  if (isMeasurementUnitsUnavailable(error)) {
    return "As unidades de medida ainda não estão habilitadas no banco. Execute a migration 016_measurement_units.sql no SQL Editor do Supabase e tente novamente.";
  }
  if (/23505|duplicate key|measurement_units_tenant_id_(code|name)_key/i.test(message)) {
    return "Já existe uma unidade com esse código ou nome.";
  }
  if (/42501|row-level security/i.test(message)) {
    return "Este acesso não tem permissão para alterar as unidades de medida desta empresa.";
  }
  if (/23503|vinculada a produtos|linked measurement unit/i.test(message)) {
    return "Esta unidade está vinculada a produtos e não pode ser excluída.";
  }
  return message || "Não foi possível cadastrar a unidade de medida.";
}

function readableCatalogError(error: unknown) {
  const message = supabaseErrorMessage(error);
  if (isMeasurementUnitsUnavailable(error)) return readableMeasurementUnitError(error);
  if (/option_groups|option_group_items|product_option_groups|relation .* does not exist|schema cache/i.test(message)) {
    return `${message || "As tabelas de adicionais ainda não estão disponíveis."} Execute a migration 015_product_option_groups.sql no SQL Editor do Supabase e tente novamente.`;
  }
  return message || "Não foi possível importar a planilha. Verifique os dados e tente novamente.";
}

function chunkRows<T>(rows: T[], size = 200) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

function validateCatalogImage(file: File) {
  if (!CATALOG_IMAGE_EXTENSIONS[file.type]) return "Escolha uma imagem JPG, PNG ou WebP.";
  if (file.size > CATALOG_IMAGE_MAX_SIZE) return "A imagem deve ter no máximo 5 MB.";
  return "";
}

function storagePathFromPublicUrl(url?: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${CATALOG_IMAGE_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  return markerIndex >= 0 ? decodeURIComponent(url.slice(markerIndex + marker.length)) : null;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function powershellSingleQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function base64Utf16Le(value: string) {
  let binary = "";
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    binary += String.fromCharCode(code & 0xff, code >> 8);
  }
  return btoa(binary);
}

function cmdSafeLabel(value: string) {
  return value.replace(/[\r\n&<>|^%!"]/g, " ").replace(/\s+/g, " ").trim();
}

function printAgentInstallerScript({
  supabaseUrl,
  anonKey,
  token,
  companyName,
  branchName,
}: {
  supabaseUrl: string;
  anonKey: string;
  token: string;
  companyName: string;
  branchName: string;
}) {
  const taskSuffix = slugify(`${companyName}-${branchName}`) || "filial";
  const safeCompany = powershellSingleQuote(companyName);
  const safeBranch = powershellSingleQuote(branchName);
  const safeSupabaseUrl = powershellSingleQuote(supabaseUrl);
  const safeAnonKey = powershellSingleQuote(anonKey);
  const safeToken = powershellSingleQuote(token);
  const cmdCompanyName = cmdSafeLabel(companyName) || "LIIST";
  const cmdBranchName = cmdSafeLabel(branchName) || "Filial";
  const installerUrl = "https://raw.githubusercontent.com/luidymarcelo/LIIST/main/agents/liist-print-agent/windows-install.ps1";
  const installerScriptPath = `$env:TEMP\\liist-print-agent-install-${taskSuffix}.ps1`;
  const logPath = `$([Environment]::GetFolderPath("Desktop"))\\liist-print-agent-install-${taskSuffix}.log`;
  const bootstrapScript = `$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$InstallerUrl = ${powershellSingleQuote(installerUrl)}
$InstallerPath = "${installerScriptPath}"
$InstallLog = "${logPath}"
Start-Transcript -Path $InstallLog -Append | Out-Null
try {
  $CompanyName = ${safeCompany}
  $BranchName = ${safeBranch}
  Write-Host ""
  Write-Host "Instalador LIIST Print Agent" -ForegroundColor Cyan
  Write-Host "Empresa: $CompanyName"
  Write-Host "Filial: $BranchName"
  Write-Host ""
  Write-Host "Baixando instalador oficial..."
  Invoke-WebRequest -Uri $InstallerUrl -OutFile $InstallerPath -UseBasicParsing
  Unblock-File -Path $InstallerPath -ErrorAction SilentlyContinue
  & $InstallerPath -SupabaseUrl ${safeSupabaseUrl} -SupabaseAnonKey ${safeAnonKey} -AgentToken ${safeToken} -CompanyName ${safeCompany} -BranchName ${safeBranch} -TaskSuffix ${powershellSingleQuote(taskSuffix)}
} catch {
  Write-Host ""
  Write-Host "Falha ao instalar o LIIST Print Agent:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
  try { Stop-Transcript | Out-Null } catch {}
  Write-Host ""
  Write-Host "Log da instalacao: $InstallLog"
  Write-Host ""
  Read-Host "Pressione Enter para fechar"
}`;
  const encodedCommand = base64Utf16Le(bootstrapScript);
  return `@echo off
setlocal EnableExtensions
title Instalador LIIST Print Agent - ${cmdBranchName}
echo.
echo Instalador LIIST Print Agent
echo Empresa: ${cmdCompanyName}
echo Filial: ${cmdBranchName}
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -EncodedCommand ${encodedCommand}
`;
}

function validCoordinate(value: string, min: number, max: number) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

async function openStreetMapJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("geocoding_unavailable");
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function findAddressOnOpenStreetMap(address: string): Promise<BranchLocationValue> {
  const cacheKey = address.trim().toLocaleLowerCase("pt-BR");
  const cachedLocation = addressLocationCache.get(cacheKey);
  if (cachedLocation) return cachedLocation;
  const params = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
    addressdetails: "1",
    "accept-language": "pt-BR",
  });
  const [place] = await openStreetMapJson<OpenStreetMapPlace[]>(`https://nominatim.openstreetmap.org/search?${params}`);
  const latitude = place?.lat ? validCoordinate(place.lat, -90, 90) : null;
  const longitude = place?.lon ? validCoordinate(place.lon, -180, 180) : null;
  if (!place?.display_name || latitude === null || longitude === null) throw new Error("address_not_found");
  const location = { address: address.trim(), latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) };
  addressLocationCache.set(cacheKey, location);
  return location;
}

async function findAddressFromCoordinates(latitude: number, longitude: number) {
  const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const cachedAddress = coordinateAddressCache.get(cacheKey);
  if (cachedAddress) return cachedAddress;
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    zoom: "18",
    addressdetails: "1",
    "accept-language": "pt-BR",
  });
  const place = await openStreetMapJson<OpenStreetMapPlace>(`https://nominatim.openstreetmap.org/reverse?${params}`);
  const address = place.display_name?.trim() ?? "";
  if (address) coordinateAddressCache.set(cacheKey, address);
  return address;
}

function parameterBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function deliveryFeeTypeValue(value: unknown, fallback: DeliveryFeeType = "fixed"): DeliveryFeeType {
  return value === "fixed" || value === "per_km" ? value : fallback;
}

function catalogLayoutValue(value: unknown, fallback: CatalogLayout = "horizontal"): CatalogLayout {
  return value === "horizontal" || value === "showcase" ? value : fallback;
}

function orderModeValue(value: unknown, fallback: OrderMode = "whatsapp"): OrderMode {
  return value === "whatsapp" || value === "internal" || value === "both" ? value : fallback;
}

function orderModeLabel(mode: OrderMode) {
  if (mode === "internal") return "Comanda";
  if (mode === "both") return "Ambos";
  return "WhatsApp";
}

function printModeValue(value: unknown, fallback: PrintMode = "disabled"): PrintMode {
  return value === "manual" || value === "automatic" || value === "manual_and_automatic" || value === "disabled"
    ? value
    : fallback;
}

function printModeLabel(mode: PrintMode) {
  if (mode === "manual") return "Manual";
  if (mode === "automatic") return "Automática";
  if (mode === "manual_and_automatic") return "Manual + automática";
  return "Desativada";
}

function businessTimeValue(value: unknown, fallback: string) {
  return typeof value === "string" && BUSINESS_TIME_PATTERN.test(value) ? value : fallback;
}

function createDefaultBusinessHours(): BusinessHoursConfig {
  return {
    days: BUSINESS_WEEKDAYS.map((day) => ({
      weekday: day.value,
      isOpen: day.value >= 1 && day.value <= 5,
      opensAt: "08:00",
      closesAt: "18:00",
    })),
  };
}

function businessHoursValue(value: unknown, fallback = createDefaultBusinessHours()): BusinessHoursConfig {
  if (!value || typeof value !== "object") return fallback;
  const source = value as { days?: unknown };
  if (!Array.isArray(source.days)) return fallback;

  const parsedDays = new Map<number, BusinessHoursDay>();
  for (const item of source.days) {
    if (!item || typeof item !== "object") continue;
    const day = item as Partial<BusinessHoursDay>;
    const weekday = Number(day.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    parsedDays.set(weekday, {
      weekday,
      isOpen: Boolean(day.isOpen),
      opensAt: businessTimeValue(day.opensAt, "08:00"),
      closesAt: businessTimeValue(day.closesAt, "18:00"),
    });
  }

  if (!parsedDays.size) return fallback;
  return {
    days: BUSINESS_WEEKDAYS.map((day) => parsedDays.get(day.value) ?? {
      weekday: day.value,
      isOpen: false,
      opensAt: "08:00",
      closesAt: "18:00",
    }),
  };
}

function updateBusinessHoursDay(config: BusinessHoursConfig, weekday: number, patch: Partial<BusinessHoursDay>): BusinessHoursConfig {
  return {
    days: businessHoursValue(config).days.map((day) => (
      day.weekday === weekday ? { ...day, ...patch, weekday } : day
    )),
  };
}

function businessHoursSummary(config: BusinessHoursConfig) {
  const openDays = businessHoursValue(config).days.filter((day) => day.isOpen);
  if (!openDays.length) return "Fechado";
  if (openDays.length === 7) return "Todos os dias";
  return `${openDays.length} dias ativos`;
}

function productImageLimitValue(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed)
    ? Math.min(PRODUCT_IMAGE_LIMIT_MAX, Math.max(PRODUCT_IMAGE_LIMIT_MIN, parsed))
    : fallback;
}

function companyThemeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#111513";
}

function requestBrowserLocation(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "Não foi possível acessar a localização. Ative a localização do aparelho, confirme a permissão deste site no navegador e tente novamente.";
  if (error.code === error.POSITION_UNAVAILABLE) return "O dispositivo não informou a posição. Ative a localização do aparelho e tente novamente.";
  if (error.code === error.TIMEOUT) return "A localização demorou para responder. Verifique o GPS ou Wi-Fi e tente novamente.";
  return "Não foi possível obter a localização da filial.";
}

function AdminPage({ portalMode = "admin" }: { portalMode?: PortalMode }) {
  const isCompanyPortal = portalMode === "company";
  const isBranchPortal = portalMode === "branch";
  const isBusinessPortal = isCompanyPortal || isBranchPortal;
  const [session, setSession] = useState<Session | null>(null);
  const authorizedWorkspaceKeyRef = useRef("");
  const authorizingWorkspaceKeyRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [adminTenants, setAdminTenants] = useState<Tenant[]>([]);
  const [adminBranches, setAdminBranches] = useState<Branch[]>([]);
  // A URL é a fonte da seção aberta: voltar/avançar do navegador e links diretos funcionam em todos os painéis.
  const [route, setRoute] = useState<PortalRoute>(() => typeof window === "undefined" ? defaultRoute(portalMode) : parsePortalPath(portalMode, window.location.pathname));
  const routePath = portalPath(portalMode, route);
  const routeSection = route.view === "section" ? route.section : null;
  const activeSettingsTab: SettingsTab = route.view === "section" && route.section === "configuracoes" ? route.tab ?? defaultSettingsTab(portalMode) : defaultSettingsTab(portalMode);
  const companySettingsSection: CompanySettingsSection = SETTINGS_SECTION_BY_TAB[activeSettingsTab] ?? "overview";
  // Só estas abas dependem dos parâmetros completos da empresa (a senha do dono só pelo admin).
  const routeNeedsSettings = routeSection === "configuracoes" && (["resumo", "aparencia", "pedidos"].includes(activeSettingsTab) || (activeSettingsTab === "senha" && portalMode === "admin"));
  const settingsRequestRef = useRef("");
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const [savingCompanyLogo, setSavingCompanyLogo] = useState(false);
  const adminListLoadedRef = useRef(false);
  const [settingsLoadedTenantId, setSettingsLoadedTenantId] = useState("");
  const [additionGroupName, setAdditionGroupName] = useState("");
  const [additionGroupRequired, setAdditionGroupRequired] = useState(false);
  const [additionGroupMax, setAdditionGroupMax] = useState("1");
  const [savingAdditionGroup, setSavingAdditionGroup] = useState(false);
  const [measurementUnits, setMeasurementUnits] = useState<MeasurementUnit[]>([]);
  const [measurementUnitCode, setMeasurementUnitCode] = useState("");
  const [measurementUnitName, setMeasurementUnitName] = useState("");
  const [measurementUnitQuery, setMeasurementUnitQuery] = useState("");
  const [showMeasurementUnitForm, setShowMeasurementUnitForm] = useState(false);
  const [savingMeasurementUnit, setSavingMeasurementUnit] = useState(false);
  const [deletingMeasurementUnitId, setDeletingMeasurementUnitId] = useState("");
  const [measurementUnitUsage, setMeasurementUnitUsage] = useState<Record<string, number>>({});
  const [measurementUnitUsageReady, setMeasurementUnitUsageReady] = useState(false);
  const [parameterScope, setParameterScope] = useState<ParameterScope>("company");
  const [activeBranchId, setActiveBranchId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>([]);
  const [message, setMessage] = useState("");
  const [newCompanyFields, setNewCompanyFields] = useState<CompanyRequestFields>(EMPTY_COMPANY_FIELDS);
  const [newCompanyErrors, setNewCompanyErrors] = useState<CompanyRequestErrors>({});
  const [newCompanyAccount, setNewCompanyAccount] = useState<AccountFields>({ email: "", password: "" });
  const [newCompanyTrialDays, setNewCompanyTrialDays] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", cnpj: "", phone: "", address: "", latitude: "", longitude: "", coverNote: "" });
  const [branchLocationForm, setBranchLocationForm] = useState<BranchLocationValue>({ address: "", latitude: "", longitude: "" });
  const [branchDetailsForm, setBranchDetailsForm] = useState<BranchDetailsForm>({ name: "", cnpj: "", phone: "", coverNote: "", isActive: true });
  const [locatingBranchForm, setLocatingBranchForm] = useState<BranchLocationTarget | "">("");
  const [validatingBranchAddress, setValidatingBranchAddress] = useState<BranchLocationTarget | "">("");
  const [locationIssue, setLocationIssue] = useState<LocationIssue | null>(null);
  const [savingBranchDetails, setSavingBranchDetails] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [accessForm, setAccessForm] = useState({ name: "", email: "", password: "" });
  const [companyIdentity, setCompanyIdentity] = useState({ isActive: true, themeColor: "#111513", profileImageUrl: "" });
  const [companyProfileFile, setCompanyProfileFile] = useState<File | null>(null);
  const [companyProfilePreview, setCompanyProfilePreview] = useState("");
  const [savingCompanyIdentity, setSavingCompanyIdentity] = useState(false);
  const [companyIdentityFeedback, setCompanyIdentityFeedback] = useState<IdentityFeedback | null>(null);
  const [savingAvailability, setSavingAvailability] = useState("");
  const companyProfileInputRef = useRef<HTMLInputElement>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [companyCalculatesDeliveryFee, setCompanyCalculatesDeliveryFee] = useState(true);
  const [branchFreightModes, setBranchFreightModes] = useState<Record<string, FreightParameterMode>>({});
  const [companyDeliveryFeeType, setCompanyDeliveryFeeType] = useState<DeliveryFeeType>("fixed");
  const [branchDeliveryFeeTypeModes, setBranchDeliveryFeeTypeModes] = useState<Record<string, BranchDeliveryFeeTypeMode>>({});
  const [branchDeliveryFees, setBranchDeliveryFees] = useState<Record<string, string>>({});
  const [companyCatalogLayout, setCompanyCatalogLayout] = useState<CatalogLayout>("horizontal");
  const [branchCatalogLayouts, setBranchCatalogLayouts] = useState<Record<string, BranchCatalogLayoutMode>>({});
  const [companyProductImageLimit, setCompanyProductImageLimit] = useState(1);
  const [branchProductImageLimits, setBranchProductImageLimits] = useState<Record<string, ProductImageLimitMode>>({});
  const [activeProductImageLimit, setActiveProductImageLimit] = useState(1);
  const [activeCatalogLayout, setActiveCatalogLayout] = useState<CatalogLayout>("horizontal");
  const [companyControlsStock, setCompanyControlsStock] = useState(true);
  const [branchStockControlModes, setBranchStockControlModes] = useState<Record<string, StockControlMode>>({});
  const [companyEnablesAdditions, setCompanyEnablesAdditions] = useState(false);
  const [branchAdditionsModes, setBranchAdditionsModes] = useState<Record<string, AdditionsMode>>({});
  const [companyOrderMode, setCompanyOrderMode] = useState<OrderMode>("whatsapp");
  const [branchOrderModes, setBranchOrderModes] = useState<Record<string, BranchOrderMode>>({});
  const [companyCompactInternalCatalog, setCompanyCompactInternalCatalog] = useState(true);
  const [branchCompactInternalCatalogModes, setBranchCompactInternalCatalogModes] = useState<Record<string, CompactInternalCatalogMode>>({});
  const [companyPrintMode, setCompanyPrintMode] = useState<PrintMode>("disabled");
  const [branchPrintModes, setBranchPrintModes] = useState<Record<string, BranchPrintMode>>({});
  const [branchBusinessHours, setBranchBusinessHours] = useState<Record<string, BusinessHoursConfig>>({});
  const [generatingPrintInstallerId, setGeneratingPrintInstallerId] = useState("");
  const [activeControlsStock, setActiveControlsStock] = useState(true);
  const [activeEnablesAdditions, setActiveEnablesAdditions] = useState(false);
  const [savingParameters, setSavingParameters] = useState(false);
  const [showDeleteCompany, setShowDeleteCompany] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingCompany, setDeletingCompany] = useState(false);
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [exportingCatalog, setExportingCatalog] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [additionGroupQuery, setAdditionGroupQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [showOptionGroupForm, setShowOptionGroupForm] = useState(false);
  const [savingOptionGroup, setSavingOptionGroup] = useState(false);
  const [deletingOptionGroupId, setDeletingOptionGroupId] = useState("");
  const [optionGroupForm, setOptionGroupForm] = useState({ name: "", min: "0", max: "1", productIds: [] as string[] });
  const [optionDrafts, setOptionDrafts] = useState<OptionDraft[]>([]);
  const [optionDraftForm, setOptionDraftForm] = useState<OptionDraft>({ name: "", priceDelta: "0,00" });
  const [productImageFiles, setProductImageFiles] = useState<File[]>([]);
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);
  const [savingProduct, setSavingProduct] = useState(false);
  const [catalogEditorMode, setCatalogEditorMode] = useState<CatalogEditorMode | null>(null);
  const [editingProductId, setEditingProductId] = useState("");
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const quickProductImageInputRef = useRef<HTMLInputElement>(null);
  const quickProductImageTargetRef = useRef("");
  const [uploadingProductImageId, setUploadingProductImageId] = useState("");
  const [updatingProductStatusId, setUpdatingProductStatusId] = useState("");
  const [deletingProductId, setDeletingProductId] = useState("");
  const [deletingCategoryId, setDeletingCategoryId] = useState("");
  const [productForm, setProductForm] = useState({ ...EMPTY_PRODUCT_FORM });
  const [accessDenied, setAccessDenied] = useState(false);
  const { statuses: companyStatuses, reload: reloadCompanyStatuses } = useCompanyStatuses(portalMode === "admin" && Boolean(session));
  const myCompanyStatus = useMyCompanyStatus(tenant?.id, isBusinessPortal && Boolean(session));

  function navigate(next: PortalRoute, options: { replace?: boolean } = {}) {
    setRoute(next);
    const nextPath = portalPath(portalMode, next);
    if (nextPath === (window.location.pathname.replace(/\/+$/, "") || "/")) return;
    if (options.replace) window.history.replaceState(null, "", nextPath);
    else window.history.pushState(null, "", nextPath);
    window.scrollTo({ top: 0 });
  }

  function goTo(next: PortalRoute) {
    setMessage("");
    navigate(next);
  }

  useEffect(() => {
    const syncFromAddress = () => {
      setMessage("");
      setRoute(parsePortalPath(portalMode, window.location.pathname));
    };
    window.addEventListener("popstate", syncFromAddress);
    return () => window.removeEventListener("popstate", syncFromAddress);
  }, [portalMode]);

  useEffect(() => {
    if (!supabase || !tenant?.id || tenant.profile_image_url !== undefined) return;
    let active = true;
    const tenantId = tenant.id;
    void (async () => {
      const client = supabase!;
      const { data, error } = await client.from("tenants").select("theme_color, profile_image_url").eq("id", tenantId).maybeSingle();
      let identity: { theme_color?: string | null; profile_image_url?: string | null } | null = error ? null : data;
      if (!identity) {
        const { data: publicCompanies } = await client.rpc("get_public_catalog_companies");
        identity = ((publicCompanies ?? []) as Array<{ tenant_id: string; theme_color: string | null; profile_image_url: string | null }>).find((row) => row.tenant_id === tenantId) ?? null;
      }
      if (!active || !identity) return;
      const loaded = identity;
      setTenant((current) => current && current.id === tenantId ? { ...current, theme_color: loaded.theme_color ?? current.theme_color, profile_image_url: loaded.profile_image_url ?? null } : current);
    })();
    return () => { active = false; };
  }, [tenant?.id, tenant?.profile_image_url]);

  // Formulários em janela não ficam abertos por cima de outra seção depois de navegar.
  useEffect(() => {
    setCatalogEditorMode(null);
    setShowOptionGroupForm(false);
  }, [routePath]);

  // Carrega os dados que a seção do endereço precisa (empresa do admin, ajustes da empresa).
  useEffect(() => {
    if (loading || !session) return;
    if (portalMode === "admin") {
      if (route.view !== "section") {
        settingsRequestRef.current = "";
        if (tenant) {
          setTenant(null);
          setBranches([]);
          setActiveBranchId("");
          setSettingsLoadedTenantId("");
        }
        return;
      }
      const routeTenantId = route.tenantId ?? "";
      if (!adminListLoadedRef.current) return;
      if (!adminTenants.some((item) => item.id === routeTenantId)) {
        navigate({ view: "companies" }, { replace: true });
        return;
      }
      if (routeNeedsSettings) {
        if (settingsLoadedTenantId !== routeTenantId && settingsRequestRef.current !== routeTenantId) {
          settingsRequestRef.current = routeTenantId;
          void openCompanySettings(routeTenantId);
        }
        return;
      }
      if (tenant?.id !== routeTenantId) selectAdminTenant(routeTenantId);
      return;
    }
    if (isCompanyPortal && routeNeedsSettings && tenant && settingsLoadedTenantId !== tenant.id && settingsRequestRef.current !== tenant.id) {
      settingsRequestRef.current = tenant.id;
      void openCompanySettings(tenant.id);
    }
  }, [routePath, loading, session, adminTenants, tenant?.id, settingsLoadedTenantId]);

  function resetProductEditor() {
    setEditingProductId("");
    setProductForm({ ...EMPTY_PRODUCT_FORM });
    setProductImageFiles([]);
    setProductImagePreviews([]);
    if (productImageInputRef.current) productImageInputRef.current.value = "";
  }

  function closeCatalogEditor() {
    setCatalogEditorMode(null);
    setCategoryName("");
    resetProductEditor();
  }

  function openNewProductEditor(categoryId = "") {
    setCategoryName("");
    resetProductEditor();
    setProductForm({ ...EMPTY_PRODUCT_FORM, categoryId });
    setCatalogEditorMode("product");
  }

  function openCategoryEditor() {
    resetProductEditor();
    setCatalogEditorMode("category");
  }

  function openMeasurementUnitEditor() {
    setMeasurementUnitCode("");
    setMeasurementUnitName("");
    setShowMeasurementUnitForm(true);
    setMessage("");
  }

  function closeMeasurementUnitEditor() {
    setShowMeasurementUnitForm(false);
    setMeasurementUnitCode("");
    setMeasurementUnitName("");
  }

  function editProduct(product: Product) {
    const registeredUnit = measurementUnits.find((unit) => [unit.code, unit.name].some((alias) => normalizeText(alias) === normalizeText(product.unit ?? "")));
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      description: product.description ?? "",
      price: Number(product.price).toFixed(2).replace(".", ","),
      unit: registeredUnit?.name ?? product.unit ?? "",
      stock: product.stock_quantity === null ? "" : String(product.stock_quantity).replace(".", ","),
      badge: product.badge ?? "",
      categoryId: product.category_id ?? "",
    });
    setProductImageFiles([]);
    setProductImagePreviews([]);
    if (productImageInputRef.current) productImageInputRef.current.value = "";
    setCatalogEditorMode("product");
    setMessage("");
  }

  async function hydrateBranchDetails(branchRows: Branch[]) {
    if (!supabase || !branchRows.length) return branchRows;
    const { data, error } = await supabase
      .from("stores")
      .select(BRANCH_DETAIL_SELECT)
      .in("id", branchRows.map((branch) => branch.id));
    if (error || !data?.length) return branchRows;

    const detailsById = new Map(data.map((branch) => [branch.id, branch]));
    return branchRows.map((branch) => ({ ...branch, ...detailsById.get(branch.id) })) as Branch[];
  }

  async function loadWorkspace(userId: string, preferredTenantId?: string) {
    if (!supabase) return;
    if (isBranchPortal) {
      const savedCnpj = window.localStorage.getItem(BRANCH_DOCUMENT_STORAGE_KEY)
        ?? "";
      // Sem filial escolhida, volta para a entrada, que lista as filiais desta conta.
      if (!savedCnpj) {
        window.location.replace("/acesso");
        return;
      }
      const { data: branchWorkspace, error: branchWorkspaceError } = await supabase.rpc("get_branch_workspace", { p_cnpj: savedCnpj });
      if (branchWorkspace?.tenant && branchWorkspace?.branches?.length) {
        const portalBranches = await hydrateBranchDetails(branchWorkspace.branches as Branch[]);
        setTenant(branchWorkspace.tenant as Tenant);
        setBranches(portalBranches);
        setActiveBranchId(portalBranches[0].id);
        setMessage("");
        setLoading(false);
        return;
      }
      setTenant(null);
      setBranches([]);
      setMessage(branchWorkspace?.error ?? branchWorkspaceError?.message ?? "Este login não possui acesso à filial informada.");
      setLoading(false);
      return;
    }
    if (isCompanyPortal) {
      const { data: workspace } = await supabase.functions.invoke("create-store-user", {
        body: { action: "get-company-workspace" },
      });
      if (workspace?.tenant && workspace?.branches?.length) {
        const portalBranches = await hydrateBranchDetails(workspace.branches as Branch[]);
        setTenant(workspace.tenant as Tenant);
        setBranches(portalBranches);
        setActiveBranchId((current) => current && portalBranches.some((branch) => branch.id === current) ? current : portalBranches[0].id);
        setMessage("");
        setLoading(false);
        return;
      }

      const { data: databaseWorkspace } = await supabase.rpc("get_company_workspace");
      if (databaseWorkspace?.tenant && databaseWorkspace?.branches?.length) {
        const portalBranches = await hydrateBranchDetails(databaseWorkspace.branches as Branch[]);
        setTenant(databaseWorkspace.tenant as Tenant);
        setBranches(portalBranches);
        setActiveBranchId((current) => current && portalBranches.some((branch) => branch.id === current) ? current : portalBranches[0].id);
        setMessage("");
        setLoading(false);
        return;
      }

      setTenant(null);
      setBranches([]);
      setMessage(databaseWorkspace?.error ?? workspace?.error ?? "Este login não possui acesso de proprietário.");
      setLoading(false);
      return;
    }
    const [{ data: tenantRows, error: tenantError }, { data: allBranchRows, error: branchError }, identityResult] = await Promise.all([
      supabase.from("tenants").select("id, name, slug").order("created_at", { ascending: true }),
      supabase
        .from("stores")
        .select(BRANCH_DETAIL_SELECT)
        .order("created_at", { ascending: true }),
      supabase.rpc("get_admin_company_identities"),
    ]);

    if (tenantError || branchError) {
      setTenant(null);
      setBranches([]);
      setAdminTenants([]);
      setAdminBranches([]);
      setMessage(tenantError?.message ?? branchError?.message ?? "Não foi possível carregar as empresas.");
      setLoading(false);
      return;
    }

    const identityByTenant = new Map<string, AdminCompanyIdentityRow>(
      ((identityResult.data ?? []) as AdminCompanyIdentityRow[]).map((row) => [row.tenant_id, row]),
    );
    const nextTenants = (tenantRows ?? []).map((row) => {
      const identity = identityByTenant.get(row.id);
      return {
        ...row,
        is_active: identity?.is_active ?? true,
        theme_color: companyThemeColor(identity?.theme_color),
        profile_image_url: identity?.profile_image_url ?? null,
      };
    }) as Tenant[];
    const branchRows = (allBranchRows ?? []) as Branch[];
    const allBranches = withStoreDocuments(branchRows, await fetchStoreDocuments(supabase, branchRows.map((branch) => branch.id)));
    setAdminTenants(nextTenants);
    setAdminBranches(allBranches);
    adminListLoadedRef.current = true;
    const tenantId = preferredTenantId && nextTenants.some((item) => item.id === preferredTenantId)
      ? preferredTenantId
      : "";
    const tenantRow = nextTenants.find((item) => item.id === tenantId) ?? null;
    setTenant(tenantRow);
    const nextBranches = allBranches.filter((branch) => branch.tenant_id === tenantId);
    setBranches(nextBranches);
    setActiveBranchId((current) =>
      current && nextBranches.some((branch) => branch.id === current)
        ? current
        : nextBranches[0]?.id ?? "",
    );
    setLoading(false);
  }

  function workspaceSessionKey(nextSession: Session | null) {
    if (!nextSession) return "";
    const branchCnpj = isBranchPortal
      ? window.localStorage.getItem(BRANCH_DOCUMENT_STORAGE_KEY) ?? ""
      : "";
    return `${portalMode}:${nextSession.user.id}:${branchCnpj}`;
  }

  async function authorizeSession(nextSession: Session | null) {
    if (!supabase) return;
    if (!nextSession) {
      authorizedWorkspaceKeyRef.current = "";
      authorizingWorkspaceKeyRef.current = "";
      setSession(null);
      setSettingsLoadedTenantId("");
      setLoading(false);
      return;
    }

    const nextWorkspaceKey = workspaceSessionKey(nextSession);
    if (authorizedWorkspaceKeyRef.current === nextWorkspaceKey) {
      setAccessDenied(false);
      setSession(nextSession);
      setLoading(false);
      return;
    }
    if (authorizingWorkspaceKeyRef.current === nextWorkspaceKey) {
      setSession(nextSession);
      return;
    }

    authorizingWorkspaceKeyRef.current = nextWorkspaceKey;
    try {
      if (!authorizedWorkspaceKeyRef.current) setLoading(true);
      if (portalMode === "admin") {
        const { data: isAdmin, error } = await supabase.rpc("is_platform_admin");
        if (error || !isAdmin) {
          authorizedWorkspaceKeyRef.current = "";
          authorizingWorkspaceKeyRef.current = "";
          setSession(null);
          setAccessDenied(true);
          setLoading(false);
          await supabase.auth.signOut();
          return;
        }
      }

      setAccessDenied(false);
      setSession(nextSession);
      await loadWorkspace(nextSession.user.id);
      authorizedWorkspaceKeyRef.current = nextWorkspaceKey;
    } finally {
      if (authorizingWorkspaceKeyRef.current === nextWorkspaceKey) {
        authorizingWorkspaceKeyRef.current = "";
      }
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => authorizeSession(data.session));

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "TOKEN_REFRESHED" && nextSession && authorizedWorkspaceKeyRef.current === workspaceSessionKey(nextSession)) {
        setSession(nextSession);
        return;
      }
      window.setTimeout(() => void authorizeSession(nextSession), 0);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const isCatalogWorkspace = isBusinessPortal || routeSection === "loja";
    if (!isCatalogWorkspace || !tenant?.id) return;
    const branchTenantId = branches.find((branch) => branch.id === activeBranchId)?.tenant_id ?? tenant.id;
    void refreshMeasurementUnits(branchTenantId);
  }, [activeBranchId, routeSection, branches, isBusinessPortal, tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) return;
    void refreshMeasurementUnitUsage(tenant.id, measurementUnits);
  }, [branches, measurementUnits, products, tenant?.id]);

  async function refreshBranchCatalog(branchId: string) {
    if (!supabase || !branchId) {
      setCategories([]);
      setProducts([]);
      return;
    }

    const [categoryResult, initialProductResult, branchResult, optionGroupResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, sort_order")
        .eq("store_id", branchId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("products")
        .select("id, external_id, name, description, price, unit, stock_quantity, image_url, badge, category_id, is_active, updated_at, product_images(id, image_url, sort_order)")
        .eq("store_id", branchId)
        .order("name", { ascending: true }),
      supabase
        .from("stores")
        .select("cover_image_url")
        .eq("id", branchId)
        .maybeSingle(),
      supabase
        .from("option_groups")
        .select("id, name, min_selections, max_selections, sort_order, is_active, option_group_items(id, name, price_delta, sort_order, is_active), product_option_groups(product_id, sort_order)")
        .eq("store_id", branchId)
        .order("sort_order", { ascending: true }),
    ]);
    let productRows = (initialProductResult.data ?? []) as Product[];
    if (initialProductResult.error && /product_images|relationship|schema cache/i.test(initialProductResult.error.message)) {
      const fallbackProductResult = await supabase
        .from("products")
        .select("id, external_id, name, description, price, unit, stock_quantity, image_url, badge, category_id, is_active, updated_at")
        .eq("store_id", branchId)
        .order("name", { ascending: true });
      productRows = (fallbackProductResult.data ?? []) as Product[];
    }
    const categoryRows = categoryResult.data;
    const branchRow = branchResult.data;
    const normalizedProductRows = productRows.map((product) => ({
      ...product,
      product_images: product.product_images?.length
        ? [...product.product_images].sort((left, right) => left.sort_order - right.sort_order)
        : product.image_url
          ? [{ id: "legacy", image_url: product.image_url, sort_order: 0 }]
          : [],
    }));

    const branchOptionGroups = (optionGroupResult.data ?? []) as ProductOptionGroup[];
    const optionGroupsByProduct = new Map<string, ProductOptionGroup[]>();
    for (const group of branchOptionGroups) {
      for (const link of group.product_option_groups ?? []) {
        const current = optionGroupsByProduct.get(link.product_id) ?? [];
        current.push({ ...group, option_group_items: [...(group.option_group_items ?? [])].sort((a, b) => a.sort_order - b.sort_order) });
        optionGroupsByProduct.set(link.product_id, current);
      }
    }
    setCategories((categoryRows ?? []) as Category[]);
    setOptionGroups(branchOptionGroups);
    setProducts(normalizedProductRows.map((product) => ({ ...product, option_groups: optionGroupsByProduct.get(product.id) ?? [] })) as Product[]);
    if (branchRow) {
      setBranches((current) => current.map((branch) => branch.id === branchId ? { ...branch, cover_image_url: branchRow.cover_image_url } : branch));
      setAdminBranches((current) => current.map((branch) => branch.id === branchId ? { ...branch, cover_image_url: branchRow.cover_image_url } : branch));
    }
  }

  async function refreshActiveBranchParameters(branchId: string) {
    if (!supabase || !branchId) {
      setActiveProductImageLimit(1);
      setActiveControlsStock(true);
      setActiveEnablesAdditions(false);
      return;
    }
    const { data: branch } = await supabase.from("stores").select("tenant_id").eq("id", branchId).maybeSingle();
    if (!branch?.tenant_id) return;
    const parameterKeys = [PRODUCT_IMAGE_LIMIT_PARAMETER_KEY, STOCK_CONTROL_PARAMETER_KEY, ADDITIONS_PARAMETER_KEY, ORDER_MODE_PARAMETER_KEY, INTERNAL_CATALOG_COMPACT_PARAMETER_KEY, PRINT_MODE_PARAMETER_KEY, CATALOG_LAYOUT_PARAMETER_KEY];
    const [tenantParameterResult, storeParameterResult] = await Promise.all([
      supabase.from("tenant_parameters").select("parameter_key, parameter_value").eq("tenant_id", branch.tenant_id).in("parameter_key", parameterKeys),
      supabase.from("store_parameters").select("parameter_key, parameter_value").eq("store_id", branchId).in("parameter_key", [...parameterKeys, BUSINESS_HOURS_PARAMETER_KEY]),
    ]);
    const tenantParameters = new Map((tenantParameterResult.data ?? []).map((row) => [row.parameter_key, row.parameter_value]));
    const storeParameters = new Map((storeParameterResult.data ?? []).map((row) => [row.parameter_key, row.parameter_value]));
    setActiveProductImageLimit(productImageLimitValue(
      storeParameters.get(PRODUCT_IMAGE_LIMIT_PARAMETER_KEY) ?? tenantParameters.get(PRODUCT_IMAGE_LIMIT_PARAMETER_KEY),
      1,
    ));
    setActiveControlsStock(parameterBoolean(
      storeParameters.get(STOCK_CONTROL_PARAMETER_KEY) ?? tenantParameters.get(STOCK_CONTROL_PARAMETER_KEY),
      true,
    ));
    setActiveEnablesAdditions(parameterBoolean(
      storeParameters.get(ADDITIONS_PARAMETER_KEY) ?? tenantParameters.get(ADDITIONS_PARAMETER_KEY),
      false,
    ));
    setActiveCatalogLayout(catalogLayoutValue(storeParameters.get(CATALOG_LAYOUT_PARAMETER_KEY) ?? tenantParameters.get(CATALOG_LAYOUT_PARAMETER_KEY)));
    if (storeParameterResult.error) return;
    const storedBusinessHours = businessHoursValue(storeParameters.get(BUSINESS_HOURS_PARAMETER_KEY));
    setBranchBusinessHours((current) => branchId in current ? current : { ...current, [branchId]: storedBusinessHours });
  }

  async function resolveBranchControlsStock(branchId: string) {
    if (!supabase || !branchId) throw new Error("Não foi possível identificar a filial para consultar o controle de estoque.");

    const { data: branch, error: branchError } = await supabase
      .from("stores")
      .select("tenant_id")
      .eq("id", branchId)
      .maybeSingle();
    if (branchError) throw branchError;
    if (!branch?.tenant_id) throw new Error("Não foi possível identificar a empresa desta filial.");

    const [tenantParameterResult, storeParameterResult] = await Promise.all([
      supabase
        .from("tenant_parameters")
        .select("parameter_value")
        .eq("tenant_id", branch.tenant_id)
        .eq("parameter_key", STOCK_CONTROL_PARAMETER_KEY)
        .maybeSingle(),
      supabase
        .from("store_parameters")
        .select("parameter_value")
        .eq("store_id", branchId)
        .eq("parameter_key", STOCK_CONTROL_PARAMETER_KEY)
        .maybeSingle(),
    ]);
    if (tenantParameterResult.error) throw tenantParameterResult.error;
    if (storeParameterResult.error) throw storeParameterResult.error;

    return parameterBoolean(
      storeParameterResult.data?.parameter_value ?? tenantParameterResult.data?.parameter_value,
      true,
    );
  }

  useEffect(() => {
    void refreshBranchCatalog(activeBranchId);
    void refreshActiveBranchParameters(activeBranchId);
  }, [activeBranchId]);

  useEffect(() => {
    setCoverImageFile(null);
    setCoverImagePreview("");
    setProductImageFiles([]);
    setProductImagePreviews([]);
    setEditingProductId("");
    setProductForm({ ...EMPTY_PRODUCT_FORM });
    setCatalogEditorMode(null);
    closeMeasurementUnitEditor();
    setUploadingProductImageId("");
    quickProductImageTargetRef.current = "";
    if (coverImageInputRef.current) coverImageInputRef.current.value = "";
    if (productImageInputRef.current) productImageInputRef.current.value = "";
    if (quickProductImageInputRef.current) quickProductImageInputRef.current.value = "";
  }, [activeBranchId]);

  useEffect(() => {
    const selectedBranch = branches.find((branch) => branch.id === activeBranchId);
    setBranchLocationForm({
      address: selectedBranch?.address ?? "",
      latitude: selectedBranch?.latitude == null ? "" : String(selectedBranch.latitude).replace(".", ","),
      longitude: selectedBranch?.longitude == null ? "" : String(selectedBranch.longitude).replace(".", ","),
    });
    setBranchDetailsForm({
      name: selectedBranch?.name ?? "",
      cnpj: formatDocument(selectedBranch?.cnpj ?? "", detectDocumentKind(selectedBranch?.cnpj)),
      phone: formatWhatsapp(selectedBranch?.whatsapp_phone ?? ""),
      coverNote: selectedBranch?.cover_note ?? "",
      isActive: selectedBranch?.is_active ?? true,
    });
  }, [activeBranchId, branches]);

  useEffect(() => () => {
    if (coverImagePreview.startsWith("blob:")) URL.revokeObjectURL(coverImagePreview);
  }, [coverImagePreview]);

  useEffect(() => () => {
    productImagePreviews.forEach((preview) => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    });
  }, [productImagePreviews]);

  useEffect(() => () => {
    if (companyProfilePreview.startsWith("blob:")) URL.revokeObjectURL(companyProfilePreview);
  }, [companyProfilePreview]);

  function branchLocationForTarget(target: BranchLocationTarget): BranchLocationValue {
    if (target === "branch") return branchForm;
    return branchLocationForm;
  }

  function updateBranchLocation(target: BranchLocationTarget, location: BranchLocationValue) {
    if (target === "branch") setBranchForm((current) => ({ ...current, ...location }));
    else setBranchLocationForm(location);
  }

  function updateBranchAddress(target: BranchLocationTarget, address: string) {
    updateBranchLocation(target, { address, latitude: "", longitude: "" });
    if (locationIssue?.target === target) setLocationIssue(null);
  }

  async function validateBranchAddress(target: BranchLocationTarget) {
    const address = branchLocationForTarget(target).address.trim();
    if (address.length < 3) {
      const issue = "Digite um endereço com rua, número, cidade e estado para validar.";
      setMessage(issue);
      setLocationIssue({ target, message: issue });
      return;
    }

    setValidatingBranchAddress(target);
    setMessage("Validando o endereço da filial...");
    setLocationIssue(null);
    try {
      const location = await findAddressOnOpenStreetMap(address);
      updateBranchLocation(target, location);
      setMessage("Endereço validado. Confira o ponto indicado no mapa.");
    } catch (error) {
      const issue = error instanceof Error && error.message === "address_not_found"
        ? "Não encontramos esse endereço. Informe rua, número, cidade e estado e tente novamente."
        : "O serviço de mapas não respondeu. Aguarde um momento e tente novamente.";
      setMessage(issue);
      setLocationIssue({ target, message: issue });
    } finally {
      setValidatingBranchAddress("");
    }
  }

  async function captureBranchLocation(target: BranchLocationTarget) {
    if (!navigator.geolocation) {
      const issue = "A localização não está disponível neste navegador.";
      setMessage(issue);
      setLocationIssue({ target, message: issue });
      return;
    }

    if (window.self !== window.top) {
      const opened = window.open(window.location.href, "_blank", "noopener,noreferrer");
      const issue = opened
        ? "O painel foi aberto em uma nova aba. Use o botão de localização novamente nessa aba."
        : "Abra o painel em uma nova aba para o Chrome permitir a localização.";
      setMessage(issue);
      setLocationIssue({ target, message: issue });
      return;
    }

    if (!window.isSecureContext) {
      const issue = "O Chrome só libera localização em uma conexão HTTPS segura.";
      setMessage(issue);
      setLocationIssue({ target, message: issue });
      return;
    }

    setLocatingBranchForm(target);
    setMessage("Obtendo a localização da filial...");
    setLocationIssue(null);

    try {
      let position: GeolocationPosition;
      try {
        position = await requestBrowserLocation({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      } catch (firstError) {
        const geolocationError = firstError as GeolocationPositionError;
        if (geolocationError.code === geolocationError.PERMISSION_DENIED) throw geolocationError;
        position = await requestBrowserLocation({ enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 });
      }

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      let address = "";
      try {
        address = await findAddressFromCoordinates(latitude, longitude);
      } catch {
        // Coordinates remain usable when reverse geocoding is temporarily unavailable.
      }
      updateBranchLocation(target, {
        address: address || `Localização atual (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
      });
      setMessage(address ? "Localização identificada. Confira o ponto indicado no mapa." : "Localização encontrada. Confira o ponto indicado no mapa.");
      setLocationIssue(null);
    } catch (error) {
      const issue = locationErrorMessage(error as GeolocationPositionError);
      setMessage(issue);
      setLocationIssue({ target, message: issue });
    } finally {
      setLocatingBranchForm("");
    }
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setMessage("");
    const fieldErrors = validateCompanyRequest(newCompanyFields);
    const accountErrors = validateAccount(newCompanyAccount);
    setNewCompanyErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      setMessage("Revise os campos destacados.");
      return;
    }
    if (Object.keys(accountErrors).length) {
      setMessage(accountErrors.email ?? accountErrors.password ?? "");
      return;
    }
    setCreatingCompany(true);
    const { data, error } = await supabase.functions.invoke("create-store-user", {
      body: companyCreationBody(newCompanyFields, newCompanyAccount, newCompanyTrialDays),
    });
    setCreatingCompany(false);
    if (error || data?.error || !data?.tenant || !data?.branch) {
      setMessage(data?.error ?? error?.message ?? "Não foi possível criar a empresa e seu acesso.");
      return;
    }
    setMessage("Empresa e acesso criados. O dono já pode entrar e confirmar o endereço da loja no mapa.");
    setTenant(null);
    setBranches([]);
    setActiveBranchId("");
    setAdminTenants((current) => [...current, data.tenant as Tenant]);
    setAdminBranches((current) => [...current, data.branch as Branch]);
    void reloadCompanyStatuses();
    navigate({ view: "companies" });
    setNewCompanyFields(EMPTY_COMPANY_FIELDS);
    setNewCompanyErrors({});
    setNewCompanyAccount({ email: "", password: "" });
    setNewCompanyTrialDays("");
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !activeBranchId || !categoryName.trim()) return;
    const { error } = await supabase.from("categories").insert({
      store_id: activeBranchId,
      name: categoryName.trim(),
      sort_order: categories.length,
      is_active: true,
    });
    setMessage(error?.message ?? "Categoria adicionada.");
    if (!error) {
      setCategoryName("");
      await refreshBranchCatalog(activeBranchId);
      closeCatalogEditor();
    }
  }

  async function deleteCategory(category: Category) {
    if (!supabase || !activeBranchId || deletingCategoryId) return;
    const localProductCount = products.filter((product) => product.category_id === category.id).length;
    if (localProductCount > 0) {
      setMessage(`A categoria ${category.name} possui ${localProductCount} produto(s). Desvincule-os antes de excluir.`);
      return;
    }
    if (!window.confirm(`Excluir definitivamente a categoria "${category.name}"?`)) return;

    setDeletingCategoryId(category.id);
    setMessage("");
    try {
      const { count, error: productCountError } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", activeBranchId)
        .eq("category_id", category.id);
      if (productCountError) throw productCountError;
      if ((count ?? 0) > 0) {
        await refreshBranchCatalog(activeBranchId);
        setMessage(`A categoria ${category.name} recebeu produtos e não pode mais ser excluída.`);
        return;
      }

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", category.id)
        .eq("store_id", activeBranchId);
      if (error) throw error;

      setCategories((current) => current.filter((item) => item.id !== category.id));
      setMessage(`Categoria ${category.name} excluída.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir a categoria.");
    } finally {
      setDeletingCategoryId("");
    }
  }

  function resetOptionGroupEditor() {
    setOptionGroupForm({ name: "", min: "0", max: "1", productIds: [] });
    setOptionDrafts([]);
    setOptionDraftForm({ name: "", priceDelta: "0,00" });
  }

  function addOptionDraft() {
    const name = optionDraftForm.name.trim();
    if (!name) return;
    if (optionDrafts.some((item) => normalizeText(item.name) === normalizeText(name))) {
      setMessage("Esse opcional já foi adicionado ao grupo.");
      return;
    }
    setOptionDrafts((current) => [...current, { name, priceDelta: formatMoneyInput(optionDraftForm.priceDelta) || "0,00" }]);
    setOptionDraftForm({ name: "", priceDelta: "0,00" });
  }

  async function createOptionGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !activeBranchId || savingOptionGroup) return;
    const name = optionGroupForm.name.trim();
    const min = Number(optionGroupForm.min);
    const max = Number(optionGroupForm.max);
    if (!name || !optionDrafts.length || !optionGroupForm.productIds.length || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || min > max) {
      setMessage("Informe o nome, vincule pelo menos um produto, adicione um opcional e confira mínimo/máximo.");
      return;
    }
    if (min > optionDrafts.length) {
      setMessage("O mínimo de escolhas não pode ser maior que a quantidade de opcionais.");
      return;
    }
    setSavingOptionGroup(true);
    setMessage("");
    try {
      const { data: group, error: groupError } = await supabase.from("option_groups").insert({
        store_id: activeBranchId,
        name,
        min_selections: min,
        max_selections: Math.min(max, optionDrafts.length),
        sort_order: optionGroups.length,
        is_active: true,
      }).select("id").single();
      if (groupError || !group) throw groupError ?? new Error("Não foi possível criar o grupo de opcionais.");
      const { error: itemsError } = await supabase.from("option_group_items").insert(optionDrafts.map((item, index) => ({ group_id: group.id, name: item.name, price_delta: moneyInputNumber(item.priceDelta), sort_order: index, is_active: true })));
      if (itemsError) throw itemsError;
      const { error: linksError } = await supabase.from("product_option_groups").insert(optionGroupForm.productIds.map((productId, index) => ({ product_id: productId, group_id: group.id, sort_order: index })));
      if (linksError) throw linksError;
      resetOptionGroupEditor();
      setShowOptionGroupForm(false);
      await refreshBranchCatalog(activeBranchId);
      setMessage(`Grupo de opcionais ${name} criado e vinculado a ${optionGroupForm.productIds.length} produto(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o grupo de opcionais.");
    } finally {
      setSavingOptionGroup(false);
    }
  }

  async function createAdditionGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !activeBranchId || savingAdditionGroup) return;
    const name = additionGroupName.trim();
    const max = Number(additionGroupMax);
    if (!name) {
      setMessage("Informe o nome do grupo de adicionais.");
      return;
    }
    if (!Number.isInteger(max) || max < 1) {
      setMessage("Informe a quantidade máxima de adicionais que o cliente pode escolher no grupo.");
      return;
    }
    setSavingAdditionGroup(true);
    setMessage("");
    try {
      const { error } = await supabase.from("option_groups").insert({
        store_id: activeBranchId,
        name,
        min_selections: additionGroupRequired ? 1 : 0,
        max_selections: max,
        sort_order: optionGroups.length,
        is_active: true,
      });
      if (error) throw error;
      setAdditionGroupName("");
      setAdditionGroupRequired(false);
      setAdditionGroupMax("1");
      await refreshBranchCatalog(activeBranchId);
      setMessage(`Grupo de adicionais ${name} criado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o grupo de adicionais.");
    } finally {
      setSavingAdditionGroup(false);
    }
  }

  async function refreshMeasurementUnits(tenantId: string) {
    if (!supabase || !tenantId) {
      setMeasurementUnits([]);
      setMeasurementUnitUsage({});
      setMeasurementUnitUsageReady(false);
      return;
    }
    setMeasurementUnitUsageReady(false);
    const { data, error } = await supabase
      .from("measurement_units")
      .select("id, tenant_id, code, name, sort_order, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      setMeasurementUnits([]);
      setMessage(readableMeasurementUnitError(error));
      return;
    }
    setMeasurementUnits(((data ?? []) as MeasurementUnit[]).map((unit) => ({ ...unit, code: unit.code.toUpperCase() })));
  }

  async function refreshMeasurementUnitUsage(tenantId: string, units: MeasurementUnit[]) {
    if (!supabase || !tenantId) {
      setMeasurementUnitUsage({});
      setMeasurementUnitUsageReady(false);
      return;
    }
    if (!units.length) {
      setMeasurementUnitUsage({});
      setMeasurementUnitUsageReady(true);
      return;
    }

    setMeasurementUnitUsageReady(false);
    try {
      const { data: tenantStores, error: storesError } = await supabase
        .from("stores")
        .select("id")
        .eq("tenant_id", tenantId);
      if (storesError) throw storesError;

      const storeIds = (tenantStores ?? []).map((store) => store.id);
      const productUnits: string[] = [];
      for (const storeIdChunk of chunkRows(storeIds, 100)) {
        let offset = 0;
        while (true) {
          const { data: unitRows, error: unitRowsError } = await supabase
            .from("products")
            .select("unit")
            .in("store_id", storeIdChunk)
            .not("unit", "is", null)
            .range(offset, offset + 999);
          if (unitRowsError) throw unitRowsError;
          const rows = unitRows ?? [];
          productUnits.push(...rows.map((row) => row.unit).filter((value): value is string => Boolean(value)));
          if (rows.length < 1000) break;
          offset += 1000;
        }
      }

      const unitIdsByAlias = new Map<string, Set<string>>();
      for (const unit of units) {
        for (const alias of [unit.code, unit.name]) {
          const normalizedAlias = normalizeText(alias);
          const linkedUnitIds = unitIdsByAlias.get(normalizedAlias) ?? new Set<string>();
          linkedUnitIds.add(unit.id);
          unitIdsByAlias.set(normalizedAlias, linkedUnitIds);
        }
      }

      const usage = Object.fromEntries(units.map((unit) => [unit.id, 0])) as Record<string, number>;
      for (const productUnit of productUnits) {
        for (const unitId of unitIdsByAlias.get(normalizeText(productUnit)) ?? []) usage[unitId] += 1;
      }
      setMeasurementUnitUsage(usage);
      setMeasurementUnitUsageReady(true);
    } catch (error) {
      setMeasurementUnitUsage({});
      setMessage(`Não foi possível verificar os produtos vinculados às unidades. ${supabaseErrorMessage(error)}`.trim());
    }
  }

  async function createMeasurementUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !tenant?.id || savingMeasurementUnit) return;
    const code = measurementUnitCode.trim().toUpperCase();
    const name = measurementUnitName.trim();
    if (!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(code)) {
      setMessage("Informe um código com até 20 caracteres, usando apenas letras, números, ponto, hífen ou sublinhado.");
      return;
    }
    if (!name) {
      setMessage("Informe o nome da unidade de medida.");
      return;
    }
    if (measurementUnits.some((unit) => unit.code.toUpperCase() === code || normalizeText(unit.name) === normalizeText(name))) {
      setMessage("Já existe uma unidade com esse código ou nome.");
      return;
    }
    setSavingMeasurementUnit(true);
    setMessage("");
    try {
      const { data, error } = await supabase
        .from("measurement_units")
        .insert({
          tenant_id: tenant.id,
          code,
          name,
          sort_order: measurementUnits.length,
          is_active: true,
      })
        .select("id, tenant_id, code, name, sort_order, is_active")
        .single();
      if (error) throw error;
      const createdUnit = data as MeasurementUnit;
      setMeasurementUnits((current) => [...current, { ...createdUnit, code: createdUnit.code.toUpperCase() }]);
      setMeasurementUnitCode("");
      setMeasurementUnitName("");
      setShowMeasurementUnitForm(false);
      setMessage(`Unidade ${name} cadastrada.`);
    } catch (error) {
      setMessage(readableMeasurementUnitError(error));
    } finally {
      setSavingMeasurementUnit(false);
    }
  }

  async function deleteMeasurementUnit(unit: MeasurementUnit) {
    if (!supabase || !tenant?.id || deletingMeasurementUnitId) return;
    if (!measurementUnitUsageReady) {
      setMessage("Aguarde a verificação dos produtos vinculados antes de excluir a unidade.");
      return;
    }
    const linkedProductCount = measurementUnitUsage[unit.id] ?? 0;
    if (linkedProductCount > 0) {
      setMessage(`Não é possível excluir a unidade ${unit.name}: existem ${linkedProductCount} produto(s) vinculado(s).`);
      return;
    }
    if (!window.confirm(`Excluir a unidade de medida "${unit.name}"?`)) return;
    setDeletingMeasurementUnitId(unit.id);
    const { error } = await supabase
      .from("measurement_units")
      .delete()
      .eq("id", unit.id)
      .eq("tenant_id", tenant.id);
    if (error) {
      setMessage(readableMeasurementUnitError(error));
    } else {
      setMeasurementUnits((current) => current.filter((item) => item.id !== unit.id));
      setMeasurementUnitUsage((current) => {
        const next = { ...current };
        delete next[unit.id];
        return next;
      });
      setMessage(`Unidade ${unit.name} excluída.`);
    }
    setDeletingMeasurementUnitId("");
  }

  async function deleteOptionGroup(group: ProductOptionGroup) {
    if (!supabase || !activeBranchId || deletingOptionGroupId) return;
    const linkedProductCount = (group.product_option_groups ?? []).length;
    if (linkedProductCount > 0) {
      setMessage(`Não é possível excluir o grupo ${group.name}: existem ${linkedProductCount} produto(s) vinculado(s).`);
      return;
    }
    if (!window.confirm(`Excluir o grupo de opcionais "${group.name}"?`)) return;
    setDeletingOptionGroupId(group.id);
    const { error } = await supabase.from("option_groups").delete().eq("id", group.id).eq("store_id", activeBranchId);
    if (error) setMessage(error.message);
    else {
      await refreshBranchCatalog(activeBranchId);
      setMessage(`Grupo ${group.name} excluído.`);
    }
    setDeletingOptionGroupId("");
  }

  function selectAdminTenant(tenantId: string) {
    const selectedTenant = adminTenants.find((item) => item.id === tenantId) ?? null;
    const selectedBranches = adminBranches.filter((branch) => branch.tenant_id === tenantId);
    setTenant(selectedTenant);
    setBranches(selectedBranches);
    setActiveBranchId(selectedBranches[0]?.id ?? "");
  }

  async function openCompanySettings(tenantId: string) {
    if (!supabase) return;
    settingsRequestRef.current = tenantId;
    const selectedTenant = adminTenants.find((item) => item.id === tenantId) ?? (tenant?.id === tenantId ? tenant : null);
    const adminSelectedBranches = adminBranches.filter((branch) => branch.tenant_id === tenantId);
    const selectedBranches = adminSelectedBranches.length
      ? adminSelectedBranches
      : branches.filter((branch) => branch.tenant_id === tenantId);
    const isSameTenant = tenant?.id === tenantId;
    const nextActiveBranchId = isSameTenant && activeBranchId && selectedBranches.some((branch) => branch.id === activeBranchId)
      ? activeBranchId
      : selectedBranches[0]?.id ?? "";
    setTenant(selectedTenant);
    setBranches(selectedBranches);
    setActiveBranchId(nextActiveBranchId);
    setAccessForm({ name: "", email: "", password: "" });
    setCompanyIdentity({
      isActive: selectedTenant?.is_active ?? true,
      themeColor: companyThemeColor(selectedTenant?.theme_color),
      profileImageUrl: selectedTenant?.profile_image_url ?? "",
    });
    setCompanyProfileFile(null);
    setCompanyProfilePreview("");
    setCompanyIdentityFeedback(null);
    if (companyProfileInputRef.current) companyProfileInputRef.current.value = "";
    setCompanyCalculatesDeliveryFee(true);
    setBranchFreightModes({});
    setCompanyDeliveryFeeType("fixed");
    setBranchDeliveryFeeTypeModes({});
    setCompanyCatalogLayout("horizontal");
    setBranchCatalogLayouts({});
    setCompanyProductImageLimit(1);
    setBranchProductImageLimits({});
    setCompanyControlsStock(true);
    setCompanyEnablesAdditions(false);
    setCompanyOrderMode("whatsapp");
    setCompanyCompactInternalCatalog(true);
    setCompanyPrintMode("disabled");
    setBranchStockControlModes({});
    setBranchOrderModes({});
    setBranchCompactInternalCatalogModes({});
    setBranchPrintModes({});
    setBranchBusinessHours({});
    setBranchDeliveryFees(Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      Number(branch.delivery_fee ?? 0).toFixed(2).replace(".", ","),
    ])));
    setShowDeleteCompany(false);
    setDeleteConfirmation("");
    setParameterScope((current) => isSameTenant ? current : "company");
    setLoadingSettings(true);
    setMessage("");

    const branchParameterRequest = selectedBranches.length
      ? supabase
          .from("store_parameters")
          .select("store_id, parameter_key, parameter_value")
          .in("parameter_key", [FREIGHT_PARAMETER_KEY, DELIVERY_FEE_TYPE_PARAMETER_KEY, CATALOG_LAYOUT_PARAMETER_KEY, PRODUCT_IMAGE_LIMIT_PARAMETER_KEY, STOCK_CONTROL_PARAMETER_KEY, ADDITIONS_PARAMETER_KEY, ORDER_MODE_PARAMETER_KEY, INTERNAL_CATALOG_COMPACT_PARAMETER_KEY, PRINT_MODE_PARAMETER_KEY, BUSINESS_HOURS_PARAMETER_KEY])
          .in("store_id", selectedBranches.map((branch) => branch.id))
      : Promise.resolve({ data: [], error: null });
    const [settingsResult, tenantParameterResult, branchParameterResult, tenantIdentityResult] = await Promise.all([
      isCompanyPortal
        ? Promise.resolve({ data: { account: null }, error: null })
        : supabase.functions.invoke("create-store-user", {
            body: { action: "get-company-settings", tenant_id: tenantId },
          }),
      supabase
        .from("tenant_parameters")
        .select("parameter_key, parameter_value")
        .eq("tenant_id", tenantId)
        .in("parameter_key", [FREIGHT_PARAMETER_KEY, DELIVERY_FEE_TYPE_PARAMETER_KEY, CATALOG_LAYOUT_PARAMETER_KEY, PRODUCT_IMAGE_LIMIT_PARAMETER_KEY, STOCK_CONTROL_PARAMETER_KEY, ADDITIONS_PARAMETER_KEY, ORDER_MODE_PARAMETER_KEY, INTERNAL_CATALOG_COMPACT_PARAMETER_KEY, PRINT_MODE_PARAMETER_KEY]),
      branchParameterRequest,
      supabase
        .from("tenants")
        .select("id, name, slug, is_active, theme_color, profile_image_url")
        .eq("id", tenantId)
        .maybeSingle(),
    ]);
    if (settingsRequestRef.current !== tenantId) return;
    setLoadingSettings(false);
    const { data, error } = settingsResult;
    if (error || data?.error || tenantParameterResult.error || branchParameterResult.error || tenantIdentityResult.error) {
      setMessage(data?.error ?? error?.message ?? tenantParameterResult.error?.message ?? branchParameterResult.error?.message ?? tenantIdentityResult.error?.message ?? "Não foi possível carregar as configurações da empresa.");
      return;
    }
    if (tenantIdentityResult.data) {
      const savedTenant = tenantIdentityResult.data as Tenant;
      const nextTenant = { ...(selectedTenant ?? savedTenant), ...savedTenant };
      setTenant(nextTenant);
      setCompanyIdentity({
        isActive: nextTenant.is_active ?? true,
        themeColor: companyThemeColor(nextTenant.theme_color),
        profileImageUrl: nextTenant.profile_image_url ?? "",
      });
      setAdminTenants((current) => current.map((item) => item.id === nextTenant.id ? { ...item, ...nextTenant } : item));
    }
    setAccessForm({
      name: data?.account?.name ?? "",
      email: data?.account?.email ?? "",
      password: "",
    });
    const tenantParameters = new Map(
      (tenantParameterResult.data ?? []).map((row) => [row.parameter_key, row.parameter_value]),
    );
    const nextCompanyCalculatesDeliveryFee = parameterBoolean(tenantParameters.get(FREIGHT_PARAMETER_KEY), true);
    const nextCompanyDeliveryFeeType = deliveryFeeTypeValue(tenantParameters.get(DELIVERY_FEE_TYPE_PARAMETER_KEY));
    const nextCompanyCatalogLayout = catalogLayoutValue(tenantParameters.get(CATALOG_LAYOUT_PARAMETER_KEY));
    const nextCompanyProductImageLimit = productImageLimitValue(tenantParameters.get(PRODUCT_IMAGE_LIMIT_PARAMETER_KEY), 1);
    const nextCompanyControlsStock = parameterBoolean(tenantParameters.get(STOCK_CONTROL_PARAMETER_KEY), true);
    const nextCompanyEnablesAdditions = parameterBoolean(tenantParameters.get(ADDITIONS_PARAMETER_KEY), false);
    const nextCompanyOrderMode = orderModeValue(tenantParameters.get(ORDER_MODE_PARAMETER_KEY));
    const nextCompanyCompactInternalCatalog = parameterBoolean(tenantParameters.get(INTERNAL_CATALOG_COMPACT_PARAMETER_KEY), true);
    const nextCompanyPrintMode = printModeValue(tenantParameters.get(PRINT_MODE_PARAMETER_KEY));
    setCompanyCalculatesDeliveryFee(nextCompanyCalculatesDeliveryFee);
    setCompanyDeliveryFeeType(nextCompanyDeliveryFeeType);
    setCompanyCatalogLayout(nextCompanyCatalogLayout);
    setCompanyProductImageLimit(nextCompanyProductImageLimit);
    setCompanyControlsStock(nextCompanyControlsStock);
    setCompanyEnablesAdditions(nextCompanyEnablesAdditions);
    setCompanyOrderMode(nextCompanyOrderMode);
    setCompanyCompactInternalCatalog(nextCompanyCompactInternalCatalog);
    setCompanyPrintMode(nextCompanyPrintMode);
    const freightParameterByStore = new Map(
      (branchParameterResult.data ?? [])
        .filter((row) => row.parameter_key === FREIGHT_PARAMETER_KEY)
        .map((row) => [row.store_id, parameterBoolean(row.parameter_value, true)]),
    );
    const deliveryFeeTypeParameterByStore = new Map(
      (branchParameterResult.data ?? [])
        .filter((row) => row.parameter_key === DELIVERY_FEE_TYPE_PARAMETER_KEY)
        .map((row) => [row.store_id, deliveryFeeTypeValue(row.parameter_value)]),
    );
    const layoutParameterByStore = new Map(
      (branchParameterResult.data ?? [])
        .filter((row) => row.parameter_key === CATALOG_LAYOUT_PARAMETER_KEY)
        .map((row) => [row.store_id, catalogLayoutValue(row.parameter_value)]),
    );
    const imageLimitParameterByStore = new Map(
      (branchParameterResult.data ?? [])
        .filter((row) => row.parameter_key === PRODUCT_IMAGE_LIMIT_PARAMETER_KEY)
        .map((row) => [row.store_id, productImageLimitValue(row.parameter_value)]),
    );
    const stockControlParameterByStore = new Map(
      (branchParameterResult.data ?? [])
        .filter((row) => row.parameter_key === STOCK_CONTROL_PARAMETER_KEY)
        .map((row) => [row.store_id, parameterBoolean(row.parameter_value, true)]),
    );
    const additionsParameterByStore = new Map(
      (branchParameterResult.data ?? [])
        .filter((row) => row.parameter_key === ADDITIONS_PARAMETER_KEY)
        .map((row) => [row.store_id, parameterBoolean(row.parameter_value, false)]),
    );
    const orderModeParameterByStore = new Map(
      (branchParameterResult.data ?? [])
        .filter((row) => row.parameter_key === ORDER_MODE_PARAMETER_KEY)
        .map((row) => [row.store_id, orderModeValue(row.parameter_value)] as const),
    );
    const compactInternalCatalogParameterByStore = new Map(
      (branchParameterResult.data ?? [])
        .filter((row) => row.parameter_key === INTERNAL_CATALOG_COMPACT_PARAMETER_KEY)
        .map((row) => [row.store_id, parameterBoolean(row.parameter_value, true)]),
    );
    const printModeParameterByStore = new Map(
      (branchParameterResult.data ?? [])
        .filter((row) => row.parameter_key === PRINT_MODE_PARAMETER_KEY)
        .map((row) => [row.store_id, printModeValue(row.parameter_value)] as const),
    );
    const businessHoursParameterByStore = new Map<string, BusinessHoursConfig>();
    for (const row of branchParameterResult.data ?? []) {
      if (row.parameter_key !== BUSINESS_HOURS_PARAMETER_KEY) continue;
      businessHoursParameterByStore.set(row.store_id, businessHoursValue(row.parameter_value));
    }
    const nextBranchFreightModes = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      freightParameterByStore.has(branch.id)
        ? freightParameterByStore.get(branch.id) ? "enabled" : "disabled"
        : "inherit",
    ])) as Record<string, FreightParameterMode>;
    const nextBranchDeliveryFeeTypeModes = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      deliveryFeeTypeParameterByStore.get(branch.id) ?? "inherit",
    ])) as Record<string, BranchDeliveryFeeTypeMode>;
    const nextBranchCatalogLayouts = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      layoutParameterByStore.get(branch.id) ?? "inherit",
    ])) as Record<string, BranchCatalogLayoutMode>;
    const nextBranchProductImageLimits = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      imageLimitParameterByStore.get(branch.id) ?? "inherit",
    ])) as Record<string, ProductImageLimitMode>;
    const nextBranchStockControlModes = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      stockControlParameterByStore.has(branch.id)
        ? stockControlParameterByStore.get(branch.id) ? "enabled" : "disabled"
        : "inherit",
    ])) as Record<string, StockControlMode>;
    const nextBranchAdditionsModes = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      additionsParameterByStore.has(branch.id)
        ? additionsParameterByStore.get(branch.id) ? "enabled" : "disabled"
        : "inherit",
    ])) as Record<string, AdditionsMode>;
    const nextBranchOrderModes = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      orderModeParameterByStore.get(branch.id) ?? "inherit",
    ])) as Record<string, BranchOrderMode>;
    const nextBranchCompactInternalCatalogModes = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      compactInternalCatalogParameterByStore.has(branch.id)
        ? compactInternalCatalogParameterByStore.get(branch.id) ? "enabled" : "disabled"
        : "inherit",
    ])) as Record<string, CompactInternalCatalogMode>;
    const nextBranchPrintModes = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      printModeParameterByStore.get(branch.id) ?? "inherit",
    ])) as Record<string, BranchPrintMode>;
    const nextBranchBusinessHours = Object.fromEntries(selectedBranches.map((branch) => [
      branch.id,
      businessHoursParameterByStore.get(branch.id) ?? createDefaultBusinessHours(),
    ])) as Record<string, BusinessHoursConfig>;
    setBranchFreightModes(nextBranchFreightModes);
    setBranchDeliveryFeeTypeModes(nextBranchDeliveryFeeTypeModes);
    setBranchCatalogLayouts(nextBranchCatalogLayouts);
    setBranchProductImageLimits(nextBranchProductImageLimits);
    setBranchStockControlModes(nextBranchStockControlModes);
    setBranchAdditionsModes(nextBranchAdditionsModes);
    setBranchOrderModes(nextBranchOrderModes);
    setBranchCompactInternalCatalogModes(nextBranchCompactInternalCatalogModes);
    setBranchPrintModes(nextBranchPrintModes);
    setBranchBusinessHours(nextBranchBusinessHours);
    if (nextActiveBranchId) {
      const nextStockMode = nextBranchStockControlModes[nextActiveBranchId] ?? "inherit";
      const nextAdditionsMode = nextBranchAdditionsModes[nextActiveBranchId] ?? "inherit";
      const nextImageLimitMode = nextBranchProductImageLimits[nextActiveBranchId] ?? "inherit";
      setActiveControlsStock(nextStockMode === "inherit" ? nextCompanyControlsStock : nextStockMode === "enabled");
      setActiveEnablesAdditions(nextAdditionsMode === "inherit" ? nextCompanyEnablesAdditions : nextAdditionsMode === "enabled");
      setActiveProductImageLimit(nextImageLimitMode === "inherit" ? nextCompanyProductImageLimit : nextImageLimitMode);
    }
    setSettingsLoadedTenantId(tenantId);
  }

  async function saveCompanyParameters(): Promise<boolean> {
    if (!supabase || !tenant || savingParameters) return false;
    setSavingParameters(true);
    setMessage("");
    const updatedAt = new Date().toISOString();
    const { error: tenantParameterError } = await supabase.from("tenant_parameters").upsert([
      {
        tenant_id: tenant.id,
        parameter_key: FREIGHT_PARAMETER_KEY,
        parameter_value: companyCalculatesDeliveryFee,
        is_public: true,
        updated_at: updatedAt,
      },
      {
        tenant_id: tenant.id,
        parameter_key: DELIVERY_FEE_TYPE_PARAMETER_KEY,
        parameter_value: companyDeliveryFeeType,
        is_public: true,
        updated_at: updatedAt,
      },
      {
        tenant_id: tenant.id,
        parameter_key: CATALOG_LAYOUT_PARAMETER_KEY,
        parameter_value: companyCatalogLayout,
        is_public: true,
        updated_at: updatedAt,
      },
      {
        tenant_id: tenant.id,
        parameter_key: PRODUCT_IMAGE_LIMIT_PARAMETER_KEY,
        parameter_value: productImageLimitValue(companyProductImageLimit),
        is_public: true,
        updated_at: updatedAt,
      },
      {
        tenant_id: tenant.id,
        parameter_key: STOCK_CONTROL_PARAMETER_KEY,
        parameter_value: companyControlsStock,
        is_public: true,
        updated_at: updatedAt,
      },
      {
        tenant_id: tenant.id,
        parameter_key: ADDITIONS_PARAMETER_KEY,
        parameter_value: companyEnablesAdditions,
        is_public: true,
        updated_at: updatedAt,
      },
      {
        tenant_id: tenant.id,
        parameter_key: ORDER_MODE_PARAMETER_KEY,
        parameter_value: companyOrderMode,
        is_public: true,
        updated_at: updatedAt,
      },
      {
        tenant_id: tenant.id,
        parameter_key: INTERNAL_CATALOG_COMPACT_PARAMETER_KEY,
        parameter_value: companyCompactInternalCatalog,
        is_public: true,
        updated_at: updatedAt,
      },
      {
        tenant_id: tenant.id,
        parameter_key: PRINT_MODE_PARAMETER_KEY,
        parameter_value: companyPrintMode,
        is_public: false,
        updated_at: updatedAt,
      },
    ], { onConflict: "tenant_id,parameter_key" });

    if (tenantParameterError) {
      setSavingParameters(false);
      setMessage(tenantParameterError.message);
      return false;
    }

    setSavingParameters(false);
    if (activeBranchId) void refreshActiveBranchParameters(activeBranchId);
    setMessage(`Parâmetros padrão de ${tenant.name} atualizados.`);
    return true;
  }

  async function saveBranchParameters(): Promise<boolean> {
    if (!supabase || !tenant || !activeBranchId || savingParameters) return false;

    const branch = branches.find((item) => item.id === activeBranchId);
    if (!branch) return false;

    const fee = moneyInputNumber(branchDeliveryFees[branch.id] ?? "0");
    if (!Number.isFinite(fee) || fee < 0) {
      setMessage(`Informe uma taxa de entrega válida para ${branch.name}.`);
      return false;
    }

    setSavingParameters(true);
    setMessage("");
    const freightMode = branchFreightModes[branch.id] ?? "inherit";
    const deliveryFeeTypeMode = branchDeliveryFeeTypeModes[branch.id] ?? "inherit";
    const layoutMode = branchCatalogLayouts[branch.id] ?? "inherit";
    const imageLimitMode = branchProductImageLimits[branch.id] ?? "inherit";
    const stockControlMode = branchStockControlModes[branch.id] ?? "inherit";
    const additionsMode = branchAdditionsModes[branch.id] ?? "inherit";
    const orderMode = branchOrderModes[branch.id] ?? "inherit";
    const compactInternalCatalogMode = branchCompactInternalCatalogModes[branch.id] ?? "inherit";
    const printMode = branchPrintModes[branch.id] ?? "inherit";
    const businessHours = businessHoursValue(branchBusinessHours[branch.id] ?? createDefaultBusinessHours());
    const freightParameterRequest = freightMode === "inherit"
      ? await supabase
          .from("store_parameters")
          .delete()
          .eq("store_id", branch.id)
          .eq("parameter_key", FREIGHT_PARAMETER_KEY)
      : await supabase.from("store_parameters").upsert({
          store_id: branch.id,
          parameter_key: FREIGHT_PARAMETER_KEY,
          parameter_value: freightMode === "enabled",
          is_public: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,parameter_key" });
    const deliveryFeeTypeParameterRequest = deliveryFeeTypeMode === "inherit"
      ? await supabase
          .from("store_parameters")
          .delete()
          .eq("store_id", branch.id)
          .eq("parameter_key", DELIVERY_FEE_TYPE_PARAMETER_KEY)
      : await supabase.from("store_parameters").upsert({
          store_id: branch.id,
          parameter_key: DELIVERY_FEE_TYPE_PARAMETER_KEY,
          parameter_value: deliveryFeeTypeMode,
          is_public: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,parameter_key" });
    const layoutParameterRequest = layoutMode === "inherit"
      ? await supabase
          .from("store_parameters")
          .delete()
          .eq("store_id", branch.id)
          .eq("parameter_key", CATALOG_LAYOUT_PARAMETER_KEY)
      : await supabase.from("store_parameters").upsert({
          store_id: branch.id,
          parameter_key: CATALOG_LAYOUT_PARAMETER_KEY,
          parameter_value: layoutMode,
          is_public: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,parameter_key" });
    const imageLimitParameterRequest = imageLimitMode === "inherit"
      ? await supabase
          .from("store_parameters")
          .delete()
          .eq("store_id", branch.id)
          .eq("parameter_key", PRODUCT_IMAGE_LIMIT_PARAMETER_KEY)
      : await supabase.from("store_parameters").upsert({
          store_id: branch.id,
          parameter_key: PRODUCT_IMAGE_LIMIT_PARAMETER_KEY,
          parameter_value: productImageLimitValue(imageLimitMode),
          is_public: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,parameter_key" });
    const stockControlParameterRequest = stockControlMode === "inherit"
      ? await supabase
          .from("store_parameters")
          .delete()
          .eq("store_id", branch.id)
          .eq("parameter_key", STOCK_CONTROL_PARAMETER_KEY)
      : await supabase.from("store_parameters").upsert({
          store_id: branch.id,
          parameter_key: STOCK_CONTROL_PARAMETER_KEY,
          parameter_value: stockControlMode === "enabled",
          is_public: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,parameter_key" });
    const additionsParameterRequest = additionsMode === "inherit"
      ? await supabase
          .from("store_parameters")
          .delete()
          .eq("store_id", branch.id)
          .eq("parameter_key", ADDITIONS_PARAMETER_KEY)
      : await supabase.from("store_parameters").upsert({
          store_id: branch.id,
          parameter_key: ADDITIONS_PARAMETER_KEY,
          parameter_value: additionsMode === "enabled",
          is_public: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,parameter_key" });
    const orderModeParameterRequest = orderMode === "inherit"
      ? await supabase
          .from("store_parameters")
          .delete()
          .eq("store_id", branch.id)
          .eq("parameter_key", ORDER_MODE_PARAMETER_KEY)
      : await supabase.from("store_parameters").upsert({
          store_id: branch.id,
          parameter_key: ORDER_MODE_PARAMETER_KEY,
          parameter_value: orderMode,
          is_public: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,parameter_key" });
    const compactInternalCatalogParameterRequest = compactInternalCatalogMode === "inherit"
      ? await supabase
          .from("store_parameters")
          .delete()
          .eq("store_id", branch.id)
          .eq("parameter_key", INTERNAL_CATALOG_COMPACT_PARAMETER_KEY)
      : await supabase.from("store_parameters").upsert({
          store_id: branch.id,
          parameter_key: INTERNAL_CATALOG_COMPACT_PARAMETER_KEY,
          parameter_value: compactInternalCatalogMode === "enabled",
          is_public: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,parameter_key" });
    const printModeParameterRequest = printMode === "inherit"
      ? await supabase
          .from("store_parameters")
          .delete()
          .eq("store_id", branch.id)
          .eq("parameter_key", PRINT_MODE_PARAMETER_KEY)
      : await supabase.from("store_parameters").upsert({
          store_id: branch.id,
          parameter_key: PRINT_MODE_PARAMETER_KEY,
          parameter_value: printMode,
          is_public: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,parameter_key" });
    const businessHoursParameterRequest = await supabase.from("store_parameters").upsert({
      store_id: branch.id,
      parameter_key: BUSINESS_HOURS_PARAMETER_KEY,
      parameter_value: businessHours,
      is_public: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id,parameter_key" });

    const parameterError = freightParameterRequest.error ?? deliveryFeeTypeParameterRequest.error ?? layoutParameterRequest.error ?? imageLimitParameterRequest.error ?? stockControlParameterRequest.error ?? additionsParameterRequest.error ?? orderModeParameterRequest.error ?? compactInternalCatalogParameterRequest.error ?? printModeParameterRequest.error ?? businessHoursParameterRequest.error;
    if (parameterError) {
      setSavingParameters(false);
      setMessage(parameterError.message);
      return false;
    }

    const { error: feeError } = await supabase
      .from("stores")
      .update({ delivery_fee: fee })
      .eq("id", branch.id);
    if (feeError) {
      setSavingParameters(false);
      setMessage(feeError.message);
      return false;
    }

    const updateFee = (item: Branch) => item.id === branch.id ? { ...item, delivery_fee: fee } : item;
    setBranches((current) => current.map(updateFee));
    setAdminBranches((current) => current.map(updateFee));
    setSavingParameters(false);
    void refreshActiveBranchParameters(branch.id);
    setMessage(`Parâmetros da filial ${branch.name} atualizados.`);
    return true;
  }

  async function downloadPrintAgentInstaller(branch: Branch) {
    if (!supabase || generatingPrintInstallerId) return;
    if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
      setMessage("As variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não estão configuradas nesta publicação.");
      return;
    }
    setGeneratingPrintInstallerId(branch.id);
    setMessage(`Gerando instalador de impressão para ${branch.name}...`);
    try {
      const { data, error } = await supabase.rpc("create_print_agent_token", {
        p_store_id: branch.id,
        p_name: `Agente de impressão - ${branch.name}`,
      });
      if (error) throw error;
      const token = typeof data === "object" && data && "token" in data ? String((data as { token?: unknown }).token ?? "") : "";
      if (!token) throw new Error("O Supabase não retornou o token do agente.");

      const script = printAgentInstallerScript({
        supabaseUrl: publicSupabaseUrl,
        anonKey: publicSupabaseAnonKey,
        token,
        companyName: tenant?.name ?? "LIIST",
        branchName: branch.name,
      });
      const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `liist-instalador-impressao-${slugify(branch.name) || "filial"}.cmd`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`Instalador de impressão de ${branch.name} baixado. Execute o arquivo .cmd no computador da loja.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Não foi possível gerar o instalador: ${error.message}` : "Não foi possível gerar o instalador de impressão.");
    } finally {
      setGeneratingPrintInstallerId("");
    }
  }

  async function saveCompanyIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingCompanyIdentity) return;
    if (!supabase || !tenant) {
      const errorMessage = "Não foi possível conectar ao Supabase para salvar a identidade.";
      setCompanyIdentityFeedback({ status: "error", message: errorMessage });
      setMessage(errorMessage);
      return;
    }
    const uploadBranchId = branches[0]?.id;
    if (companyProfileFile && !uploadBranchId) {
      const errorMessage = "Cadastre uma filial antes de enviar a foto da empresa.";
      setCompanyIdentityFeedback({ status: "error", message: errorMessage });
      setMessage(errorMessage);
      return;
    }

    setSavingCompanyIdentity(true);
    setMessage("");
    setCompanyIdentityFeedback({ status: "saving", message: "Salvando a identidade da empresa..." });
    let uploadedPath = "";
    try {
      let profileImageUrl = companyIdentity.profileImageUrl || null;
      if (companyProfileFile && uploadBranchId) {
        const uploaded = await uploadCatalogImage(companyProfileFile, "company-profile", uploadBranchId);
        uploadedPath = uploaded.path;
        profileImageUrl = uploaded.url;
      }

      const identityData = {
        is_active: companyIdentity.isActive,
        theme_color: companyThemeColor(companyIdentity.themeColor),
        profile_image_url: profileImageUrl,
      };
      const { data: savedIdentity, error } = await supabase
        .from("tenants")
        .update(identityData)
        .eq("id", tenant.id);
      if (error) throw error;

      const previousImagePath = storagePathFromPublicUrl(companyIdentity.profileImageUrl);
      if (uploadedPath && previousImagePath && previousImagePath !== uploadedPath) {
        await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove([previousImagePath]);
      }
      const savedIdentityData = {
        is_active: identityData.is_active,
        theme_color: companyThemeColor(identityData.theme_color),
        profile_image_url: identityData.profile_image_url,
      };
      const updateTenant = (item: Tenant) => item.id === tenant.id ? { ...item, ...savedIdentityData } : item;
      setTenant((current) => current ? updateTenant(current) : current);
      setAdminTenants((current) => current.map(updateTenant));
      setCompanyIdentity({
        isActive: savedIdentityData.is_active,
        themeColor: savedIdentityData.theme_color,
        profileImageUrl: savedIdentityData.profile_image_url ?? "",
      });
      setCompanyProfileFile(null);
      setCompanyProfilePreview("");
      if (companyProfileInputRef.current) companyProfileInputRef.current.value = "";
      const successMessage = `Identidade de ${tenant.name} salva com sucesso.`;
      setCompanyIdentityFeedback({ status: "success", message: successMessage });
      setMessage(successMessage);
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove([uploadedPath]);
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message ?? "Não foi possível atualizar a identidade da empresa.")
          : "Não foi possível atualizar a identidade da empresa.";
      setCompanyIdentityFeedback({ status: "error", message: errorMessage });
      setMessage(errorMessage);
    } finally {
      setSavingCompanyIdentity(false);
    }
  }

  async function updateCompanyAvailability(isActive: boolean) {
    if (!supabase || !tenant || savingAvailability) return;
    setSavingAvailability("company");
    setMessage("");
    const { error } = await supabase.from("tenants").update({ is_active: isActive }).eq("id", tenant.id);
    setSavingAvailability("");
    if (error) {
      setMessage(error.message);
      return;
    }

    const updateTenant = (item: Tenant) => item.id === tenant.id ? { ...item, is_active: isActive } : item;
    setTenant((current) => current ? updateTenant(current) : current);
    setAdminTenants((current) => current.map(updateTenant));
    setCompanyIdentity((current) => ({ ...current, isActive }));
    setMessage(isActive
      ? `Empresa ${tenant.name} ativada. As filiais ativas voltaram ao catálogo público.`
      : `Empresa ${tenant.name} desativada. Todas as filiais foram ocultadas do catálogo público.`);
  }

  async function updateBranchAvailability(branchId: string, isActive: boolean) {
    if (!supabase || savingAvailability) return;
    const branch = branches.find((item) => item.id === branchId);
    if (!branch) return;

    setSavingAvailability(branchId);
    setMessage("");
    const { error } = await supabase.from("stores").update({ is_active: isActive }).eq("id", branchId);
    setSavingAvailability("");
    if (error) {
      setMessage(error.message);
      return;
    }

    const updateBranch = (item: Branch) => item.id === branchId ? { ...item, is_active: isActive } : item;
    setBranches((current) => current.map(updateBranch));
    setAdminBranches((current) => current.map(updateBranch));
    setBranchDetailsForm((current) => activeBranchId === branchId ? { ...current, isActive } : current);
    setMessage(`Filial ${branch.name} ${isActive ? "ativada" : "desativada"}.`);
  }

  async function removeCompanyProfileImage() {
    if (!supabase || !tenant || savingCompanyIdentity || !companyIdentity.profileImageUrl) return;
    setSavingCompanyIdentity(true);
    setMessage("");
    setCompanyIdentityFeedback({ status: "saving", message: "Removendo a foto da empresa..." });
    try {
      const previousPath = storagePathFromPublicUrl(companyIdentity.profileImageUrl);
      const { error } = await supabase
        .from("tenants")
        .update({ profile_image_url: null })
        .eq("id", tenant.id)
        .select("id")
        .single();
      if (error) throw error;
      if (previousPath) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove([previousPath]);
      const updateTenant = (item: Tenant) => item.id === tenant.id ? { ...item, profile_image_url: null } : item;
      setTenant((current) => current ? updateTenant(current) : current);
      setAdminTenants((current) => current.map(updateTenant));
      setCompanyIdentity((current) => ({ ...current, profileImageUrl: "" }));
      setCompanyProfileFile(null);
      setCompanyProfilePreview("");
      const successMessage = "Foto da empresa removida com sucesso.";
      setCompanyIdentityFeedback({ status: "success", message: successMessage });
      setMessage(successMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível remover a foto da empresa.";
      setCompanyIdentityFeedback({ status: "error", message: errorMessage });
      setMessage(errorMessage);
    } finally {
      setSavingCompanyIdentity(false);
    }
  }

  async function saveCompanyAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !tenant || savingAccess) return;
    setSavingAccess(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke("create-store-user", {
      body: {
        action: "update-company-access",
        tenant_id: tenant.id,
        name: accessForm.name.trim(),
        email: accessForm.email.trim(),
        password: accessForm.password,
      },
    });
    setSavingAccess(false);
    if (error || data?.error || !data?.account) {
      setMessage(data?.error ?? error?.message ?? "Não foi possível atualizar o acesso da empresa.");
      return;
    }
    setAccessForm({ name: data.account.name, email: data.account.email, password: "" });
    setMessage("Acesso atualizado. A empresa já pode entrar com as novas credenciais.");
  }

  async function deleteCompany() {
    if (!supabase || !tenant || deletingCompany || deleteConfirmation.trim() !== tenant.name) return;
    const deletedTenantId = tenant.id;
    const deletedTenantName = tenant.name;
    setDeletingCompany(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke("create-store-user", {
      body: {
        action: "delete-company",
        tenant_id: deletedTenantId,
        confirmation: deleteConfirmation.trim(),
      },
    });
    setDeletingCompany(false);
    if (error || data?.error || !data?.deleted) {
      setMessage(data?.error ?? error?.message ?? "Não foi possível excluir a empresa.");
      return;
    }

    setAdminTenants((current) => current.filter((item) => item.id !== deletedTenantId));
    setAdminBranches((current) => current.filter((branch) => branch.tenant_id !== deletedTenantId));
    setTenant(null);
    setBranches([]);
    setActiveBranchId("");
    setShowDeleteCompany(false);
    setDeleteConfirmation("");
    navigate({ view: "companies" });
    setMessage(data.warning ?? `Empresa ${deletedTenantName} e todos os seus dados foram excluídos.`);
  }

  async function createBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !tenant || savingBranch) return;

    const phone = branchForm.phone.replace(/\D/g, "");
    if (phone.length < 10) {
      setMessage("Informe um WhatsApp válido para a filial.");
      return;
    }
    if (!isValidDocument(branchForm.cnpj)) {
      setMessage("Informe um CPF ou CNPJ válido para a filial.");
      return;
    }
    const latitude = validCoordinate(branchForm.latitude, -90, 90);
    const longitude = validCoordinate(branchForm.longitude, -180, 180);
    if (!branchForm.address.trim()) {
      setMessage("Informe o endereço da filial.");
      return;
    }
    if (latitude === null || longitude === null) {
      setMessage("Use a localização atual ou valide o endereço da filial.");
      return;
    }

    setSavingBranch(true);
    setMessage("");
    const { data: sourceBranch } = await supabase
      .from("stores")
      .select("segment")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("stores")
      .insert({
        tenant_id: tenant.id,
        name: branchForm.name.trim(),
        slug: slugify(branchForm.name),
        cnpj: branchForm.cnpj.replace(/\D/g, ""),
        segment: sourceBranch?.segment ?? "retail",
        whatsapp_phone: phone,
        address: branchForm.address.trim(),
        latitude,
        longitude,
        cover_note: branchForm.coverNote.trim() || null,
        is_active: true,
      })
      .select(BRANCH_DETAIL_SELECT)
      .single();

    setSavingBranch(false);
    if (error || !data) {
      setMessage(error?.code === "23505" ? "Já existe uma filial com este nome ou documento." : error?.message ?? "Não foi possível criar a filial.");
      return;
    }

    const branchRow = { ...(data as Branch), cnpj: branchForm.cnpj.replace(/\D/g, "") };
    setBranches((current) => [...current, branchRow]);
    setAdminBranches((current) => [...current, branchRow]);
    setActiveBranchId(branchRow.id);
    setBranchFreightModes((current) => ({ ...current, [branchRow.id]: "inherit" }));
    setBranchDeliveryFeeTypeModes((current) => ({ ...current, [branchRow.id]: "inherit" }));
    setBranchCatalogLayouts((current) => ({ ...current, [branchRow.id]: "inherit" }));
    setBranchProductImageLimits((current) => ({ ...current, [branchRow.id]: "inherit" }));
    setBranchStockControlModes((current) => ({ ...current, [branchRow.id]: "inherit" }));
    setBranchAdditionsModes((current) => ({ ...current, [branchRow.id]: "inherit" }));
    setBranchOrderModes((current) => ({ ...current, [branchRow.id]: "inherit" }));
    setBranchPrintModes((current) => ({ ...current, [branchRow.id]: "inherit" }));
    setBranchBusinessHours((current) => ({ ...current, [branchRow.id]: createDefaultBusinessHours() }));
    setBranchDeliveryFees((current) => ({ ...current, [branchRow.id]: Number(branchRow.delivery_fee ?? 0).toFixed(2).replace(".", ",") }));
    setBranchForm({ name: "", cnpj: "", phone: "", address: "", latitude: "", longitude: "", coverNote: "" });
    navigate({ view: "section", section: "configuracoes", tenantId: portalMode === "admin" ? tenant.id : undefined, tab: "dados" });
    setMessage("Nova filial criada. Ela já está disponível no Portal da empresa.");
  }

  async function saveBranchDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !activeBranchId || savingBranchDetails) return;
    const name = branchDetailsForm.name.trim();
    const phone = branchDetailsForm.phone.replace(/\D/g, "");
    const cnpj = branchDetailsForm.cnpj.replace(/\D/g, "");
    const address = branchLocationForm.address.trim();
    const latitude = validCoordinate(branchLocationForm.latitude, -90, 90);
    const longitude = validCoordinate(branchLocationForm.longitude, -180, 180);
    if (name.length < 2) {
      setMessage("Informe o nome da filial.");
      return;
    }
    if (phone.length < 10) {
      setMessage("Informe um WhatsApp válido para a filial.");
      return;
    }
    if (!isValidDocument(cnpj)) {
      setMessage("Informe um CPF ou CNPJ válido para a filial.");
      return;
    }
    if (!address) {
      setMessage("Informe o endereço da filial.");
      return;
    }
    if (latitude === null || longitude === null) {
      setMessage("Use a localização atual ou valide o endereço antes de salvar.");
      return;
    }
    const branchUpdate: Partial<Branch> = {
      name,
      cnpj,
      whatsapp_phone: phone,
      address,
      latitude,
      longitude,
      cover_note: branchDetailsForm.coverNote.trim() || null,
      is_active: branchDetailsForm.isActive,
    };
    const loadedBusinessHours = branchBusinessHours[activeBranchId];
    setSavingBranchDetails(true);
    setMessage("");
    const { error } = await supabase
      .from("stores")
      .update(branchUpdate)
      .eq("id", activeBranchId);
    if (error) {
      setSavingBranchDetails(false);
      setMessage(error.message);
      return;
    }
    // Sem horário carregado (falha de rede), mantém o que está salvo em vez de gravar o padrão.
    const { error: businessHoursError } = loadedBusinessHours ? await supabase.from("store_parameters").upsert({
      store_id: activeBranchId,
      parameter_key: BUSINESS_HOURS_PARAMETER_KEY,
      parameter_value: businessHoursValue(loadedBusinessHours),
      is_public: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id,parameter_key" }) : { error: null };
    setSavingBranchDetails(false);
    if (businessHoursError) {
      setMessage(businessHoursError.message);
      return;
    }

    const updateBranch = (branch: Branch) => branch.id === activeBranchId
      ? { ...branch, ...branchUpdate }
      : branch;
    setBranches((current) => current.map(updateBranch));
    setAdminBranches((current) => current.map(updateBranch));
    setMessage(`Dados da filial ${name} atualizados.`);
  }

  function selectCoverImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const validationMessage = validateCatalogImage(file);
    if (validationMessage) {
      event.target.value = "";
      setMessage(validationMessage);
      return;
    }
    setCoverImageFile(file);
    setCoverImagePreview(URL.createObjectURL(file));
    setMessage("");
  }

  function selectProductImage(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) return;
    const invalidFile = selectedFiles.find((file) => validateCatalogImage(file));
    if (invalidFile) {
      event.target.value = "";
      setMessage(validateCatalogImage(invalidFile));
      return;
    }
    const editingProduct = editingProductId ? products.find((product) => product.id === editingProductId) : null;
    const existingCount = editingProduct?.product_images?.length ?? 0;
    const remaining = Math.max(0, activeProductImageLimit - existingCount);
    if (!remaining) {
      event.target.value = "";
      setMessage(`Este produto já atingiu o limite de ${activeProductImageLimit} foto(s).`);
      return;
    }
    const acceptedFiles = selectedFiles.slice(0, remaining);
    setProductImageFiles(acceptedFiles);
    setProductImagePreviews(acceptedFiles.map((file) => URL.createObjectURL(file)));
    if (selectedFiles.length > remaining) {
      setMessage(`Foram selecionadas somente ${remaining} foto(s), conforme o limite desta filial.`);
      return;
    }
    setMessage("");
  }

  function selectCompanyProfileImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const validationMessage = validateCatalogImage(file);
    if (validationMessage) {
      event.target.value = "";
      setCompanyIdentityFeedback({ status: "error", message: validationMessage });
      setMessage(validationMessage);
      return;
    }
    setCompanyProfileFile(file);
    setCompanyProfilePreview(URL.createObjectURL(file));
    setCompanyIdentityFeedback(null);
    setMessage("");
  }

  async function uploadCatalogImage(file: File, folder: "covers" | "products" | "company-profile", storeId = activeBranchId) {
    if (!supabase || !storeId) throw new Error("Selecione uma filial antes de enviar a imagem.");
    const extension = CATALOG_IMAGE_EXTENSIONS[file.type];
    const path = `${storeId}/${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(CATALOG_IMAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      const isMissingBucket = /bucket|not found/i.test(error.message);
      throw new Error(isMissingBucket ? "O armazenamento de imagens ainda não foi configurado no Supabase." : error.message);
    }
    const { data } = supabase.storage.from(CATALOG_IMAGE_BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function saveBranchCover() {
    if (!supabase || !activeBranchId || !coverImageFile || uploadingCover) return;
    setUploadingCover(true);
    setMessage("Enviando capa da filial...");
    let uploadedPath = "";
    try {
      let uploaded;
      try {
        uploaded = await uploadCatalogImage(coverImageFile, "covers");
      } catch (error) {
        throw new Error(`Falha no envio da imagem: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      }
      uploadedPath = uploaded.path;
      const previousCover = branches.find((branch) => branch.id === activeBranchId)?.cover_image_url;
      const { error } = await supabase.rpc("set_store_cover", {
        target_store_id: activeBranchId,
        new_cover_image_url: uploaded.url,
      });
      if (error) throw new Error(`Falha ao gravar a capa: ${error.message}`);

      setBranches((current) => current.map((branch) => branch.id === activeBranchId ? { ...branch, cover_image_url: uploaded.url } : branch));
      setAdminBranches((current) => current.map((branch) => branch.id === activeBranchId ? { ...branch, cover_image_url: uploaded.url } : branch));
      setCoverImageFile(null);
      setCoverImagePreview("");
      if (coverImageInputRef.current) coverImageInputRef.current.value = "";
      const previousPath = storagePathFromPublicUrl(previousCover);
      if (previousPath) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove([previousPath]);
      setMessage("Capa da filial atualizada.");
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove([uploadedPath]);
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a capa.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function removeBranchCover() {
    if (!supabase || !activeBranchId || uploadingCover) return;
    const previousCover = branches.find((branch) => branch.id === activeBranchId)?.cover_image_url;
    if (!previousCover) return;
    setUploadingCover(true);
    setMessage("");
    const { error } = await supabase.rpc("set_store_cover", {
      target_store_id: activeBranchId,
      new_cover_image_url: "",
    });
    if (error) {
      setMessage(error.message);
      setUploadingCover(false);
      return;
    }
    setBranches((current) => current.map((branch) => branch.id === activeBranchId ? { ...branch, cover_image_url: null } : branch));
    setAdminBranches((current) => current.map((branch) => branch.id === activeBranchId ? { ...branch, cover_image_url: null } : branch));
    const previousPath = storagePathFromPublicUrl(previousCover);
    if (previousPath) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove([previousPath]);
    setUploadingCover(false);
    setMessage("Capa removida. O catálogo usará a apresentação neutra.");
  }

  async function downloadCatalogTemplate() {
    if (!supabase || !activeBranchId || exportingCatalog) return;
    setExportingCatalog(true);
    setMessage("");
    try {
      const controlsStock = await resolveBranchControlsStock(activeBranchId);
      setActiveControlsStock(controlsStock);
      const catalogTenantId = activeBranch?.tenant_id ?? tenant?.id ?? "";
      const [categoryResult, productResult, measurementUnitResult] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name, sort_order")
          .eq("store_id", activeBranchId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("products")
          .select("id, external_id, name, description, price, unit, stock_quantity, image_url, badge, category_id, is_active")
          .eq("store_id", activeBranchId)
          .order("name", { ascending: true }),
        supabase
          .from("measurement_units")
          .select("id, tenant_id, code, name, sort_order, is_active")
          .eq("tenant_id", catalogTenantId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (productResult.error) throw productResult.error;
      const measurementUnitsUnavailable = Boolean(measurementUnitResult.error && isMeasurementUnitsUnavailable(measurementUnitResult.error));
      if (measurementUnitResult.error && !measurementUnitsUnavailable) throw measurementUnitResult.error;
      const exportCategories = (categoryResult.data ?? []) as Category[];
      const exportProducts = (productResult.data ?? []) as Product[];
      const exportMeasurementUnits = measurementUnitsUnavailable ? [] : (measurementUnitResult.data ?? []) as MeasurementUnit[];
      setCategories(exportCategories);
      if (!measurementUnitsUnavailable) setMeasurementUnits(exportMeasurementUnits.map((unit) => ({ ...unit, code: unit.code.toUpperCase() })));

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "LIIST";
      workbook.created = new Date();
      workbook.subject = `Catálogo de ${activeBranch?.name ?? "filial"}`;

      const productsSheet = workbook.addWorksheet("Produtos", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      const listsSheet = workbook.addWorksheet("Listas");
      PRODUCT_STATUS_OPTIONS.forEach((status, index) => {
        listsSheet.getCell(index + 1, 1).value = status;
      });
      listsSheet.state = "veryHidden";
      const exportHeaders = catalogImportHeaders(controlsStock);
      const spreadsheetEndColumn = String.fromCharCode(64 + exportHeaders.length);
      productsSheet.addRow(exportHeaders);
      const categoryNameById = new Map(exportCategories.map((category) => [category.id, category.name]));
      const productSpreadsheetRow = (product: Product) => {
        const values: Record<ImportHeader, string | number> = {
          Categoria: product.category_id ? categoryNameById.get(product.category_id) ?? "" : "",
          Produto: product.name,
          Status: product.is_active ? "Ativo" : "Desativado",
          Descrição: product.description ?? "",
          Preço: Number(product.price),
          Unidade: product.unit ?? "",
          Estoque: product.stock_quantity ?? "",
          Selo: product.badge ?? "",
          "Código/SKU": product.external_id ?? `CAT-${product.id}`,
        };
        return exportHeaders.map((header) => values[header]);
      };
      productsSheet.addRows(exportProducts.map(productSpreadsheetRow));
      productsSheet.columns = exportHeaders.map((header) => ({ width: IMPORT_COLUMN_WIDTHS[header] }));
      productsSheet.autoFilter = { from: "A1", to: `${spreadsheetEndColumn}1` };
      productsSheet.getRow(1).height = 25;
      productsSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B52" } };
        cell.alignment = { vertical: "middle" };
      });
      productsSheet.getColumn(exportHeaders.indexOf("Preço") + 1).numFmt = 'R$ #,##0.00';
      if (controlsStock) productsSheet.getColumn(exportHeaders.indexOf("Estoque") + 1).numFmt = "0.000";
      productsSheet.getColumn(exportHeaders.indexOf("Código/SKU") + 1).numFmt = "@";
      const statusColumnNumber = exportHeaders.indexOf("Status") + 1;
      productsSheet.getColumn(statusColumnNumber).alignment = { horizontal: "center", vertical: "middle" };
      const applyProductStatusValidation = (worksheet: typeof productsSheet, lastRow: number) => {
        const columnLetter = worksheet.getColumn(statusColumnNumber).letter;
        addExcelRangeValidation(worksheet, `${columnLetter}2:${columnLetter}${lastRow}`, {
          type: "list",
          allowBlank: true,
          formulae: ["'Listas'!$A$1:$A$2"],
          showInputMessage: true,
          promptTitle: "Status do produto",
          prompt: "Selecione Ativo ou Desativado.",
          showErrorMessage: true,
          errorTitle: "Status inválido",
          error: "Escolha Ativo ou Desativado na lista.",
        });
      };
      const productValidationLastRow = Math.max(1001, productsSheet.rowCount + 200);
      applyProductStatusValidation(productsSheet, productValidationLastRow);

      const categoriesSheet = workbook.addWorksheet("Categorias", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      categoriesSheet.addTable({
        name: EXCEL_CATEGORY_TABLE_NAME,
        ref: "A1",
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleMedium4",
          showRowStripes: true,
        },
        columns: CATEGORY_IMPORT_HEADERS.map((name) => ({ name, filterButton: true })),
        rows: exportCategories.length
          ? exportCategories.map((category) => [category.name, category.sort_order])
          : [["", ""]],
      });
      categoriesSheet.columns = [{ width: 36 }, { width: 12 }];
      categoriesSheet.getRow(1).height = 25;
      categoriesSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B52" } };
        cell.alignment = { vertical: "middle" };
      });
      const categoryColumnNumber = exportHeaders.indexOf("Categoria") + 1;
      productsSheet.getColumn(categoryColumnNumber).alignment = { vertical: "middle" };
      const categoryColumnLetter = productsSheet.getColumn(categoryColumnNumber).letter;
      addExcelRangeValidation(productsSheet, `${categoryColumnLetter}2:${categoryColumnLetter}${productValidationLastRow}`, {
        type: "list",
        allowBlank: true,
        formulae: [`INDIRECT("${EXCEL_CATEGORY_TABLE_NAME}[Categoria]")`],
        showInputMessage: true,
        promptTitle: "Categoria do produto",
        prompt: 'Cadastre as categorias na aba "Categorias" e selecione uma opção.',
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Categoria inválida",
        error: 'Cadastre a categoria na aba "Categorias" e escolha-a na lista.',
      });

      const measurementUnitsSheet = workbook.addWorksheet("Unidades", { views: [{ state: "frozen", ySplit: 1 }] });
      measurementUnitsSheet.addTable({
        name: EXCEL_MEASUREMENT_UNIT_TABLE_NAME,
        ref: "A1",
        headerRow: true,
        totalsRow: false,
        style: { theme: "TableStyleMedium4", showRowStripes: true },
        columns: MEASUREMENT_UNIT_IMPORT_HEADERS.map((name) => ({ name, filterButton: true })),
        rows: exportMeasurementUnits.length
          ? exportMeasurementUnits.map((unit) => [unit.code.toUpperCase(), unit.name])
          : [["", ""]],
      });
      measurementUnitsSheet.columns = [{ width: 20 }, { width: 34 }];
      measurementUnitsSheet.getColumn(1).numFmt = "@";
      measurementUnitsSheet.getRow(1).height = 25;
      measurementUnitsSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B52" } };
        cell.alignment = { vertical: "middle" };
      });
      const unitColumnNumber = exportHeaders.indexOf("Unidade") + 1;
      const unitColumnLetter = productsSheet.getColumn(unitColumnNumber).letter;
      addExcelRangeValidation(productsSheet, `${unitColumnLetter}2:${unitColumnLetter}${productValidationLastRow}`, {
        type: "list",
        allowBlank: true,
        formulae: [`INDIRECT("${EXCEL_MEASUREMENT_UNIT_TABLE_NAME}[Nome]")`],
        showInputMessage: true,
        promptTitle: "Unidade de medida",
        prompt: 'Cadastre as unidades na aba "Unidades" e selecione uma opção.',
        showErrorMessage: true,
        errorTitle: "Unidade inválida",
        error: 'Escolha uma unidade existente na aba "Unidades".',
      });

      const additionGroupsSheet = workbook.addWorksheet("Grupos de adicionais", { views: [{ state: "frozen", ySplit: 1 }] });
      additionGroupsSheet.addRow(ADDITION_GROUP_HEADERS);
      additionGroupsSheet.addTable({
        name: EXCEL_ADDITION_GROUP_TABLE_NAME,
        ref: "A1",
        headerRow: true,
        totalsRow: false,
        style: { theme: "TableStyleMedium4", showRowStripes: true },
        columns: ADDITION_GROUP_HEADERS.map((name) => ({ name, filterButton: true })),
        rows: optionGroups.length ? optionGroups.map((group) => [group.name, group.min_selections > 0 ? "Sim" : "Não", group.max_selections, group.is_active ? "Ativo" : "Desativado", group.sort_order]) : [["", "", "", "", ""]],
      });
      additionGroupsSheet.columns = [{ width: 34 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 12 }];
      additionGroupsSheet.getRow(1).height = 25;
      additionGroupsSheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B52" } }; });
      addExcelRangeValidation(additionGroupsSheet, `B2:B${Math.max(1001, additionGroupsSheet.rowCount + 200)}`, { type: "list", allowBlank: false, formulae: ["'Listas'!$B$1:$B$2"] });
      addExcelRangeValidation(additionGroupsSheet, `C2:C${Math.max(1001, additionGroupsSheet.rowCount + 200)}`, { type: "whole", operator: "greaterThanOrEqual", allowBlank: false, formulae: ["1"], showErrorMessage: true, errorTitle: "Máximo inválido", error: "Informe um número maior ou igual a 1." });
      addExcelRangeValidation(additionGroupsSheet, `D2:D${Math.max(1001, additionGroupsSheet.rowCount + 200)}`, { type: "list", allowBlank: false, formulae: ["'Listas'!$A$1:$A$2"] });

      const optionsSheet = workbook.addWorksheet("Adicionais", { views: [{ state: "frozen", ySplit: 1 }] });
      optionsSheet.addRow(ADDITION_IMPORT_HEADERS);
      const optionRows = optionGroups.flatMap((group) => (group.product_option_groups ?? []).flatMap((link) => (group.option_group_items ?? []).map((item) => [
        group.name,
        exportProducts.find((product) => product.id === link.product_id)?.name ?? "",
        item.name,
        Number(item.price_delta),
        item.is_active ? "Ativo" : "Desativado",
        item.sort_order,
      ])));
      optionsSheet.addRows(optionRows);
      optionsSheet.columns = [{ width: 26 }, { width: 34 }, { width: 28 }, { width: 15 }, { width: 16 }, { width: 12 }];
      optionsSheet.getRow(1).height = 25;
      optionsSheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B52" } }; });
      optionsSheet.getColumn(ADDITION_IMPORT_HEADERS.indexOf("Acréscimo") + 1).numFmt = 'R$ #,##0.00';
      const optionValidationLastRow = Math.max(1001, optionsSheet.rowCount + 200);
      addExcelRangeValidation(optionsSheet, `A2:A${optionValidationLastRow}`, { type: "list", allowBlank: false, formulae: [`INDIRECT("${EXCEL_ADDITION_GROUP_TABLE_NAME}[Grupo]")`], showInputMessage: true, promptTitle: "Grupo de adicionais", prompt: 'Cadastre os grupos na aba "Grupos de adicionais" e selecione uma opção.', showErrorMessage: true, errorTitle: "Grupo inválido", error: 'Escolha um grupo existente na aba "Grupos de adicionais".' });
      addExcelRangeValidation(optionsSheet, `B2:B${optionValidationLastRow}`, { type: "list", allowBlank: false, formulae: [`INDIRECT("'Produtos'!$B$2:$B$5000")`], showInputMessage: true, promptTitle: "Produto do grupo", prompt: "Escolha um produto da aba Produtos.", showErrorMessage: true, errorTitle: "Produto inválido", error: "Escolha um produto existente na aba Produtos." });
      addExcelRangeValidation(optionsSheet, `E2:E${optionValidationLastRow}`, { type: "list", allowBlank: false, formulae: ["'Listas'!$A$1:$A$2"], showErrorMessage: true, errorTitle: "Status inválido", error: "Escolha Ativo ou Desativado." });
      listsSheet.getCell(1, 2).value = "Sim";
      listsSheet.getCell(2, 2).value = "Não";

      const instructionsSheet = workbook.addWorksheet("Instruções");
      instructionsSheet.columns = [{ width: 24 }, { width: 88 }];
      const instructionRows = [
        ["Campo", "Preenchimento"],
        ["Produtos", "A aba Produtos já contém o catálogo atual. Você pode editar as linhas ou acrescentar produtos."],
        ["Categorias", "Cadastre e organize as categorias nesta aba antes de vinculá-las aos produtos."],
        ["Unidades", "Cadastre o código de integração e o nome da unidade. Na aba Produtos, selecione o nome na coluna Unidade."],
        ["Grupos de adicionais", "Crie os grupos nesta aba, marque se a escolha é obrigatória e informe o máximo de adicionais que o cliente pode escolher naquele grupo."],
        ["Adicionais", "Vincule um produto a um grupo e informe cada adicional, seu acréscimo e status. O máximo é definido somente na aba Grupos de adicionais."],
        ["Categoria", "Na aba Produtos, escolha uma opção do combo alimentado pela aba Categorias."],
        ["Produto", "Obrigatório. Nome exibido no catálogo."],
        ["Descrição", "Opcional."],
        ["Preço", "Obrigatório. Aceita 12,50 ou 12.50."],
        ["Unidade", "Opcional. Exemplos: unidade, caixa, kg, metro."],
        ["Status", "Selecione Ativo para exibir o produto ou Desativado para ocultá-lo do catálogo."],
        ["Fotos", "Envie as fotos pelo botão de imagem de cada produto no Portal da empresa."],
        ["Selo", "Opcional. Exemplo: Mais vendido."],
        ["Código/SKU", "Não altere os códigos já exportados. Em produtos novos, informe um código próprio para permitir futuras atualizações."],
        ["Importação", "As abas Produtos, Categorias, Unidades, Grupos de adicionais e Adicionais são importadas. Não altere os nomes das abas nem os títulos das colunas."],
      ];
      if (controlsStock) instructionRows.splice(8, 0, ["Estoque", "Opcional. Aceita números inteiros ou decimais."]);
      instructionsSheet.addRows(instructionRows);
      instructionsSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B52" } };
      });
      instructionsSheet.eachRow((row) => {
        row.alignment = { vertical: "top", wrapText: true };
      });

      const exampleSheet = workbook.addWorksheet("Exemplo", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      const exampleProducts: Array<Record<ImportHeader, string | number>> = [
        { Categoria: "Bebidas", Produto: "Refrigerante Cola 2 L", Status: "Ativo", Descrição: "Garrafa gelada", Preço: 12, Unidade: "unidade", Estoque: 35, Selo: "Mais vendido", "Código/SKU": "BEB-001" },
        { Categoria: "Mercearia", Produto: "Arroz 5 kg", Status: "Desativado", Descrição: "Pacote tipo 1", Preço: 27.9, Unidade: "pacote", Estoque: 20, Selo: "", "Código/SKU": "MER-001" },
      ];
      exampleSheet.addRows([
        exportHeaders,
        ...exampleProducts.map((product) => exportHeaders.map((header) => product[header])),
      ]);
      exampleSheet.columns = productsSheet.columns.map((column) => ({ width: column.width }));
      exampleSheet.autoFilter = { from: "A1", to: `${spreadsheetEndColumn}1` };
      exampleSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B52" } };
      });
      exampleSheet.getColumn(exportHeaders.indexOf("Preço") + 1).numFmt = 'R$ #,##0.00';
      exampleSheet.getColumn(statusColumnNumber).alignment = { horizontal: "center", vertical: "middle" };
      applyProductStatusValidation(exampleSheet, 100);

      (productsSheet as OrderedWorksheet).orderNo = 1;
      (optionsSheet as OrderedWorksheet).orderNo = 2;
      (measurementUnitsSheet as OrderedWorksheet).orderNo = 3;
      (categoriesSheet as OrderedWorksheet).orderNo = 4;
      (additionGroupsSheet as OrderedWorksheet).orderNo = 5;
      (listsSheet as OrderedWorksheet).orderNo = 6;
      (instructionsSheet as OrderedWorksheet).orderNo = 7;
      (exampleSheet as OrderedWorksheet).orderNo = 8;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `catalogo-${slugify(activeBranch?.name ?? "filial")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`${exportProducts.length} produto(s), ${exportCategories.length} categoria(s) e ${exportMeasurementUnits.length} unidade(s) exportados para o Excel.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Não foi possível exportar o catálogo: ${error.message}` : "Não foi possível exportar o catálogo para o Excel.");
    } finally {
      setExportingCatalog(false);
    }
  }

  async function importCatalog(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase || !activeBranchId || importingCatalog) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage("Selecione uma planilha no formato .xlsx.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("A planilha deve ter no máximo 10 MB.");
      return;
    }

    const branchId = activeBranchId;
    setImportingCatalog(true);
    setMessage("Validando a planilha...");
    try {
      const controlsStock = await resolveBranchControlsStock(branchId);
      setActiveControlsStock(controlsStock);
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet("Produtos");
      if (!sheet) throw new Error('A planilha precisa ter uma aba chamada "Produtos".');
      const categoriesSheet = workbook.getWorksheet("Categorias");
      if (!categoriesSheet) throw new Error('A planilha precisa ter uma aba chamada "Categorias".');
      const measurementUnitsSheet = workbook.getWorksheet("Unidades");
      const importedCategories: CatalogImportCategory[] = [];
      const importedCategoryKeys = new Set<string>();
      const importedMeasurementUnits: CatalogImportMeasurementUnit[] = [];
      const importedMeasurementUnitCodes = new Set<string>();
      const importedMeasurementUnitNames = new Set<string>();
      const importedAdditionGroups: CatalogImportAdditionGroup[] = [];
      const importedOptionRows: CatalogImportOptionRow[] = [];
      const validationErrors: string[] = [];

      if (categoriesSheet) {
        const categoryHeaderColumns = new Map<string, number>();
        categoriesSheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          const header = normalizeText(excelValueToText(cell.value));
          if (header) categoryHeaderColumns.set(header, columnNumber);
        });
        const categoryNameColumn = categoryHeaderColumns.get(normalizeText("Categoria"));
        const categoryOrderColumn = categoryHeaderColumns.get(normalizeText("Ordem"));
        if (!categoryNameColumn) throw new Error('A aba "Categorias" precisa ter a coluna "Categoria".');

        for (let rowNumber = 2; rowNumber <= categoriesSheet.rowCount; rowNumber += 1) {
          const name = excelValueToText(categoriesSheet.getRow(rowNumber).getCell(categoryNameColumn).value);
          const orderValue = categoryOrderColumn
            ? parseBrazilianNumber(categoriesSheet.getRow(rowNumber).getCell(categoryOrderColumn).value)
            : Number.NaN;
          if (!name) continue;
          const key = normalizeText(name);
          if (importedCategoryKeys.has(key)) continue;
          importedCategoryKeys.add(key);
          importedCategories.push({
            name,
            sortOrder: Number.isFinite(orderValue) && orderValue >= 0 ? orderValue : null,
          });
        }
      }

      if (measurementUnitsSheet) {
        const unitHeaderColumns = new Map<string, number>();
        measurementUnitsSheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          const header = normalizeText(excelValueToText(cell.value));
          if (header) unitHeaderColumns.set(header, columnNumber);
        });
        const codeColumn = unitHeaderColumns.get(normalizeText("Código"));
        const nameColumn = unitHeaderColumns.get(normalizeText("Nome"));
        if (!codeColumn || !nameColumn) throw new Error('A aba "Unidades" precisa ter as colunas "Código" e "Nome".');

        for (let rowNumber = 2; rowNumber <= measurementUnitsSheet.rowCount; rowNumber += 1) {
          const code = excelValueToText(measurementUnitsSheet.getRow(rowNumber).getCell(codeColumn).value).toUpperCase();
          const name = excelValueToText(measurementUnitsSheet.getRow(rowNumber).getCell(nameColumn).value);
          if (!code && !name) continue;
          if (!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(code)) validationErrors.push(`aba Unidades linha ${rowNumber}: código inválido`);
          if (!name) validationErrors.push(`aba Unidades linha ${rowNumber}: nome obrigatório`);
          if (importedMeasurementUnitCodes.has(code)) validationErrors.push(`aba Unidades linha ${rowNumber}: código repetido (${code})`);
          if (importedMeasurementUnitNames.has(normalizeText(name))) validationErrors.push(`aba Unidades linha ${rowNumber}: nome repetido (${name})`);
          importedMeasurementUnitCodes.add(code);
          importedMeasurementUnitNames.add(normalizeText(name));
          importedMeasurementUnits.push({ code, name, sortOrder: importedMeasurementUnits.length });
        }
      }

      const additionGroupsSheet = workbook.getWorksheet("Grupos de adicionais");
      if (additionGroupsSheet) {
        const groupColumns = new Map<string, number>();
        additionGroupsSheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          const header = normalizeText(excelValueToText(cell.value));
          if (header) groupColumns.set(header, columnNumber);
        });
        const groupColumn = (rowNumber: number, header: string) => {
          const columnNumber = groupColumns.get(normalizeText(header));
          return columnNumber ? additionGroupsSheet.getRow(rowNumber).getCell(columnNumber).value : null;
        };
        for (let rowNumber = 2; rowNumber <= additionGroupsSheet.rowCount; rowNumber += 1) {
          const name = excelValueToText(groupColumn(rowNumber, "Grupo"));
          if (!name) continue;
          const required = normalizeText(excelValueToText(groupColumn(rowNumber, "Obrigatório")));
          const max = parseBrazilianNumber(groupColumn(rowNumber, "Máximo"));
          const status = productStatusValue(groupColumn(rowNumber, "Status"));
          const sortOrder = parseBrazilianNumber(groupColumn(rowNumber, "Ordem"));
          if (required !== "sim" && required !== "nao") validationErrors.push(`aba Grupos de adicionais linha ${rowNumber}: Obrigatório deve ser Sim ou Não`);
          if (!Number.isInteger(max) || max < 1) validationErrors.push(`aba Grupos de adicionais linha ${rowNumber}: Máximo deve ser maior ou igual a 1`);
          if (status === null) validationErrors.push(`aba Grupos de adicionais linha ${rowNumber}: status inválido`);
          importedAdditionGroups.push({ name, required: required === "sim", max: Number.isInteger(max) && max >= 1 ? max : 1, isActive: status ?? true, sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0 });
        }
      }

      const optionsSheet = workbook.getWorksheet("Adicionais") ?? workbook.getWorksheet("Opcionais");
      if (optionsSheet) {
        const optionHeaderColumns = new Map<string, number>();
        optionsSheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          const header = normalizeText(excelValueToText(cell.value));
          if (header) optionHeaderColumns.set(header, columnNumber);
        });
        const optionColumn = (rowNumber: number, header: string) => {
          const columnNumber = optionHeaderColumns.get(normalizeText(header));
          return columnNumber ? optionsSheet.getRow(rowNumber).getCell(columnNumber).value : null;
        };
        const requiredOptionHeaders = [...ADDITION_IMPORT_HEADERS.slice(0, 7)];
        const missingOptionHeaders = requiredOptionHeaders.filter((header) => !optionHeaderColumns.has(normalizeText(header)));
        if (missingOptionHeaders.length && optionsSheet.name === "Adicionais") throw new Error(`A aba "Adicionais" precisa das colunas: ${missingOptionHeaders.join(", ")}.`);
        const requiredByGroup = new Map(importedAdditionGroups.map((item) => [normalizeText(item.name), item.required]));
        const maxByGroup = new Map(importedAdditionGroups.map((item) => [normalizeText(item.name), item.max]));
        for (let rowNumber = 2; rowNumber <= optionsSheet.rowCount; rowNumber += 1) {
          const group = excelValueToText(optionColumn(rowNumber, "Grupo"));
          const product = excelValueToText(optionColumn(rowNumber, "Produto"));
          const option = excelValueToText(optionColumn(rowNumber, "Adicional")) || excelValueToText(optionColumn(rowNumber, "Opcional"));
          if (!group && !product && !option) continue;
          const legacyRequired = normalizeText(excelValueToText(optionColumn(rowNumber, "Obrigatório")));
          const groupRequired = requiredByGroup.get(normalizeText(group));
          const required = groupRequired === undefined ? legacyRequired : groupRequired ? "sim" : "nao";
          const max = optionsSheet.name === "Adicionais"
            ? maxByGroup.get(normalizeText(group)) ?? Number.NaN
            : parseBrazilianNumber(optionColumn(rowNumber, "Máximo"));
          const priceDelta = parseBrazilianNumber(optionColumn(rowNumber, "Acréscimo"));
          const status = productStatusValue(optionColumn(rowNumber, "Status"));
          const sortOrder = parseBrazilianNumber(optionColumn(rowNumber, "Ordem"));
          if (!group || !product || !option) validationErrors.push(`aba ${optionsSheet.name} linha ${rowNumber}: Grupo, Produto e Adicional são obrigatórios`);
          if (optionsSheet.name === "Adicionais" && groupRequired === undefined) validationErrors.push(`aba Adicionais linha ${rowNumber}: o grupo "${group}" não foi cadastrado na aba Grupos de adicionais`);
          if (optionsSheet.name === "Opcionais" && required !== "sim" && required !== "nao") validationErrors.push(`aba Opcionais linha ${rowNumber}: Obrigatório deve ser Sim ou Não`);
          if (!Number.isInteger(max) || max < 1) validationErrors.push(`aba ${optionsSheet.name} linha ${rowNumber}: máximo inválido`);
          if (!Number.isFinite(priceDelta)) validationErrors.push(`aba ${optionsSheet.name} linha ${rowNumber}: acréscimo inválido`);
          if (status === null) validationErrors.push(`aba ${optionsSheet.name} linha ${rowNumber}: status inválido`);
          importedOptionRows.push({ rowNumber, group, product, required: required === "sim", max, option, priceDelta, isActive: status ?? true, sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0 });
        }
      }

      const headerColumns = new Map<string, number>();
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        const header = normalizeText(excelValueToText(cell.value));
        if (header) headerColumns.set(header, columnNumber);
      });
      const missingHeaders = REQUIRED_IMPORT_HEADERS.filter((header) => !headerColumns.has(normalizeText(header)));
      if (missingHeaders.length) throw new Error(`Colunas obrigatórias ausentes: ${missingHeaders.join(", ")}.`);

      const columnValue = (rowNumber: number, header: (typeof IMPORT_HEADERS)[number]) => {
        const columnNumber = headerColumns.get(normalizeText(header));
        return columnNumber ? sheet.getRow(rowNumber).getCell(columnNumber).value : null;
      };
      const importedRows: CatalogImportRow[] = [];
      const usedSkus = new Set<string>();
      const usedProductsWithoutSku = new Set<string>();

      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const values = IMPORT_HEADERS.map((header) => columnValue(rowNumber, header));
        if (values.every((value) => !excelValueToText(value))) continue;

        const category = excelValueToText(columnValue(rowNumber, "Categoria"));
        const name = excelValueToText(columnValue(rowNumber, "Produto"));
        const price = parseBrazilianNumber(columnValue(rowNumber, "Preço"));
        const stockText = controlsStock ? excelValueToText(columnValue(rowNumber, "Estoque")) : "";
        const stock = stockText ? parseBrazilianNumber(columnValue(rowNumber, "Estoque")) : null;
        const skuText = excelValueToText(columnValue(rowNumber, "Código/SKU"));
        const sku = skuText || null;
        const isActive = productStatusValue(columnValue(rowNumber, "Status"));
        const categoryExists = !category || importedCategoryKeys.has(normalizeText(category));

        if (!name) validationErrors.push(`linha ${rowNumber}: produto vazio`);
        if (!Number.isFinite(price) || price < 0) validationErrors.push(`linha ${rowNumber}: preço inválido`);
        if (stock !== null && (!Number.isFinite(stock) || stock < 0)) validationErrors.push(`linha ${rowNumber}: estoque inválido`);
        if (isActive === null) validationErrors.push(`linha ${rowNumber}: status inválido; use Ativo ou Desativado`);
        if (!categoryExists) validationErrors.push(`linha ${rowNumber}: categoria "${category}" não cadastrada na aba Categorias`);
        if (sku && usedSkus.has(normalizeText(sku))) validationErrors.push(`linha ${rowNumber}: Código/SKU repetido (${sku})`);
        if (sku) usedSkus.add(normalizeText(sku));
        if (!sku && name) {
          const productKey = `${normalizeText(name)}::${normalizeText(category)}`;
          if (usedProductsWithoutSku.has(productKey)) validationErrors.push(`linha ${rowNumber}: produto repetido sem Código/SKU (${name})`);
          usedProductsWithoutSku.add(productKey);
        }

        importedRows.push({
          rowNumber,
          category,
          name,
          description: excelValueToText(columnValue(rowNumber, "Descrição")) || null,
          price,
          unit: excelValueToText(columnValue(rowNumber, "Unidade")) || null,
          stock,
          badge: excelValueToText(columnValue(rowNumber, "Selo")) || null,
          sku,
          isActive: isActive ?? true,
        });
      }

      if (!importedRows.length && !importedCategories.length && !importedMeasurementUnits.length && !importedAdditionGroups.length && !importedOptionRows.length) {
        throw new Error("A planilha não possui produtos nem categorias preenchidos.");
      }
      if (validationErrors.length) {
        const details = validationErrors.slice(0, 6).join("; ");
        const remaining = validationErrors.length > 6 ? `; e mais ${validationErrors.length - 6} erro(s)` : "";
        throw new Error(`Corrija a planilha antes de importar: ${details}${remaining}.`);
      }

      setMessage(`Importando ${importedRows.length} produto(s) e sincronizando categorias...`);
      const { data: existingCategories, error: categoryLoadError } = await supabase
        .from("categories")
        .select("id, name, sort_order, is_active")
        .eq("store_id", branchId)
        .order("sort_order", { ascending: true });
      if (categoryLoadError) throw categoryLoadError;

      const categoryByName = new Map<string, { id: string; is_active: boolean }>();
      for (const category of existingCategories ?? []) {
        const key = normalizeText(category.name);
        if (!categoryByName.has(key)) categoryByName.set(key, { id: category.id, is_active: category.is_active });
      }

      const requestedCategories = new Map<string, CatalogImportCategory>();
      for (const category of importedCategories) {
        requestedCategories.set(normalizeText(category.name), category);
      }
      const missingCategories = [...requestedCategories.entries()]
        .filter(([key]) => !categoryByName.has(key))
        .map(([, category]) => category);
      if (missingCategories.length) {
        const nextSortOrder = (existingCategories ?? []).reduce((highest, category) => Math.max(highest, category.sort_order), -1) + 1;
        const { data: createdCategories, error: categoryCreateError } = await supabase
          .from("categories")
          .insert(missingCategories.map((category, index) => ({
            store_id: branchId,
            name: category.name,
            sort_order: category.sortOrder ?? nextSortOrder + index,
            is_active: true,
          })))
          .select("id, name, is_active");
        if (categoryCreateError) throw categoryCreateError;
        for (const category of createdCategories ?? []) categoryByName.set(normalizeText(category.name), { id: category.id, is_active: true });
      }

      const categoriesToReactivate = [...requestedCategories.keys()]
        .map((key) => categoryByName.get(key))
        .filter((category): category is { id: string; is_active: boolean } => Boolean(category && !category.is_active))
        .map((category) => category.id);
      if (categoriesToReactivate.length) {
        const { error: reactivateError } = await supabase.from("categories").update({ is_active: true }).in("id", categoriesToReactivate);
        if (reactivateError) throw reactivateError;
      }

      if (importedMeasurementUnits.length) {
        const unitTenantId = activeBranch?.tenant_id ?? tenant?.id;
        if (!unitTenantId) throw new Error("Não foi possível identificar a empresa das unidades de medida.");
        const { error: measurementUnitError } = await supabase.from("measurement_units").upsert(
          importedMeasurementUnits.map((unit) => ({
            tenant_id: unitTenantId,
            code: unit.code,
            name: unit.name,
            sort_order: unit.sortOrder ?? 0,
            is_active: true,
          })),
          { onConflict: "tenant_id,code" },
        );
        if (measurementUnitError) throw measurementUnitError;
        await refreshMeasurementUnits(unitTenantId);
      }

      const currentCategoryNameById = new Map(categories.map((category) => [category.id, category.name]));
      const existingProductIdByName = new Map<string, string>();
      for (const product of products) {
        const categoryName = product.category_id ? currentCategoryNameById.get(product.category_id) ?? "" : "";
        const key = `${normalizeText(product.name)}::${normalizeText(categoryName)}`;
        if (!existingProductIdByName.has(key)) existingProductIdByName.set(key, product.id);
      }
      const knownProductIds = new Set(products.map((product) => product.id));
      const productRows = importedRows.map((row) => {
        const catalogIdMatch = row.sku?.match(/^CAT-([0-9a-f-]{36})$/i);
        const catalogId = catalogIdMatch?.[1].toLowerCase() ?? null;
        const catalogProductId = catalogId && knownProductIds.has(catalogId) ? catalogId : null;
        const nameMatchKey = `${normalizeText(row.name)}::${normalizeText(row.category)}`;
        const matchedProductId = catalogProductId ?? (!row.sku ? existingProductIdByName.get(nameMatchKey) ?? null : null);

        return {
          id: matchedProductId,
          store_id: branchId,
          category_id: row.category ? categoryByName.get(normalizeText(row.category))?.id ?? null : null,
          external_id: row.sku ?? (matchedProductId ? `CAT-${matchedProductId}` : null),
          name: row.name,
          description: row.description,
          price: row.price,
          unit: row.unit,
          ...(controlsStock ? { stock_quantity: row.stock } : {}),
          badge: row.badge,
          is_active: row.isActive,
          updated_at: new Date().toISOString(),
        };
      });
      const rowsWithId = productRows.filter((row) => row.id);
      const rowsWithSku = productRows
        .filter((row) => !row.id && row.external_id)
        .map(({ id: _id, ...row }) => row);
      const rowsWithoutSku = productRows
        .filter((row) => !row.id && !row.external_id)
        .map(({ id: _id, external_id: _externalId, ...row }) => row);

      for (const rows of chunkRows(rowsWithId)) {
        const { error } = await supabase.from("products").upsert(rows, { onConflict: "id" });
        if (error) throw error;
      }
      for (const rows of chunkRows(rowsWithSku)) {
        const { error } = await supabase.from("products").upsert(rows, { onConflict: "store_id,external_id" });
        if (error) throw error;
      }
      for (const rows of chunkRows(rowsWithoutSku)) {
        const { error } = await supabase.from("products").insert(rows);
        if (error) throw error;
      }

      for (const group of importedAdditionGroups) {
        const { error } = await supabase.from("option_groups").upsert({
          store_id: branchId,
          name: group.name,
          min_selections: group.required ? 1 : 0,
          max_selections: group.max,
          sort_order: group.sortOrder,
          is_active: group.isActive,
        }, { onConflict: "store_id,name" });
        if (error) throw error;
      }

      if (importedOptionRows.length) {
        const { data: currentProducts, error: currentProductsError } = await supabase.from("products").select("id, name, external_id").eq("store_id", branchId);
        if (currentProductsError) throw currentProductsError;
        const productByName = new Map((currentProducts ?? []).map((product) => [normalizeText(product.name), product.id]));
        const unknownProducts = [...new Set(importedOptionRows.map((row) => row.product).filter((name) => !productByName.has(normalizeText(name))))];
        if (unknownProducts.length) throw new Error(`Produto(s) não encontrado(s) na aba Opcionais: ${unknownProducts.slice(0, 4).join(", ")}.`);
        const groupedOptions = new Map<string, CatalogImportOptionRow[]>();
        const groupConfigByName = new Map(importedAdditionGroups.map((group) => [normalizeText(group.name), group]));
        for (const row of importedOptionRows) groupedOptions.set(normalizeText(row.group), [...(groupedOptions.get(normalizeText(row.group)) ?? []), row]);
        for (const rows of groupedOptions.values()) {
          const first = rows[0];
          const groupConfig = groupConfigByName.get(normalizeText(first.group));
          const { data: group, error: groupError } = await supabase.from("option_groups").upsert({
            store_id: branchId,
            name: first.group,
            min_selections: (groupConfig?.required ?? first.required) ? 1 : 0,
            max_selections: Math.max(1, groupConfig?.max ?? first.max),
            sort_order: groupConfig?.sortOrder ?? first.sortOrder,
            is_active: groupConfig?.isActive ?? true,
          }, { onConflict: "store_id,name" }).select("id").single();
          if (groupError || !group) throw groupError ?? new Error("Não foi possível sincronizar o grupo de opcionais.");
          await supabase.from("option_group_items").delete().eq("group_id", group.id);
          await supabase.from("product_option_groups").delete().eq("group_id", group.id);
          const { error: itemError } = await supabase.from("option_group_items").insert(rows.map((row, index) => ({ group_id: group.id, name: row.option, price_delta: row.priceDelta, sort_order: row.sortOrder || index, is_active: row.isActive })));
          if (itemError) throw itemError;
          const productIds = [...new Set(rows.map((row) => productByName.get(normalizeText(row.product))).filter((id): id is string => Boolean(id)))];
          const { error: linkError } = await supabase.from("product_option_groups").insert(productIds.map((productId, index) => ({ product_id: productId, group_id: group.id, sort_order: index })));
          if (linkError) throw linkError;
        }
      }

      await refreshBranchCatalog(branchId);
      setMessage(`${importedRows.length} produto(s), ${requestedCategories.size} categoria(s), ${importedMeasurementUnits.length} unidade(s) e ${new Set([...importedAdditionGroups.map((group) => group.name), ...importedOptionRows.map((row) => row.group)]).size} grupo(s) de adicionais sincronizados em ${activeBranch?.name ?? "a filial"}.`);
    } catch (error) {
      setMessage(readableCatalogError(error));
    } finally {
      setImportingCatalog(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !activeBranchId || savingProduct) return;
    setSavingProduct(true);
    setMessage("");
    const uploadedPaths: string[] = [];
    try {
      const editingProduct = editingProductId ? products.find((product) => product.id === editingProductId) : null;
      if (editingProductId && !editingProduct) throw new Error("O produto selecionado não está mais disponível.");
      const uploadedImages: Array<{ path: string; url: string }> = [];
      for (const file of productImageFiles) {
        const uploaded = await uploadCatalogImage(file, "products");
        uploadedPaths.push(uploaded.path);
        uploadedImages.push(uploaded);
      }
      const productId = editingProduct?.id ?? crypto.randomUUID();
      const imageUrl = editingProduct?.image_url ?? uploadedImages[0]?.url ?? null;
      const productData = {
        category_id: productForm.categoryId || null,
        name: productForm.name.trim(),
        description: productForm.description.trim() || null,
        price: moneyInputNumber(productForm.price),
        unit: productForm.unit.trim() || null,
        ...(activeControlsStock ? { stock_quantity: productForm.stock ? Number(productForm.stock.replace(",", ".")) : null } : {}),
        image_url: imageUrl,
        badge: productForm.badge.trim() || null,
        is_active: editingProduct?.is_active ?? true,
        updated_at: new Date().toISOString(),
      };
      let error;
      if (editingProduct) {
        ({ error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id)
          .eq("store_id", activeBranchId));
      } else {
        ({ error } = await supabase.from("products").insert({
          id: productId,
          store_id: activeBranchId,
          external_id: `CAT-${productId}`,
          ...productData,
        }));
      }
      if (error) throw error;

      const existingImages = editingProduct?.product_images ?? [];
      const hasLegacyImage = existingImages.some((image) => image.id === "legacy");
      if (editingProduct?.image_url && hasLegacyImage) {
        const { error: legacyError } = await supabase.from("product_images").insert({ product_id: productId, store_id: activeBranchId, image_url: editingProduct.image_url, sort_order: 0 });
        if (legacyError) throw legacyError;
      }
      const nextImageSortOrder = hasLegacyImage
        ? 1
        : existingImages.reduce((highest, image) => Math.max(highest, image.sort_order), -1) + 1;
      if (uploadedImages.length) {
        const { error: galleryError } = await supabase.from("product_images").insert(uploadedImages.map((image, index) => ({ product_id: productId, store_id: activeBranchId, image_url: image.url, sort_order: nextImageSortOrder + index })));
        if (galleryError) throw galleryError;
      }

      const wasEditing = Boolean(editingProduct);
      resetProductEditor();
      await refreshBranchCatalog(activeBranchId);
      setCatalogEditorMode(null);
      setMessage(wasEditing ? "Produto atualizado no catálogo e pronto para a próxima exportação." : "Produto adicionado ao catálogo.");
    } catch (error) {
      if (uploadedPaths.length) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove(uploadedPaths);
      setMessage(error instanceof Error ? error.message : `Não foi possível ${editingProductId ? "atualizar" : "adicionar"} o produto.`);
    } finally {
      setSavingProduct(false);
    }
  }

  function openQuickProductImage(productId: string) {
    if (uploadingProductImageId) return;
    quickProductImageTargetRef.current = productId;
    if (quickProductImageInputRef.current) {
      quickProductImageInputRef.current.value = "";
      quickProductImageInputRef.current.click();
    }
  }

  async function updateQuickProductImage(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    const productId = quickProductImageTargetRef.current;
    const product = products.find((item) => item.id === productId);
    if (!selectedFiles.length || !product || !supabase || !activeBranchId || uploadingProductImageId) return;

    const invalidFile = selectedFiles.find((file) => validateCatalogImage(file));
    if (invalidFile) {
      setMessage(validateCatalogImage(invalidFile));
      return;
    }
    const existingImages = product.product_images ?? [];
    const remaining = Math.max(0, activeProductImageLimit - existingImages.length);
    if (!remaining) {
      setMessage(`${product.name} já possui o limite de ${activeProductImageLimit} foto(s). Edite o produto para remover uma foto.`);
      return;
    }
    const files = selectedFiles.slice(0, remaining);

    setUploadingProductImageId(productId);
    setMessage(`Enviando ${files.length} foto(s) de ${product.name}...`);
    const uploadedPaths: string[] = [];
    try {
      const uploadedImages: Array<{ path: string; url: string }> = [];
      for (const file of files) {
        const uploaded = await uploadCatalogImage(file, "products");
        uploadedPaths.push(uploaded.path);
        uploadedImages.push(uploaded);
      }
      const hasLegacyImage = existingImages.some((image) => image.id === "legacy");
      if (product.image_url && hasLegacyImage) {
        const { error } = await supabase.from("product_images").insert({ product_id: productId, store_id: activeBranchId, image_url: product.image_url, sort_order: 0 });
        if (error) throw error;
      }
      const nextSortOrder = hasLegacyImage ? 1 : existingImages.reduce((highest, image) => Math.max(highest, image.sort_order), -1) + 1;
      const { error: galleryError } = await supabase.from("product_images").insert(uploadedImages.map((image, index) => ({ product_id: productId, store_id: activeBranchId, image_url: image.url, sort_order: nextSortOrder + index })));
      if (galleryError) throw galleryError;
      const productUpdate = {
        updated_at: new Date().toISOString(),
        ...(!product.image_url ? { image_url: uploadedImages[0].url } : {}),
      };
      const { error: productUpdateError } = await supabase.from("products").update(productUpdate).eq("id", productId).eq("store_id", activeBranchId);
      if (productUpdateError) throw productUpdateError;
      await refreshBranchCatalog(activeBranchId);
      setMessage(`${uploadedImages.length} foto(s) adicionada(s) a ${product.name}.${selectedFiles.length > remaining ? ` O limite da filial é ${activeProductImageLimit}.` : ""}`);
    } catch (error) {
      if (uploadedPaths.length) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove(uploadedPaths);
      setMessage(error instanceof Error ? `Não foi possível atualizar a foto: ${error.message}` : "Não foi possível atualizar a foto do produto.");
    } finally {
      setUploadingProductImageId("");
      quickProductImageTargetRef.current = "";
    }
  }

  function removeSelectedProductImage(index: number) {
    setProductImageFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setProductImagePreviews((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (productImageInputRef.current) productImageInputRef.current.value = "";
  }

  async function removeExistingProductImage(product: Product, image: ProductImage) {
    if (!supabase || !activeBranchId || !window.confirm("Remover esta foto do produto?")) return;
    setSavingProduct(true);
    setMessage("");
    const remainingImages = (product.product_images ?? []).filter((item) => item.id !== image.id);
    const nextPrimaryImage = remainingImages[0]?.image_url ?? null;
    const result = image.id === "legacy"
      ? await supabase.from("products").update({ image_url: nextPrimaryImage, updated_at: new Date().toISOString() }).eq("id", product.id).eq("store_id", activeBranchId)
      : await supabase.from("product_images").delete().eq("id", image.id).eq("store_id", activeBranchId);
    if (result.error) {
      setMessage(result.error.message);
      setSavingProduct(false);
      return;
    }
    if (image.id !== "legacy") {
      const productUpdate = {
        updated_at: new Date().toISOString(),
        ...(product.image_url === image.image_url ? { image_url: nextPrimaryImage } : {}),
      };
      const { error } = await supabase.from("products").update(productUpdate).eq("id", product.id).eq("store_id", activeBranchId);
      if (error) {
        setMessage(error.message);
        setSavingProduct(false);
        return;
      }
    }
    const imagePath = storagePathFromPublicUrl(image.image_url);
    if (imagePath) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove([imagePath]);
    await refreshBranchCatalog(activeBranchId);
    setSavingProduct(false);
    setMessage("Foto removida do produto.");
  }

  // Nome e preço alterados direto no card, sem abrir o formulário.
  async function updateProductQuick(productId: string, patch: QuickProductPatch) {
    if (!supabase || !activeBranchId) return false;
    const product = products.find((item) => item.id === productId);
    if (!product) return false;
    const name = patch.name?.trim();
    const update = {
      ...(name ? { name } : {}),
      ...(patch.price !== undefined && Number.isFinite(patch.price) && patch.price >= 0 ? { price: patch.price } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("products").update(update).eq("id", productId).eq("store_id", activeBranchId);
    if (error) {
      setMessage(error.message);
      return false;
    }
    setProducts((current) => current.map((item) => item.id === productId ? { ...item, ...update } : item));
    setMessage(`${name ?? product.name} atualizado.`);
    return true;
  }

  // Foto da loja trocada direto no editor: grava na hora, sem passar pela aba de aparência.
  async function replaceCompanyLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file || !supabase || !tenant || savingCompanyLogo) return;
    const validationMessage = validateCatalogImage(file);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    const uploadBranchId = branches[0]?.id;
    if (!uploadBranchId) {
      setMessage("Cadastre uma filial antes de enviar a foto da loja.");
      return;
    }
    setSavingCompanyLogo(true);
    setMessage("Enviando a foto da loja...");
    let uploadedPath = "";
    try {
      const uploaded = await uploadCatalogImage(file, "company-profile", uploadBranchId);
      uploadedPath = uploaded.path;
      const previousPath = storagePathFromPublicUrl(tenant.profile_image_url ?? companyIdentity.profileImageUrl);
      const { error } = await supabase.from("tenants").update({ profile_image_url: uploaded.url }).eq("id", tenant.id).select("id").single();
      if (error) throw new Error(/JSON object requested|0 rows/i.test(error.message) ? "Sem permissão para trocar a foto da loja." : error.message);
      uploadedPath = "";
      if (previousPath && previousPath !== uploaded.path) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove([previousPath]);
      const updateTenant = (item: Tenant) => item.id === tenant.id ? { ...item, profile_image_url: uploaded.url } : item;
      setTenant((current) => current ? updateTenant(current) : current);
      setAdminTenants((current) => current.map(updateTenant));
      setCompanyIdentity((current) => ({ ...current, profileImageUrl: uploaded.url }));
      setMessage("Foto da loja atualizada.");
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove([uploadedPath]);
      const errorMessage = error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? "");
      setMessage(errorMessage || "Não foi possível trocar a foto da loja.");
    } finally {
      setSavingCompanyLogo(false);
    }
  }

  async function toggleProductStatus(product: Product) {
    if (!supabase || !activeBranchId || updatingProductStatusId || deletingProductId) return;
    const nextStatus = !product.is_active;
    setUpdatingProductStatusId(product.id);
    setMessage("");
    const { error } = await supabase
      .from("products")
      .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", product.id)
      .eq("store_id", activeBranchId);

    if (error) {
      setMessage(error.message);
    } else {
      await refreshBranchCatalog(activeBranchId);
      setMessage(`${product.name} foi ${nextStatus ? "ativado" : "desativado"}.`);
    }
    setUpdatingProductStatusId("");
  }

  async function deleteProduct(product: Product) {
    if (!supabase || !activeBranchId || deletingProductId) return;
    if (!window.confirm(`Excluir definitivamente "${product.name}"? Esta ação não pode ser desfeita.`)) return;

    setDeletingProductId(product.id);
    setMessage("");
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id)
      .eq("store_id", activeBranchId);

    if (error) {
      setMessage(error.message);
      setDeletingProductId("");
      return;
    }

    const imagePaths = [...new Set([product.image_url, ...(product.product_images ?? []).map((image) => image.image_url)])]
      .map((imageUrl) => storagePathFromPublicUrl(imageUrl))
      .filter((path): path is string => Boolean(path));
    const storageResult = imagePaths.length
      ? await supabase.storage.from(CATALOG_IMAGE_BUCKET).remove(imagePaths)
      : { error: null };

    setProducts((current) => current.filter((item) => item.id !== product.id));
    if (editingProductId === product.id) {
      resetProductEditor();
      setCatalogEditorMode(null);
    }
    setMessage(storageResult.error
      ? "Produto excluído, mas algumas fotos não puderam ser removidas do armazenamento."
      : "Produto excluído definitivamente.");
    setDeletingProductId("");
  }

  const activeBranch = useMemo(() => branches.find((branch) => branch.id === activeBranchId), [branches, activeBranchId]);
  const editingProduct = useMemo(() => products.find((product) => product.id === editingProductId) ?? null, [products, editingProductId]);
  const activeProductCount = useMemo(() => products.filter((product) => product.is_active).length, [products]);
  const productCountByCategoryId = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => {
      if (product.category_id) counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    });
    return counts;
  }, [products]);
  const visibleCategories = useMemo(() => categories.filter((category) => normalizeText(category.name).includes(normalizeText(categoryQuery))), [categories, categoryQuery]);
  const visibleAdditionGroups = useMemo(() => optionGroups.filter((group) => normalizeText(group.name).includes(normalizeText(additionGroupQuery))), [optionGroups, additionGroupQuery]);
  const visibleMeasurementUnits = useMemo(() => measurementUnits.filter((unit) => normalizeText(`${unit.code} ${unit.name}`).includes(normalizeText(measurementUnitQuery))), [measurementUnits, measurementUnitQuery]);
  const visibleProducts = useMemo(() => products.filter((product) => normalizeText(product.name).includes(normalizeText(productQuery))), [products, productQuery]);
  const showAdditionGroupsCatalog = activeEnablesAdditions || optionGroups.length > 0;
  const editingProductImages = editingProduct?.product_images ?? [];
  const productEditorImageCount = editingProductImages.length + productImageFiles.length;
  const productUnitIsRegistered = !productForm.unit || measurementUnits.some((unit) => normalizeText(unit.name) === normalizeText(productForm.unit));

  function renderMeasurementUnitRow(unit: MeasurementUnit) {
    const linkedProductCount = measurementUnitUsage[unit.id] ?? 0;
    const canDelete = measurementUnitUsageReady && linkedProductCount === 0;
    const usageLabel = !measurementUnitUsageReady
      ? "Verificando vínculos..."
      : linkedProductCount === 1
        ? "1 produto vinculado"
        : linkedProductCount > 1
          ? `${linkedProductCount} produtos vinculados`
          : "Nenhum produto vinculado";
    return (
      <div className="admin-list-row measurement-unit-row" key={unit.id}>
        <div className="catalog-entity-info"><strong>{unit.code}</strong><small>{unit.name}</small><small>{usageLabel}</small></div>
        <button
          className="category-delete-button"
          type="button"
          title={canDelete ? "Excluir unidade" : measurementUnitUsageReady ? "Remova ou altere os produtos vinculados antes de excluir" : "Aguarde a verificação dos vínculos"}
          aria-label={canDelete ? `Excluir unidade ${unit.name}` : `Não é possível excluir ${unit.name}: ${usageLabel.toLowerCase()}`}
          disabled={!canDelete || Boolean(deletingMeasurementUnitId)}
          onClick={() => deleteMeasurementUnit(unit)}
        >
          <Trash2 size={17} />
        </button>
      </div>
    );
  }

  if (loading) return <main className="admin-page"><p>Carregando painel...</p></main>;
  if (accessDenied) return <AdminDenied />;
  if (!session) return <LoginRedirect />;

  const routeTenantId = route.view === "section" ? route.tenantId : undefined;
  const sectionRouteFor = (section: PortalSection, tab?: SettingsTab): PortalRoute => ({ view: "section", section, tenantId: routeTenantId, tab });
  const waitingAdminTenant = portalMode === "admin" && route.view === "section" && tenant?.id !== route.tenantId;
  const pageTitle = route.view === "companies" ? "Empresas" : route.view === "new-company" ? "Nova empresa" : route.view === "requests" ? "Solicitações" : sectionLabel(portalMode, route.section);
  const pageContext = route.view === "section" ? tenant?.name : "Administração";
  const branchLayoutMode = branchCatalogLayouts[activeBranchId];
  // Com as configurações abertas nesta sessão vale o que está nelas (pode ter acabado de ser salvo); senão, o lido da filial.
  const editorCatalogLayout = settingsLoadedTenantId !== tenant?.id ? activeCatalogLayout : !branchLayoutMode || branchLayoutMode === "inherit" ? companyCatalogLayout : branchLayoutMode;
  const editorProducts: EditorProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    unit: product.unit,
    badge: product.badge,
    categoryId: product.category_id,
    isActive: product.is_active,
    imageUrl: product.product_images?.[0]?.image_url ?? product.image_url,
    imageCount: product.product_images?.length ?? (product.image_url ? 1 : 0),
  }));
  const findProduct = (productId: string) => products.find((product) => product.id === productId);

  return (
    <main className="portal-page">
      <PortalSidebar
        mode={portalMode}
        route={route}
        tenantName={tenant?.name}
        tenantId={routeTenantId}
        branches={branches}
        activeBranchId={activeBranchId}
        email={session.user.email ?? ""}
        onNavigate={goTo}
        onBranchChange={(branchId) => { setActiveBranchId(branchId); setMessage(""); }}
        onSignOut={() => void supabase?.auth.signOut()}
      />
      <div className="portal-main">
        {routeSection !== "loja" ? <PortalHeader title={pageTitle} context={pageContext} /> : null}
        {routeSection === "configuracoes" ? (
          <PortalTabs mode={portalMode} label="Assuntos das configurações" tabs={settingsTabs(portalMode).map((id) => ({ id, label: settingsTabLabel(id, portalMode) }))} active={activeSettingsTab} routeFor={(tab) => sectionRouteFor("configuracoes", tab)} onNavigate={goTo} />
        ) : null}

        {isBusinessPortal && myCompanyStatus ? <TrialBanner status={myCompanyStatus} /> : null}
        {/* Loja criada pelo cadastro ou pelo admin nasce sem localização: sem ela não há distância nem taxa de entrega. */}
        {tenant && activeBranch && activeBranch.latitude == null && !(routeSection === "configuracoes" && activeSettingsTab === "dados") ? (
          <p className="company-location-banner">Confirme o endereço de {activeBranch.name} no mapa para calcular a distância e a taxa de entrega. <button className="admin-link" type="button" onClick={() => goTo(sectionRouteFor("configuracoes", "dados"))}>Confirmar endereço</button></p>
        ) : null}
        {waitingAdminTenant ? (
          <p className="admin-muted">Carregando empresa...</p>
        ) : portalMode === "admin" && route.view === "companies" ? (
          <AdminCompanies tenants={adminTenants} branches={adminBranches} statuses={companyStatuses} onStatusChanged={() => void reloadCompanyStatuses()} onOpenRequests={() => goTo({ view: "requests" })} onOpenCatalog={(tenantId) => goTo({ view: "section", section: "loja", tenantId })} onOpenSettings={(tenantId) => goTo({ view: "section", section: "configuracoes", tenantId, tab: "resumo" })} />
        ) : portalMode === "admin" && route.view === "requests" ? (
          <CompanyRequests onApproved={() => { void loadWorkspace(session.user.id); void reloadCompanyStatuses(); }} onCreateManually={() => goTo({ view: "new-company" })} />
        ) : isBusinessPortal && myCompanyStatus && !myCompanyStatus.is_active ? (
          <CompanySuspendedNotice status={myCompanyStatus} />
        ) : !tenant && isBusinessPortal ? (
          <section className="admin-form-panel access-denied-panel"><h2>Sem acesso a este painel</h2><p>Esta conta não tem acesso a esta área. Veja os acessos liberados para ela.</p><a className="admin-primary" href="/acesso?trocar=1">Ver meus acessos</a><button className="admin-link" type="button" onClick={() => supabase?.auth.signOut()}>Entrar com outra conta</button></section>
        ) : route.view === "new-company" || !tenant ? (
          <NewCompanyForm
            fields={newCompanyFields}
            errors={newCompanyErrors}
            account={newCompanyAccount}
            trialDays={newCompanyTrialDays}
            busy={creatingCompany}
            onFieldChange={(key, value) => { setNewCompanyFields((current) => ({ ...current, [key]: value })); setNewCompanyErrors((current) => ({ ...current, [key]: undefined })); }}
            onAccountChange={setNewCompanyAccount}
            onTrialDaysChange={setNewCompanyTrialDays}
            onSubmit={createCompany}
          />
        ) : isCompanyPortal && (activeSettingsTab === "mesas" || activeSettingsTab === "equipe") && routeSection === "configuracoes" ? (
          <CompanyOperations
            section={activeSettingsTab === "equipe" ? "team" : "tables"}
            tenant={tenant}
            branches={branches}
            activeBranchId={activeBranchId}
            onBranchChange={setActiveBranchId}
          />
        ) : routeSection === "configuracoes" && activeSettingsTab === "filiais" ? (
          <div className="portal-stack">
            <section className="admin-form-panel settings-branch-list">
              <h2>Filiais da empresa</h2>
              <ul>
                {branches.map((branch) => (
                  <li key={branch.id}>
                    <span><strong>{branch.name}</strong><small>{formatDocument(branch.cnpj ?? "", detectDocumentKind(branch.cnpj)) || "Sem documento"} · {branch.is_active === false ? "Fora do catálogo" : "No catálogo"}</small></span>
                    <span className="settings-branch-actions">
                      <button className="admin-secondary" type="button" onClick={() => { setActiveBranchId(branch.id); goTo(sectionRouteFor("configuracoes", "dados")); }}>Dados</button>
                      <button className="admin-secondary" type="button" onClick={() => { setActiveBranchId(branch.id); goTo(sectionRouteFor("loja")); }}>Abrir loja</button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
              <form className="admin-form-panel branch-create-panel" onSubmit={createBranch}>
                <h2>Nova filial</h2>
                <div className="admin-form-grid">
                  <label>Nome da filial<input value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} placeholder="Ex.: Unidade Centro" required /></label>
                  <DocumentField label="Documento da filial" value={branchForm.cnpj} onChange={(cnpj) => setBranchForm({ ...branchForm, cnpj })} />
                  <label>WhatsApp<input value={branchForm.phone} onChange={(event) => setBranchForm({ ...branchForm, phone: formatWhatsapp(event.target.value) })} placeholder="(63) 99999-9999" inputMode="tel" required /></label>
                </div>
                <BranchCoverNoteEditor
                  note={branchForm.coverNote}
                  onNoteChange={(coverNote) => setBranchForm({ ...branchForm, coverNote })}
                />
                <BranchLocationPicker
                  value={branchForm}
                  locating={locatingBranchForm === "branch"}
                  validating={validatingBranchAddress === "branch"}
                  issue={locationIssue?.target === "branch" ? locationIssue.message : ""}
                  onAddressChange={(address) => updateBranchAddress("branch", address)}
                  onUseCurrent={() => captureBranchLocation("branch")}
                  onValidate={() => validateBranchAddress("branch")}
                />
                <div className="admin-form-actions"><button className="admin-primary" type="submit" disabled={savingBranch}><Plus size={16} /> {savingBranch ? "Criando..." : "Criar filial"}</button></div>
              </form>
          </div>
        ) : routeSection === "configuracoes" && activeSettingsTab === "dados" ? (
          activeBranch ? (
            <BranchDetailsEditor branch={activeBranch} coverUrl={coverImagePreview || activeBranch.cover_image_url || ""} details={branchDetailsForm} businessHours={branchBusinessHours[activeBranch.id]} location={branchLocationForm} locating={locatingBranchForm === "existing"} validatingLocation={validatingBranchAddress === "existing"} saving={savingBranchDetails} issue={locationIssue?.target === "existing" ? locationIssue.message : ""} onDetailsChange={setBranchDetailsForm} onBusinessHoursChange={(config) => setBranchBusinessHours((current) => ({ ...current, [activeBranch.id]: config }))} onAddressChange={(address) => updateBranchAddress("existing", address)} onCaptureLocation={() => captureBranchLocation("existing")} onValidateLocation={() => validateBranchAddress("existing")} onSubmit={saveBranchDetails} />
          ) : <p className="admin-muted">Nenhuma filial encontrada.</p>
        ) : routeSection === "configuracoes" && routeNeedsSettings && settingsLoadedTenantId !== tenant.id ? (
          loadingSettings || settingsRequestRef.current !== tenant.id ? <p className="admin-muted">Carregando configurações...</p> : (
            <section className="admin-form-panel">
              <p>Não foi possível carregar as configurações desta empresa. Nada foi alterado.</p>
              <div className="admin-form-actions"><button className="admin-primary" type="button" onClick={() => void openCompanySettings(tenant.id)}><RefreshCw size={16} /> Tentar novamente</button></div>
            </section>
          )
        ) : routeSection === "configuracoes" ? (
          <section className="company-settings-view">
            <div className="company-settings-content">
                {companySettingsSection === "overview" ? (
                  <div className="settings-overview">
                    <dl className="settings-summary">
                      <div><dt>Filiais</dt><dd>{branches.length}</dd></div>
                      {portalMode === "admin" ? <div><dt>Acesso principal</dt><dd>{loadingSettings ? "Carregando..." : accessForm.email || "Não configurado"}</dd></div> : null}
                      <div><dt>Taxa de entrega</dt><dd>{companyCalculatesDeliveryFee ? companyDeliveryFeeType === "fixed" ? "Taxa fixa" : "Por km" : "A combinar"}</dd></div>
                      <div><dt>Pedidos</dt><dd>{orderModeLabel(companyOrderMode)}</dd></div>
                    </dl>
                    <CompanyAvailabilityPanel
                      companyName={tenant.name}
                      companyActive={companyIdentity.isActive}
                      branches={branches}
                      saving={savingAvailability}
                      onCompanyChange={updateCompanyAvailability}
                      onBranchChange={updateBranchAvailability}
                    />
                  </div>
                ) : null}
                {companySettingsSection === "identity" ? (
                  <form className="admin-form-panel company-settings-panel company-identity-panel" onSubmit={saveCompanyIdentity}>
                    <div className="settings-panel-heading"><h2>Marca</h2><p>Usada em todos os catálogos da empresa.</p></div>
                    <div className="company-profile-field">
                      <div className="company-profile-preview" style={{ "--company-color": companyIdentity.themeColor } as CSSProperties}>{companyProfilePreview || companyIdentity.profileImageUrl ? <img src={companyProfilePreview || companyIdentity.profileImageUrl} alt={`Foto de ${tenant.name}`} /> : <Building2 size={30} />}</div>
                      <div><strong>Foto de perfil</strong><small>JPG, PNG ou WebP · máximo 5 MB</small><div className="company-profile-actions"><button className="admin-secondary" type="button" onClick={() => companyProfileInputRef.current?.click()} disabled={savingCompanyIdentity}><ImagePlus size={16} /> Escolher foto</button>{!companyProfileFile && companyIdentity.profileImageUrl ? <button className="icon-button" type="button" title="Remover foto" aria-label="Remover foto da empresa" onClick={removeCompanyProfileImage} disabled={savingCompanyIdentity}><Trash2 size={17} /></button> : null}</div><input ref={companyProfileInputRef} className="catalog-import-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectCompanyProfileImage} /></div>
                    </div>
                    <label className="company-color-field"><span>Cor principal do tema</span><div><input type="color" value={companyIdentity.themeColor} onChange={(event) => { setCompanyIdentity({ ...companyIdentity, themeColor: event.target.value }); setCompanyIdentityFeedback(null); }} aria-label="Cor principal do tema" /><strong>{companyIdentity.themeColor.toUpperCase()}</strong><span className="company-color-sample" style={{ background: companyIdentity.themeColor }}>Marca</span></div><small>Aplicada no cabeçalho, botões e destaques do catálogo.</small></label>
                    {companyIdentityFeedback ? <p className={`identity-save-feedback ${companyIdentityFeedback.status}`} role={companyIdentityFeedback.status === "error" ? "alert" : "status"} aria-live="polite">{companyIdentityFeedback.status === "success" ? <CheckCircle2 size={18} /> : companyIdentityFeedback.status === "error" ? <TriangleAlert size={18} /> : <RefreshCw className="spinning" size={18} />}<span>{companyIdentityFeedback.message}</span></p> : null}
                    <div className="admin-form-actions"><button className="admin-primary" type="submit" disabled={savingCompanyIdentity}><Save size={16} /> {savingCompanyIdentity ? "Salvando..." : "Salvar identidade"}</button></div>
                  </form>
                ) : null}
                {companySettingsSection === "access" && isCompanyPortal ? (
                  <CompanyPasswordForm email={session.user.email ?? ""} />
                ) : companySettingsSection === "access" ? (
                  <form className="admin-form-panel company-settings-panel" onSubmit={saveCompanyAccess}>
                    <div className="settings-panel-heading"><h2>Acesso da empresa</h2><p>Login usado pelo responsável para administrar todas as filiais.</p></div>
                    {loadingSettings ? <p className="admin-muted">Carregando configurações...</p> : <>
                      <label>Nome do responsável<input value={accessForm.name} onChange={(event) => setAccessForm({ ...accessForm, name: event.target.value })} required /></label>
                      <label>E-mail de acesso<input type="email" value={accessForm.email} onChange={(event) => setAccessForm({ ...accessForm, email: event.target.value })} required /></label>
                      <label>Nova senha<input type="password" minLength={6} value={accessForm.password} onChange={(event) => setAccessForm({ ...accessForm, password: event.target.value })} placeholder="Deixe em branco para manter a senha atual" /></label>
                      <div className="admin-form-actions"><button className="admin-primary" type="submit" disabled={savingAccess}><Save size={16} /> {savingAccess ? "Salvando..." : "Salvar acesso"}</button></div>
                    </>}
                  </form>
                ) : null}
                {companySettingsSection === "parameters" ? (
                  <ParameterWorkspace
                    key={tenant.id}
                    tenant={tenant}
                    isCompanyPortal={isCompanyPortal}
                    branches={branches}
                    activeBranchId={activeBranchId}
                    scope={parameterScope}
                    companyEnabled={companyCalculatesDeliveryFee}
                    branchModes={branchFreightModes}
                    companyDeliveryFeeType={companyDeliveryFeeType}
                    branchDeliveryFeeTypeModes={branchDeliveryFeeTypeModes}
                    branchFees={branchDeliveryFees}
                    companyCatalogLayout={companyCatalogLayout}
                    branchCatalogLayouts={branchCatalogLayouts}
                    companyProductImageLimit={companyProductImageLimit}
                    branchProductImageLimits={branchProductImageLimits}
                    companyControlsStock={companyControlsStock}
                    branchStockControlModes={branchStockControlModes}
                    companyEnablesAdditions={companyEnablesAdditions}
                    branchAdditionsModes={branchAdditionsModes}
                    companyOrderMode={companyOrderMode}
                    branchOrderModes={branchOrderModes}
                    companyCompactInternalCatalog={companyCompactInternalCatalog}
                    branchCompactInternalCatalogModes={branchCompactInternalCatalogModes}
                    companyPrintMode={companyPrintMode}
                    branchPrintModes={branchPrintModes}
                    branchBusinessHours={branchBusinessHours}
                    generatingPrintInstallerId={generatingPrintInstallerId}
                    loading={loadingSettings}
                    saving={savingParameters}
                    onScopeChange={setParameterScope}
                    onBranchChange={(branchId) => { setActiveBranchId(branchId); setParameterScope("branch"); setMessage(""); }}
                    onCompanyEnabledChange={setCompanyCalculatesDeliveryFee}
                    onBranchModeChange={(branchId, mode) => setBranchFreightModes((current) => ({ ...current, [branchId]: mode }))}
                    onCompanyDeliveryFeeTypeChange={setCompanyDeliveryFeeType}
                    onBranchDeliveryFeeTypeModeChange={(branchId, mode) => setBranchDeliveryFeeTypeModes((current) => ({ ...current, [branchId]: mode }))}
                    onBranchFeeChange={(branchId, fee) => setBranchDeliveryFees((current) => ({ ...current, [branchId]: fee }))}
                    onCompanyCatalogLayoutChange={setCompanyCatalogLayout}
                    onBranchCatalogLayoutChange={(branchId, mode) => setBranchCatalogLayouts((current) => ({ ...current, [branchId]: mode }))}
                    onCompanyProductImageLimitChange={setCompanyProductImageLimit}
                    onBranchProductImageLimitChange={(branchId, mode) => setBranchProductImageLimits((current) => ({ ...current, [branchId]: mode }))}
                    onCompanyControlsStockChange={setCompanyControlsStock}
                    onBranchStockControlModeChange={(branchId, mode) => setBranchStockControlModes((current) => ({ ...current, [branchId]: mode }))}
                    onCompanyEnablesAdditionsChange={setCompanyEnablesAdditions}
                    onBranchAdditionsModeChange={(branchId, mode) => setBranchAdditionsModes((current) => ({ ...current, [branchId]: mode }))}
                    onCompanyOrderModeChange={setCompanyOrderMode}
                    onBranchOrderModeChange={(branchId, mode) => setBranchOrderModes((current) => ({ ...current, [branchId]: mode }))}
                    onCompanyCompactInternalCatalogChange={setCompanyCompactInternalCatalog}
                    onBranchCompactInternalCatalogModeChange={(branchId, mode) => setBranchCompactInternalCatalogModes((current) => ({ ...current, [branchId]: mode }))}
                    onCompanyPrintModeChange={setCompanyPrintMode}
                    onBranchPrintModeChange={(branchId, mode) => setBranchPrintModes((current) => ({ ...current, [branchId]: mode }))}
                    onBranchBusinessHoursChange={(branchId, config) => setBranchBusinessHours((current) => ({ ...current, [branchId]: config }))}
                    onDownloadPrintAgentInstaller={(branch) => void downloadPrintAgentInstaller(branch)}
                    onSaveCompany={saveCompanyParameters}
                    onSaveBranch={saveBranchParameters}
                    onDiscard={() => openCompanySettings(tenant.id)}
                  />
                ) : null}
                {companySettingsSection === "danger" ? (
                  <section className="admin-form-panel company-settings-panel danger-zone">
                    <div className="settings-panel-heading"><h2>Excluir empresa</h2><p>Remove definitivamente a empresa, as filiais, os produtos, os pedidos e o acesso. Não dá para desfazer.</p></div>
                    {showDeleteCompany ? <>
                      <label>Digite <strong>{tenant.name}</strong> para confirmar<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></label>
                      <div className="admin-form-actions"><button className="admin-secondary" type="button" onClick={() => { setShowDeleteCompany(false); setDeleteConfirmation(""); }}>Cancelar</button><button className="admin-danger" type="button" disabled={deletingCompany || deleteConfirmation.trim() !== tenant.name} onClick={deleteCompany}><Trash2 size={16} /> {deletingCompany ? "Excluindo..." : "Excluir definitivamente"}</button></div>
                    </> : <button className="admin-danger" type="button" onClick={() => setShowDeleteCompany(true)}><Trash2 size={16} /> Excluir empresa</button>}
                  </section>
                ) : null}
            </div>
          </section>
        ) : (
          <>
            <StoreEditor
              companyName={tenant.name}
              branchName={activeBranch?.name ?? ""}
              themeColor={companyThemeColor(tenant.theme_color)}
              logoUrl={tenant.profile_image_url ?? null}
              coverUrl={coverImagePreview || activeBranch?.cover_image_url || null}
              coverPending={Boolean(coverImageFile)}
              savingCover={uploadingCover}
              savingLogo={savingCompanyLogo}
              canEditLogo={!isBranchPortal}
              categories={categories}
              products={editorProducts}
              imageLimit={activeProductImageLimit}
              busyProductId={updatingProductStatusId || deletingProductId || uploadingProductImageId}
              catalogLayout={editorCatalogLayout}
              publicUrl={activeBranch ? branchOrderPath(activeBranch, "whatsapp") : "/"}
              settingsHref={portalPath(portalMode, sectionRouteFor("configuracoes", "dados"))}
              onOpenSettings={() => goTo(sectionRouteFor("configuracoes", "dados"))}
              tools={<>
                <button className="admin-secondary" type="button" onClick={() => importInputRef.current?.click()} disabled={!activeBranchId || importingCatalog || exportingCatalog}><Upload size={16} /> {importingCatalog ? "Importando..." : "Importar planilha"}</button>
                <button className="admin-secondary" type="button" onClick={downloadCatalogTemplate} disabled={!activeBranchId || importingCatalog || exportingCatalog}><Download size={16} /> {exportingCatalog ? "Exportando..." : "Exportar planilha"}</button>
              </>}
              onPickCover={() => coverImageInputRef.current?.click()}
              onSaveCover={() => void saveBranchCover()}
              onCancelCover={() => { setCoverImageFile(null); setCoverImagePreview(""); if (coverImageInputRef.current) coverImageInputRef.current.value = ""; }}
              onRemoveCover={() => { if (window.confirm("Remover a capa da loja?")) void removeBranchCover(); }}
              onPickLogo={() => companyLogoInputRef.current?.click()}
              onAddProduct={(categoryId) => openNewProductEditor(categoryId)}
              onEditProduct={(productId) => { const product = findProduct(productId); if (product) editProduct(product); }}
              onDeleteProduct={(productId) => { const product = findProduct(productId); if (product) void deleteProduct(product); }}
              onToggleProduct={(productId) => { const product = findProduct(productId); if (product) void toggleProductStatus(product); }}
              onAddPhoto={(productId) => openQuickProductImage(productId)}
              onQuickUpdate={updateProductQuick}
              onAddCategory={openCategoryEditor}
              onDeleteCategory={(categoryId) => { const category = categories.find((item) => item.id === categoryId); if (category) void deleteCategory(category); }}
            />
                <input ref={importInputRef} className="catalog-import-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importCatalog} />
                <input ref={quickProductImageInputRef} className="catalog-import-input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={updateQuickProductImage} />
            <input ref={coverImageInputRef} className="catalog-import-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectCoverImage} />
            <input ref={companyLogoInputRef} className="catalog-import-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={replaceCompanyLogo} />
            <section className="store-editor-extras" aria-label="Adicionais e unidades de medida">
               {showAdditionGroupsCatalog ? <section className="admin-form-panel catalog-structure-panel addition-groups-overview-panel">
                  <div className="catalog-panel-heading"><h2>Grupos de adicionais <span className="count-badge">{optionGroups.length}</span></h2><button className="icon-button" type="button" title="Adicionar grupo de adicionais" aria-label="Adicionar grupo de adicionais" onClick={() => { setShowOptionGroupForm(true); resetOptionGroupEditor(); }}><Plus size={18} /></button></div>
                  <label className="catalog-panel-search"><Search size={16} /><input value={additionGroupQuery} onChange={(event) => setAdditionGroupQuery(event.target.value)} placeholder="Pesquisar grupo" /></label>
                 <div className="admin-list catalog-scroll-list">{visibleAdditionGroups.map((group) => { const linkedProductCount = (group.product_option_groups ?? []).length; const canDelete = linkedProductCount === 0; return <div className="admin-list-row option-group-row" key={group.id}><div className="catalog-entity-info"><strong>{group.name}</strong><small>{group.min_selections > 0 ? "Obrigatório" : "Opcional"} · {group.option_group_items?.length ?? 0} adicional(is)</small><small>{linkedProductCount ? `${linkedProductCount} produto(s) vinculado(s)` : "Nenhum produto vinculado"}</small></div><button className="category-delete-button" type="button" disabled={!canDelete || Boolean(deletingOptionGroupId)} title={canDelete ? "Excluir grupo" : "Remova os produtos vinculados antes de excluir"} aria-label={canDelete ? `Excluir grupo ${group.name}` : `Não é possível excluir ${group.name}: existem produtos vinculados`} onClick={() => deleteOptionGroup(group)}><Trash2 size={17} /></button></div>; })}{!visibleAdditionGroups.length ? <p className="admin-muted">Nenhum grupo de adicionais encontrado.</p> : null}</div>
               </section> : null}
               <section className="admin-form-panel catalog-structure-panel measurement-units-overview-panel">
                 <div className="catalog-panel-heading"><h2>Unidades de medida <span className="count-badge">{measurementUnits.length}</span></h2><button className="icon-button" type="button" title="Adicionar unidade" aria-label="Adicionar unidade" onClick={openMeasurementUnitEditor}><Plus size={18} /></button></div>
                 <label className="catalog-panel-search"><Search size={16} /><input value={measurementUnitQuery} onChange={(event) => setMeasurementUnitQuery(event.target.value)} placeholder="Pesquisar unidade" /></label>
                 <div className="admin-list catalog-scroll-list measurement-unit-list">
                    {visibleMeasurementUnits.map(renderMeasurementUnitRow)}
                   {!visibleMeasurementUnits.length ? <p className="admin-muted">Nenhuma unidade de medida encontrada.</p> : null}
                 </div>
               </section>
            </section>
            {showOptionGroupForm ? (
              <div className="catalog-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowOptionGroupForm(false); }}>
              <section className="admin-form-panel option-group-editor-panel catalog-modal" role="dialog" aria-modal="true" aria-labelledby="option-group-editor-title">
                <div className="branch-form-heading"><div><span>Cadastro estruturado</span><h2 id="option-group-editor-title">Grupo de adicionais</h2></div><button className="icon-button" type="button" title="Fechar" aria-label="Fechar grupo de adicionais" onClick={() => setShowOptionGroupForm(false)}><X size={18} /></button></div>
                <p className="admin-muted">Exemplo: monte um grupo “Acompanhamento” e vincule-o a vários produtos. O cliente escolherá os itens no momento do pedido.</p>
                <form className="admin-product-form" onSubmit={createOptionGroup}>
                  <div className="admin-form-grid"><label>Nome do grupo<input value={optionGroupForm.name} onChange={(event) => setOptionGroupForm({ ...optionGroupForm, name: event.target.value })} placeholder="Ex.: Acompanhamento" required /></label><div className="admin-form-grid"><label>Mínimo<input type="number" min="0" value={optionGroupForm.min} onChange={(event) => setOptionGroupForm({ ...optionGroupForm, min: event.target.value })} /></label><label>Máximo<input type="number" min="1" value={optionGroupForm.max} onChange={(event) => setOptionGroupForm({ ...optionGroupForm, max: event.target.value })} /></label></div></div>
                  <div className="option-draft-entry"><label>Opcional<input value={optionDraftForm.name} onChange={(event) => setOptionDraftForm({ ...optionDraftForm, name: event.target.value })} placeholder="Ex.: Batata frita" /></label><label>Acréscimo<input value={optionDraftForm.priceDelta} onChange={(event) => setOptionDraftForm({ ...optionDraftForm, priceDelta: formatMoneyInput(event.target.value) })} placeholder="0,00" inputMode="decimal" /></label><button className="admin-secondary" type="button" onClick={addOptionDraft}><Plus size={16} /> Adicionar item</button></div>
                  {optionDrafts.length ? <div className="option-draft-list">{optionDrafts.map((item, index) => <div className="option-draft-row" key={`${item.name}-${index}`}><span>{item.name}</span><strong>{moneyInputNumber(item.priceDelta) ? `+ R$ ${item.priceDelta}` : "Sem acréscimo"}</strong><button className="icon-button" type="button" title="Remover item" aria-label={`Remover ${item.name}`} onClick={() => setOptionDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button></div>)}</div> : <p className="admin-muted">Adicione pelo menos um item ao grupo.</p>}
                  <fieldset className="option-product-selector"><legend>Produtos vinculados</legend><div className="option-product-grid">{products.map((product) => <label key={product.id}><input type="checkbox" checked={optionGroupForm.productIds.includes(product.id)} onChange={(event) => setOptionGroupForm((current) => ({ ...current, productIds: event.target.checked ? [...current.productIds, product.id] : current.productIds.filter((id) => id !== product.id) }))} /><span>{product.name}</span></label>)}</div></fieldset>
                  <div className="admin-form-actions"><button className="admin-secondary" type="button" onClick={() => setShowOptionGroupForm(false)}>Cancelar</button><button className="admin-primary" type="submit" disabled={savingOptionGroup}><Save size={16} /> {savingOptionGroup ? "Salvando..." : "Salvar grupo"}</button></div>
                </form>
              </section>
              </div>
            ) : null}
            {catalogEditorMode ? (
              <div className="catalog-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCatalogEditor(); }}>
              <section className="admin-form-panel catalog-editor-panel catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-editor-title">
                <div className="branch-form-heading"><div><span>{editingProductId ? "Edição do catálogo" : "Novo cadastro"}</span><h2 id="catalog-editor-title">{catalogEditorMode === "product" ? (editingProductId ? "Editar produto" : "Novo produto") : "Nova categoria"}</h2></div><button className="icon-button" type="button" title="Fechar" aria-label="Fechar cadastro" onClick={closeCatalogEditor}><X size={18} /></button></div>
                {catalogEditorMode === "category" ? (
                  <form className="inline-form" onSubmit={createCategory}><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ex.: Material de construção" required /><button className="admin-primary" type="submit"><Plus size={16} /> Adicionar categoria</button></form>
                ) : (
                <form className="admin-product-form" onSubmit={createProduct}>
                  <label>Nome<input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} required /></label>
                  <label>Descrição<textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
                  <div className="admin-form-grid"><label>Preço<input value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: formatMoneyInput(event.target.value) })} placeholder="0,00" inputMode="decimal" required /></label><label>Unidade<select value={productForm.unit} onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })}><option value="">Sem unidade</option>{!productUnitIsRegistered ? <option value={productForm.unit}>{productForm.unit} (não cadastrada)</option> : null}{measurementUnits.map((unit) => <option key={unit.id} value={unit.name}>{unit.code} · {unit.name}</option>)}</select></label></div>
                  <div className={activeControlsStock ? "admin-form-grid" : "admin-form-grid single"}>{activeControlsStock ? <label>Estoque<input value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} inputMode="decimal" /></label> : null}<label>Categoria<select value={productForm.categoryId} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
                  <div className="product-gallery-editor">
                    <div className="product-gallery-editor-heading"><div><strong>Fotos do produto</strong><small>{productEditorImageCount} de {activeProductImageLimit} foto(s) utilizadas</small></div><button className="admin-secondary" type="button" onClick={() => productImageInputRef.current?.click()} disabled={savingProduct || productEditorImageCount >= activeProductImageLimit}><ImagePlus size={16} /> Adicionar fotos</button></div>
                    <div className="product-gallery-editor-grid">
                      {editingProductImages.map((image, index) => <div className="product-gallery-editor-item" key={image.id}><img src={image.image_url} alt={`Foto ${index + 1} de ${editingProduct?.name ?? "produto"}`} /><button type="button" title="Remover foto" aria-label={`Remover foto ${index + 1}`} onClick={() => editingProduct && removeExistingProductImage(editingProduct, image)} disabled={savingProduct}><Trash2 size={15} /></button>{index === 0 ? <span>Capa</span> : null}</div>)}
                      {productImagePreviews.map((preview, index) => <div className="product-gallery-editor-item pending" key={preview}><img src={preview} alt={`Nova foto ${index + 1}`} /><button type="button" title="Retirar seleção" aria-label={`Retirar nova foto ${index + 1}`} onClick={() => removeSelectedProductImage(index)} disabled={savingProduct}><X size={15} /></button><span>Nova</span></div>)}
                      {!productEditorImageCount ? <div className="product-gallery-editor-empty"><Package size={25} /><span>Sem fotos</span></div> : null}
                    </div>
                    <small className="product-gallery-editor-help">JPG, PNG ou WebP · máximo 5 MB por arquivo. A primeira foto será a capa.</small>
                    <input ref={productImageInputRef} className="catalog-import-input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={selectProductImage} />
                  </div>
                  <label>Selo opcional<input value={productForm.badge} onChange={(event) => setProductForm({ ...productForm, badge: event.target.value })} placeholder="Mais vendido" /></label>
                  <button className="admin-primary" type="submit" disabled={savingProduct}>{editingProductId ? <Save size={16} /> : <Plus size={16} />} {savingProduct ? "Salvando..." : editingProductId ? "Salvar alterações" : "Adicionar produto"}</button>
                </form>
                )}
              </section>
              </div>
            ) : null}
          </>
        )}
        {showMeasurementUnitForm ? (
          <div className="catalog-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMeasurementUnitEditor(); }}>
            <section className="admin-form-panel catalog-editor-panel catalog-modal measurement-unit-editor-panel" role="dialog" aria-modal="true" aria-labelledby="measurement-unit-editor-title">
              <div className="branch-form-heading"><div><span>Cadastro estruturado</span><h2 id="measurement-unit-editor-title">Nova unidade de medida</h2></div><button className="icon-button" type="button" title="Fechar" aria-label="Fechar unidade de medida" onClick={closeMeasurementUnitEditor}><X size={18} /></button></div>
              <form className="admin-product-form" onSubmit={createMeasurementUnit}>
                <div className="admin-form-grid"><label>Código<input value={measurementUnitCode} onChange={(event) => setMeasurementUnitCode(event.target.value.toUpperCase())} placeholder="Ex.: UN, KG, CX" maxLength={20} autoCapitalize="characters" required /></label><label>Nome da unidade<input value={measurementUnitName} onChange={(event) => setMeasurementUnitName(event.target.value)} placeholder="Ex.: Unidade, Quilograma, Caixa" maxLength={80} required /></label></div>
                <p className="admin-muted">O código será usado nos produtos, nas integrações e na aba Unidades da planilha.</p>
                <div className="admin-form-actions"><button className="admin-secondary" type="button" onClick={closeMeasurementUnitEditor}>Cancelar</button><button className="admin-primary" type="submit" disabled={savingMeasurementUnit}><Save size={16} /> {savingMeasurementUnit ? "Salvando..." : "Salvar unidade"}</button></div>
              </form>
            </section>
          </div>
        ) : null}
        {message ? <p className="admin-message admin-console-message">{message}</p> : null}
      </div>
    </main>
  );
}

function CompanyPasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const isMismatch = Boolean(confirmation) && password !== confirmation;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || isSaving || isMismatch) return;
    setIsSaving(true);
    setFeedback(null);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSaving(false);
    if (error) {
      setFeedback({ status: "error", message: error.message });
      return;
    }
    setPassword("");
    setConfirmation("");
    setFeedback({ status: "success", message: "Senha alterada. Use a nova senha no próximo login." });
  }

  return (
    <form className="admin-form-panel company-settings-panel" onSubmit={submit}>
      <div className="settings-panel-heading"><h2>Senha</h2><p>Login atual: {email}. Para trocar o e-mail, fale com o suporte.</p></div>
      <label>Nova senha<input type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => { setPassword(event.target.value); setFeedback(null); }} required /></label>
      <label>Confirme a nova senha<input type="password" autoComplete="new-password" minLength={6} value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setFeedback(null); }} aria-invalid={isMismatch} required /></label>
      {isMismatch ? <p className="field-error" role="alert">As senhas não conferem.</p> : <small className="admin-muted">Mínimo de 6 caracteres.</small>}
      {feedback ? <p className={`identity-save-feedback ${feedback.status}`} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
      <div className="admin-form-actions"><button className="admin-primary" type="submit" disabled={isSaving || isMismatch}>{isSaving ? "Salvando..." : "Alterar senha"}</button></div>
    </form>
  );
}

function CompanyAvailabilityPanel({
  companyName,
  companyActive,
  branches,
  saving,
  onCompanyChange,
  onBranchChange,
}: {
  companyName: string;
  companyActive: boolean;
  branches: Branch[];
  saving: string;
  onCompanyChange: (isActive: boolean) => void;
  onBranchChange: (branchId: string, isActive: boolean) => void;
}) {
  return (
    <section className="admin-form-panel company-availability-panel">
      <div className="settings-panel-heading"><h2>Visível no catálogo</h2><p>Desativar oculta do catálogo público sem apagar dados.</p></div>
      <div className={companyActive ? "company-availability-master active" : "company-availability-master inactive"}>
        <span className="availability-master-icon"><Building2 size={20} /></span>
        <div><strong>{companyName}</strong><small>{companyActive ? "A empresa está disponível e respeita o status de cada filial." : "A empresa inteira está oculta, incluindo todas as filiais."}</small></div>
        <AvailabilitySwitch checked={companyActive} disabled={Boolean(saving)} loading={saving === "company"} label="empresa" onChange={onCompanyChange} />
      </div>
      {!companyActive ? <p className="company-availability-note"><Power size={16} /> As configurações individuais abaixo serão preservadas e voltarão a valer quando a empresa for ativada.</p> : null}
      <div className="availability-branch-heading"><span>Filiais</span><small>{branches.filter((branch) => branch.is_active !== false).length} de {branches.length} configuradas como ativas</small></div>
      <div className="availability-branch-list">
        {branches.map((branch) => {
          const branchActive = branch.is_active !== false;
          const branchDescription = branchActive
            ? companyActive ? "Visível no catálogo público" : "Ativa, mas oculta enquanto a empresa estiver inativa"
            : "Oculta do catálogo público";
          return (
            <div className="availability-branch-row" key={branch.id}>
              <span className="settings-branch-avatar"><Store size={17} /></span>
              <div><strong>{branch.name}</strong><small>{branchDescription}</small></div>
              <AvailabilitySwitch checked={branchActive} disabled={Boolean(saving)} loading={saving === branch.id} label={`filial ${branch.name}`} onChange={(isActive) => onBranchChange(branch.id, isActive)} />
            </div>
          );
        })}
        {!branches.length ? <p className="admin-muted">Nenhuma filial vinculada.</p> : null}
      </div>
    </section>
  );
}

function AvailabilitySwitch({ checked, disabled, loading = false, label, onChange }: { checked: boolean; disabled: boolean; loading?: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button className={checked ? "availability-switch active" : "availability-switch"} type="button" role="switch" aria-checked={checked} aria-label={`${checked ? "Desativar" : "Ativar"} ${label}`} disabled={disabled} onClick={() => onChange(!checked)}>
      <span aria-hidden="true"><i /></span><strong>{loading ? "Salvando" : checked ? "Ativa" : "Inativa"}</strong>
    </button>
  );
}

function BranchLocationPicker({
  value,
  locating,
  validating,
  issue,
  onAddressChange,
  onUseCurrent,
  onValidate,
}: {
  value: BranchLocationValue;
  locating: boolean;
  validating: boolean;
  issue: string;
  onAddressChange: (address: string) => void;
  onUseCurrent: () => void;
  onValidate: () => void;
}) {
  const latitude = validCoordinate(value.latitude, -90, 90);
  const longitude = validCoordinate(value.longitude, -180, 180);
  const hasValidatedPoint = latitude !== null && longitude !== null;
  const busy = locating || validating;
  const mapDelta = 0.004;
  const embedUrl = hasValidatedPoint
    ? `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({
        bbox: `${longitude - mapDelta},${latitude - mapDelta},${longitude + mapDelta},${latitude + mapDelta}`,
        layer: "mapnik",
        marker: `${latitude},${longitude}`,
      })}`
    : "";
  const mapUrl = hasValidatedPoint
    ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
    : "";

  return (
    <section className="branch-location-picker">
      <div className="branch-location-heading"><MapPin size={18} /><span><strong>Localização da filial</strong><small>Escolha uma das opções e confira o ponto antes de salvar.</small></span></div>
      <div className="location-address-row">
        <label>Digite o endereço<input value={value.address} onChange={(event) => onAddressChange(event.target.value)} placeholder="Rua, número, cidade e estado" required /></label>
        <button className="admin-secondary" type="button" onClick={onValidate} disabled={busy}><Search size={16} /> {validating ? "Validando..." : "Validar endereço"}</button>
      </div>
      <div className="location-choice"><span>ou</span></div>
      <button className="admin-secondary location-current-button" type="button" onClick={onUseCurrent} disabled={busy}><LocateFixed size={16} /> {locating ? "Obtendo localização..." : "Usar localização atual"}</button>
      {issue ? <LocationHelp issue={issue} /> : null}
      {hasValidatedPoint ? (
        <div className="branch-map-preview" aria-live="polite">
          <iframe src={embedUrl} title={`Mapa da filial em ${value.address}`} loading="lazy" />
          <footer><span><MapPin size={16} /><strong>Ponto identificado no mapa</strong></span><a href={mapUrl} target="_blank" rel="noreferrer">Abrir no OpenStreetMap <ExternalLink size={14} /></a></footer>
        </div>
      ) : <p className="location-pending"><MapPin size={16} /> Valide o endereço ou use a localização atual para visualizar o mapa.</p>}
      <small className="openstreetmap-credit">Busca e mapa por OpenStreetMap.</small>
    </section>
  );
}

function BranchCoverNoteEditor({
  note,
  coverUrl = "",
  onNoteChange,
}: {
  note: string;
  coverUrl?: string;
  onNoteChange: (note: string) => void;
}) {
  const previewNote = note.trim() || "A descrição da filial aparecerá aqui";

  return (
    <section className="branch-cover-note-editor">
      <div className="branch-cover-note-heading">
        <MessageSquareText size={18} />
        <span><strong>Descrição abaixo da capa</strong><small>Texto curto exibido separadamente, logo depois da foto.</small></span>
      </div>
      <label>
        Descrição da filial (opcional)
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value.slice(0, COVER_NOTE_MAX_LENGTH))}
          placeholder="Ex.: Entregamos todos os dias até as 22h"
          maxLength={COVER_NOTE_MAX_LENGTH}
        />
        <small className="cover-note-character-count">{note.length}/{COVER_NOTE_MAX_LENGTH} caracteres</small>
      </label>
      <div className="branch-cover-note-preview" aria-label="Pré-visualização da capa e da descrição">
        <div className="branch-cover-note-preview-image">
          {coverUrl ? <img src={coverUrl} alt="" /> : <div className="branch-cover-note-placeholder"><Package size={34} /><span>A capa da filial aparecerá aqui</span></div>}
        </div>
        <p className={`branch-cover-note-preview-text${note.trim() ? "" : " empty"}`}>{previewNote}</p>
      </div>
    </section>
  );
}

function BranchDetailsEditor({
  branch,
  coverUrl,
  details,
  businessHours,
  location,
  locating,
  validatingLocation,
  saving,
  issue,
  onDetailsChange,
  onBusinessHoursChange,
  onAddressChange,
  onCaptureLocation,
  onValidateLocation,
  onClose,
  onSubmit,
}: {
  branch: Branch;
  coverUrl: string;
  details: BranchDetailsForm;
  businessHours?: BusinessHoursConfig;
  location: BranchLocationValue;
  locating: boolean;
  validatingLocation: boolean;
  saving: boolean;
  issue: string;
  onDetailsChange: (details: BranchDetailsForm) => void;
  onBusinessHoursChange: (config: BusinessHoursConfig) => void;
  onAddressChange: (address: string) => void;
  onCaptureLocation: () => void;
  onValidateLocation: () => void;
  onClose?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="admin-form-panel branch-details-panel" onSubmit={onSubmit}>
      <div className="branch-form-heading"><div><span>Dados da filial</span><h2>{branch.name}</h2><p>Informações exibidas no catálogo e usadas nos pedidos.</p></div>{onClose ? <button className="icon-button" type="button" title="Fechar" aria-label="Fechar dados da filial" onClick={onClose}><X size={18} /></button> : null}</div>
      <ParameterToggle checked={details.isActive} title="Filial ativa no catálogo público" description={details.isActive ? "A filial está disponível para receber pedidos." : "A filial fica oculta até ser reativada."} onChange={(isActive) => onDetailsChange({ ...details, isActive })} />
      <div className="admin-form-grid">
        <label>Nome da filial<input value={details.name} onChange={(event) => onDetailsChange({ ...details, name: event.target.value })} required /></label>
        <DocumentField label="Documento" value={details.cnpj} onChange={(cnpj) => onDetailsChange({ ...details, cnpj })} />
        <label>WhatsApp<input value={details.phone} onChange={(event) => onDetailsChange({ ...details, phone: formatWhatsapp(event.target.value) })} placeholder="(63) 99999-9999" inputMode="tel" required /></label>
      </div>
      <BranchCoverNoteEditor
        note={details.coverNote}
        coverUrl={coverUrl}
        onNoteChange={(coverNote) => onDetailsChange({ ...details, coverNote })}
      />
      <section className="branch-business-hours-section">
        <div className="branch-cover-note-heading">
          <Clock size={18} />
          <span><strong>Horário de funcionamento</strong><small>Usado para exibir o status da loja no catálogo.</small></span>
        </div>
        {businessHours ? <BusinessHoursEditor branchName={branch.name} config={businessHours} onChange={onBusinessHoursChange} /> : <p className="admin-muted">Carregando o horário salvo... Se não aparecer, o horário atual não será alterado ao salvar.</p>}
      </section>
      <BranchLocationPicker value={location} locating={locating} validating={validatingLocation} issue={issue} onAddressChange={onAddressChange} onUseCurrent={onCaptureLocation} onValidate={onValidateLocation} />
      <div className="admin-form-actions"><button className="admin-primary" type="submit" disabled={saving || locating || validatingLocation}><Save size={16} /> {saving ? "Salvando..." : "Salvar dados"}</button></div>
    </form>
  );
}

function normalizeBranchCnpj(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 14 ? digits : "";
}

function branchPublicIdentifier(branch: Pick<Branch, "id" | "slug" | "cnpj">) {
  return normalizeBranchCnpj(branch.cnpj) || branch.id || branch.slug;
}

function branchOrderPath(branch: Pick<Branch, "id" | "slug" | "cnpj">, channel: Exclude<OrderMode, "both">) {
  const path = channel === "internal" ? "/comanda" : "/";
  const branchContext = channel === "internal" ? `&filial=${encodeURIComponent(branch.id)}` : "";
  return `${path}?loja=${encodeURIComponent(branchPublicIdentifier(branch))}${branchContext}`;
}

function BranchOrderLinks({ branch, mode }: { branch: Branch; mode: OrderMode }) {
  const [copiedChannel, setCopiedChannel] = useState<"whatsapp" | "internal" | "">("");
  const channels = (["whatsapp", "internal"] as const).filter((channel) => mode === "both" || mode === channel);

  async function copyLink(channel: "whatsapp" | "internal") {
    const path = branchOrderPath(branch, channel);
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopiedChannel(channel);
    window.setTimeout(() => setCopiedChannel((current) => current === channel ? "" : current), 1800);
  }

  return (
    <section className="branch-order-links" aria-label={`Links de pedido de ${branch.name}`}>
      <header><Link2 size={17} /><span><strong>Links desta filial</strong><small>Cada link abre o catálogo no fluxo correto.</small></span></header>
      <div>
        {channels.map((channel) => {
          const isInternal = channel === "internal";
          const path = branchOrderPath(branch, channel);
          return (
            <article key={channel}>
              <span>{isInternal ? <ClipboardList size={17} /> : <MessageSquareText size={17} />}<span><strong>{isInternal ? "Equipe · Comanda interna" : "Cliente · WhatsApp"}</strong><small>{isInternal ? "/comanda" : "/?loja"}</small></span></span>
              <div><button className="icon-button" type="button" title="Copiar link" aria-label={`Copiar link de ${isInternal ? "comanda interna" : "WhatsApp"}`} onClick={() => void copyLink(channel)}>{copiedChannel === channel ? <CheckCircle2 size={17} /> : <Copy size={17} />}</button><a className="icon-button" href={path} target="_blank" rel="noreferrer" title="Abrir link" aria-label={`Abrir link de ${isInternal ? "comanda interna" : "WhatsApp"}`}><ExternalLink size={17} /></a></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

type ChoiceOption<T extends string> = { value: T; label: string };

const ORDER_MODE_OPTIONS: Array<ChoiceOption<OrderMode>> = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "internal", label: "Comanda interna" },
  { value: "both", label: "Ambos" },
];
const PRINT_MODE_OPTIONS: Array<ChoiceOption<PrintMode>> = [
  { value: "disabled", label: "Desativada" },
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automática" },
  { value: "manual_and_automatic", label: "Manual + automática" },
];
const DELIVERY_FEE_TYPE_OPTIONS: Array<ChoiceOption<DeliveryFeeType>> = [
  { value: "fixed", label: "Taxa fixa" },
  { value: "per_km", label: "Por km" },
];
const CATALOG_LAYOUT_OPTIONS: Array<ChoiceOption<CatalogLayout>> = [
  { value: "horizontal", label: "Foto ao lado" },
  { value: "showcase", label: "Foto acima (vitrine)" },
];

function catalogLayoutLabel(layout: CatalogLayout) {
  return CATALOG_LAYOUT_OPTIONS.find((option) => option.value === layout)?.label ?? "Foto ao lado";
}

function deliveryFeeTypeLabel(type: DeliveryFeeType) {
  return type === "per_km" ? "Por km" : "Taxa fixa";
}

function inheritOption<T extends string>(inheritedLabel: string): ChoiceOption<T | "inherit"> {
  return { value: "inherit", label: `Padrão da empresa (${inheritedLabel})` };
}

function booleanOptions(onLabel: string, offLabel: string): Array<ChoiceOption<"enabled" | "disabled">> {
  return [
    { value: "enabled", label: onLabel },
    { value: "disabled", label: offLabel },
  ];
}

function overrideCountLabel(count: number) {
  if (!count) return "";
  return count === 1 ? "1 filial usa valor próprio" : `${count} filiais usam valor próprio`;
}

function ParameterWorkspace({
  tenant,
  branches,
  activeBranchId,
  scope,
  isCompanyPortal,
  companyEnabled,
  branchModes,
  companyDeliveryFeeType,
  branchDeliveryFeeTypeModes,
  branchFees,
  companyCatalogLayout,
  branchCatalogLayouts,
  companyProductImageLimit,
  branchProductImageLimits,
  companyControlsStock,
  branchStockControlModes,
  companyEnablesAdditions,
  branchAdditionsModes,
  companyOrderMode,
  branchOrderModes,
  companyCompactInternalCatalog,
  branchCompactInternalCatalogModes,
  companyPrintMode,
  branchPrintModes,
  branchBusinessHours,
  generatingPrintInstallerId,
  loading,
  saving,
  onScopeChange,
  onBranchChange,
  onCompanyEnabledChange,
  onBranchModeChange,
  onCompanyDeliveryFeeTypeChange,
  onBranchDeliveryFeeTypeModeChange,
  onBranchFeeChange,
  onCompanyCatalogLayoutChange,
  onBranchCatalogLayoutChange,
  onCompanyProductImageLimitChange,
  onBranchProductImageLimitChange,
  onCompanyControlsStockChange,
  onBranchStockControlModeChange,
  onCompanyEnablesAdditionsChange,
  onBranchAdditionsModeChange,
  onCompanyOrderModeChange,
  onBranchOrderModeChange,
  onCompanyCompactInternalCatalogChange,
  onBranchCompactInternalCatalogModeChange,
  onCompanyPrintModeChange,
  onBranchPrintModeChange,
  onBranchBusinessHoursChange,
  onDownloadPrintAgentInstaller,
  onSaveCompany,
  onSaveBranch,
  onDiscard,
}: {
  tenant: Tenant;
  branches: Branch[];
  activeBranchId: string;
  scope: ParameterScope;
  isCompanyPortal: boolean;
  companyEnabled: boolean;
  branchModes: Record<string, FreightParameterMode>;
  companyDeliveryFeeType: DeliveryFeeType;
  branchDeliveryFeeTypeModes: Record<string, BranchDeliveryFeeTypeMode>;
  branchFees: Record<string, string>;
  companyCatalogLayout: CatalogLayout;
  branchCatalogLayouts: Record<string, BranchCatalogLayoutMode>;
  companyProductImageLimit: number;
  branchProductImageLimits: Record<string, ProductImageLimitMode>;
  companyControlsStock: boolean;
  branchStockControlModes: Record<string, StockControlMode>;
  companyEnablesAdditions: boolean;
  branchAdditionsModes: Record<string, AdditionsMode>;
  companyOrderMode: OrderMode;
  branchOrderModes: Record<string, BranchOrderMode>;
  companyCompactInternalCatalog: boolean;
  branchCompactInternalCatalogModes: Record<string, CompactInternalCatalogMode>;
  companyPrintMode: PrintMode;
  branchPrintModes: Record<string, BranchPrintMode>;
  branchBusinessHours: Record<string, BusinessHoursConfig>;
  generatingPrintInstallerId: string;
  loading: boolean;
  saving: boolean;
  onScopeChange: (scope: ParameterScope) => void;
  onBranchChange: (branchId: string) => void;
  onCompanyEnabledChange: (enabled: boolean) => void;
  onBranchModeChange: (branchId: string, mode: FreightParameterMode) => void;
  onCompanyDeliveryFeeTypeChange: (type: DeliveryFeeType) => void;
  onBranchDeliveryFeeTypeModeChange: (branchId: string, mode: BranchDeliveryFeeTypeMode) => void;
  onBranchFeeChange: (branchId: string, fee: string) => void;
  onCompanyCatalogLayoutChange: (layout: CatalogLayout) => void;
  onBranchCatalogLayoutChange: (branchId: string, mode: BranchCatalogLayoutMode) => void;
  onCompanyProductImageLimitChange: (limit: number) => void;
  onBranchProductImageLimitChange: (branchId: string, mode: ProductImageLimitMode) => void;
  onCompanyControlsStockChange: (enabled: boolean) => void;
  onBranchStockControlModeChange: (branchId: string, mode: StockControlMode) => void;
  onCompanyEnablesAdditionsChange: (enabled: boolean) => void;
  onBranchAdditionsModeChange: (branchId: string, mode: AdditionsMode) => void;
  onCompanyOrderModeChange: (mode: OrderMode) => void;
  onBranchOrderModeChange: (branchId: string, mode: BranchOrderMode) => void;
  onCompanyCompactInternalCatalogChange: (enabled: boolean) => void;
  onBranchCompactInternalCatalogModeChange: (branchId: string, mode: CompactInternalCatalogMode) => void;
  onCompanyPrintModeChange: (mode: PrintMode) => void;
  onBranchPrintModeChange: (branchId: string, mode: BranchPrintMode) => void;
  onBranchBusinessHoursChange: (branchId: string, config: BusinessHoursConfig) => void;
  onDownloadPrintAgentInstaller: (branch: Branch) => void;
  onSaveCompany: () => Promise<boolean>;
  onSaveBranch: () => Promise<boolean>;
  onDiscard: () => Promise<void>;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const activeBranch = scope === "branch" ? branches.find((branch) => branch.id === activeBranchId) ?? branches[0] ?? null : null;

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  function edited<Args extends unknown[]>(callback: (...args: Args) => void) {
    return (...args: Args) => {
      setIsDirty(true);
      callback(...args);
    };
  }

  async function changeScope(nextScope: "company" | string) {
    const isSameScope = nextScope === "company" ? scope === "company" : scope === "branch" && activeBranch?.id === nextScope;
    if (isSameScope) return;
    if (isDirty) {
      if (!window.confirm("Existem alterações não salvas. Deseja descartá-las?")) return;
      await onDiscard();
      setIsDirty(false);
    }
    if (nextScope === "company") onScopeChange("company");
    else onBranchChange(nextScope);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = scope === "company" ? await onSaveCompany() : await onSaveBranch();
    if (saved) setIsDirty(false);
  }

  async function discard() {
    await onDiscard();
    setIsDirty(false);
  }

  const countOverrides = (modes: Record<string, unknown>) => branches.filter((branch) => (modes[branch.id] ?? "inherit") !== "inherit").length;
  const scopeTabs = (
    <div className="settings-scope" role="tablist" aria-label="Configurar">
      <button type="button" role="tab" aria-selected={scope === "company"} className={scope === "company" ? "active" : ""} onClick={() => void changeScope("company")}>Padrão da empresa</button>
      {branches.map((branch) => (
        <button type="button" role="tab" key={branch.id} aria-selected={activeBranch?.id === branch.id} className={activeBranch?.id === branch.id ? "active" : ""} onClick={() => void changeScope(branch.id)}>{branch.name}</button>
      ))}
    </div>
  );

  if (loading) {
    return <section className="settings-workspace">{scopeTabs}<p className="admin-muted">Carregando parâmetros...</p></section>;
  }

  const scopeHint = scope === "company"
    ? "Valores usados por todas as filiais, exceto onde a filial tiver valor próprio."
    : `Valores de ${activeBranch?.name ?? "filial"}. Use "Padrão da empresa" para seguir ${tenant.name}.`;

  return (
    <section className="settings-workspace">
      {scopeTabs}
      <p className="settings-scope-hint">{scopeHint}</p>
      <form className="settings-form" onSubmit={submit}>
        {scope === "company" ? (
          <CompanyParameterFields
            branchCount={branches.length}
            isCompanyPortal={isCompanyPortal}
            companyEnabled={companyEnabled}
            companyDeliveryFeeType={companyDeliveryFeeType}
            companyCatalogLayout={companyCatalogLayout}
            companyProductImageLimit={companyProductImageLimit}
            companyControlsStock={companyControlsStock}
            companyEnablesAdditions={companyEnablesAdditions}
            companyOrderMode={companyOrderMode}
            companyCompactInternalCatalog={companyCompactInternalCatalog}
            companyPrintMode={companyPrintMode}
            overrides={{
              freight: countOverrides(branchModes),
              feeType: countOverrides(branchDeliveryFeeTypeModes),
              layout: countOverrides(branchCatalogLayouts),
              imageLimit: countOverrides(branchProductImageLimits),
              stock: countOverrides(branchStockControlModes),
              additions: countOverrides(branchAdditionsModes),
              orderMode: countOverrides(branchOrderModes),
              compact: countOverrides(branchCompactInternalCatalogModes),
              print: countOverrides(branchPrintModes),
            }}
            onCompanyEnabledChange={edited(onCompanyEnabledChange)}
            onCompanyDeliveryFeeTypeChange={edited(onCompanyDeliveryFeeTypeChange)}
            onCompanyCatalogLayoutChange={edited(onCompanyCatalogLayoutChange)}
            onCompanyProductImageLimitChange={edited(onCompanyProductImageLimitChange)}
            onCompanyControlsStockChange={edited(onCompanyControlsStockChange)}
            onCompanyEnablesAdditionsChange={edited(onCompanyEnablesAdditionsChange)}
            onCompanyOrderModeChange={edited(onCompanyOrderModeChange)}
            onCompanyCompactInternalCatalogChange={edited(onCompanyCompactInternalCatalogChange)}
            onCompanyPrintModeChange={edited(onCompanyPrintModeChange)}
          />
        ) : activeBranch ? (
          <BranchParameterFields
            branch={activeBranch}
            isCompanyPortal={isCompanyPortal}
            companyEnabled={companyEnabled}
            companyDeliveryFeeType={companyDeliveryFeeType}
            companyCatalogLayout={companyCatalogLayout}
            companyProductImageLimit={companyProductImageLimit}
            companyControlsStock={companyControlsStock}
            companyEnablesAdditions={companyEnablesAdditions}
            companyOrderMode={companyOrderMode}
            companyCompactInternalCatalog={companyCompactInternalCatalog}
            companyPrintMode={companyPrintMode}
            freightMode={branchModes[activeBranch.id] ?? "inherit"}
            deliveryFeeTypeMode={branchDeliveryFeeTypeModes[activeBranch.id] ?? "inherit"}
            fee={branchFees[activeBranch.id] ?? "0,00"}
            layoutMode={branchCatalogLayouts[activeBranch.id] ?? "inherit"}
            imageLimitMode={branchProductImageLimits[activeBranch.id] ?? "inherit"}
            stockMode={branchStockControlModes[activeBranch.id] ?? "inherit"}
            additionsMode={branchAdditionsModes[activeBranch.id] ?? "inherit"}
            orderMode={branchOrderModes[activeBranch.id] ?? "inherit"}
            compactMode={branchCompactInternalCatalogModes[activeBranch.id] ?? "inherit"}
            printMode={branchPrintModes[activeBranch.id] ?? "inherit"}
            businessHours={branchBusinessHours[activeBranch.id] ?? createDefaultBusinessHours()}
            isGeneratingInstaller={generatingPrintInstallerId === activeBranch.id}
            isInstallerBusy={Boolean(generatingPrintInstallerId)}
            onFreightModeChange={edited((mode: FreightParameterMode) => onBranchModeChange(activeBranch.id, mode))}
            onDeliveryFeeTypeModeChange={edited((mode: BranchDeliveryFeeTypeMode) => onBranchDeliveryFeeTypeModeChange(activeBranch.id, mode))}
            onFeeChange={edited((fee: string) => onBranchFeeChange(activeBranch.id, fee))}
            onLayoutModeChange={edited((mode: BranchCatalogLayoutMode) => onBranchCatalogLayoutChange(activeBranch.id, mode))}
            onImageLimitModeChange={edited((mode: ProductImageLimitMode) => onBranchProductImageLimitChange(activeBranch.id, mode))}
            onStockModeChange={edited((mode: StockControlMode) => onBranchStockControlModeChange(activeBranch.id, mode))}
            onAdditionsModeChange={edited((mode: AdditionsMode) => onBranchAdditionsModeChange(activeBranch.id, mode))}
            onOrderModeChange={edited((mode: BranchOrderMode) => onBranchOrderModeChange(activeBranch.id, mode))}
            onCompactModeChange={edited((mode: CompactInternalCatalogMode) => onBranchCompactInternalCatalogModeChange(activeBranch.id, mode))}
            onPrintModeChange={edited((mode: BranchPrintMode) => onBranchPrintModeChange(activeBranch.id, mode))}
            onBusinessHoursChange={edited((config: BusinessHoursConfig) => onBranchBusinessHoursChange(activeBranch.id, config))}
            onDownloadInstaller={() => onDownloadPrintAgentInstaller(activeBranch)}
          />
        ) : <p className="admin-muted">Cadastre uma filial para configurar valores próprios.</p>}
        <footer className={isDirty ? "settings-savebar dirty" : "settings-savebar"}>
          <span role="status">{saving ? "Salvando..." : isDirty ? "Alterações não salvas" : "Tudo salvo"}</span>
          <div>
            {isDirty ? <button className="admin-secondary" type="button" disabled={saving} onClick={() => void discard()}>Descartar</button> : null}
            <button className="admin-primary" type="submit" disabled={saving || !isDirty}>{saving ? "Salvando..." : "Salvar alterações"}</button>
          </div>
        </footer>
      </form>
    </section>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="settings-group"><legend>{title}</legend>{children}</fieldset>;
}

function SettingRow({ title, help, isOverridden = false, children }: { title: string; help?: string; isOverridden?: boolean; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-row-label">
        <strong>{title}{isOverridden ? <em>valor próprio</em> : null}</strong>
        {help ? <small>{help}</small> : null}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

function ChoiceField<T extends string>({ name, value, options, isDisabled = false, onChange }: { name: string; value: T; options: Array<ChoiceOption<T>>; isDisabled?: boolean; onChange: (value: T) => void }) {
  if (options.length > 3) {
    return (
      <select className="choice-select" name={name} value={value} disabled={isDisabled} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }
  return (
    <div className="choice-field" role="radiogroup">
      {options.map((option) => (
        <label key={option.value} className={value === option.value ? "selected" : ""}>
          <input type="radio" name={name} value={option.value} checked={value === option.value} disabled={isDisabled} onChange={() => onChange(option.value)} />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function ImageLimitStepper({ value, isDisabled = false, onChange }: { value: number; isDisabled?: boolean; onChange: (value: number) => void }) {
  return (
    <div className="setting-stepper">
      <button type="button" aria-label="Diminuir quantidade" disabled={isDisabled || value <= PRODUCT_IMAGE_LIMIT_MIN} onClick={() => onChange(Math.max(PRODUCT_IMAGE_LIMIT_MIN, value - 1))}>−</button>
      <input type="number" aria-label="Fotos por produto" min={PRODUCT_IMAGE_LIMIT_MIN} max={PRODUCT_IMAGE_LIMIT_MAX} value={value} disabled={isDisabled} onChange={(event) => onChange(productImageLimitValue(event.target.value))} />
      <button type="button" aria-label="Aumentar quantidade" disabled={isDisabled || value >= PRODUCT_IMAGE_LIMIT_MAX} onClick={() => onChange(Math.min(PRODUCT_IMAGE_LIMIT_MAX, value + 1))}>+</button>
    </div>
  );
}

type CompanyParameterOverrides = Record<"freight" | "feeType" | "layout" | "imageLimit" | "stock" | "additions" | "orderMode" | "compact" | "print", number>;

function CompanyParameterFields({
  branchCount,
  isCompanyPortal,
  companyEnabled,
  companyDeliveryFeeType,
  companyCatalogLayout,
  companyProductImageLimit,
  companyControlsStock,
  companyEnablesAdditions,
  companyOrderMode,
  companyCompactInternalCatalog,
  companyPrintMode,
  overrides,
  onCompanyEnabledChange,
  onCompanyDeliveryFeeTypeChange,
  onCompanyCatalogLayoutChange,
  onCompanyProductImageLimitChange,
  onCompanyControlsStockChange,
  onCompanyEnablesAdditionsChange,
  onCompanyOrderModeChange,
  onCompanyCompactInternalCatalogChange,
  onCompanyPrintModeChange,
}: {
  branchCount: number;
  isCompanyPortal: boolean;
  companyEnabled: boolean;
  companyDeliveryFeeType: DeliveryFeeType;
  companyCatalogLayout: CatalogLayout;
  companyProductImageLimit: number;
  companyControlsStock: boolean;
  companyEnablesAdditions: boolean;
  companyOrderMode: OrderMode;
  companyCompactInternalCatalog: boolean;
  companyPrintMode: PrintMode;
  overrides: CompanyParameterOverrides;
  onCompanyEnabledChange: (enabled: boolean) => void;
  onCompanyDeliveryFeeTypeChange: (type: DeliveryFeeType) => void;
  onCompanyCatalogLayoutChange: (layout: CatalogLayout) => void;
  onCompanyProductImageLimitChange: (limit: number) => void;
  onCompanyControlsStockChange: (enabled: boolean) => void;
  onCompanyEnablesAdditionsChange: (enabled: boolean) => void;
  onCompanyOrderModeChange: (mode: OrderMode) => void;
  onCompanyCompactInternalCatalogChange: (enabled: boolean) => void;
  onCompanyPrintModeChange: (mode: PrintMode) => void;
}) {
  const help = (base: string, count: number) => [base, branchCount ? overrideCountLabel(count) : ""].filter(Boolean).join(" · ");
  const toMode = (enabled: boolean) => enabled ? "enabled" : "disabled";
  return (
    <>
      <SettingsGroup title="Pedidos">
        <SettingRow title="Destino dos pedidos" help={help("Para onde o pedido do cliente é enviado.", overrides.orderMode)}>
          <ChoiceField name="company-order-mode" value={companyOrderMode} options={ORDER_MODE_OPTIONS} onChange={onCompanyOrderModeChange} />
        </SettingRow>
        <SettingRow title="Impressão da comanda" help={help("Somente para comanda interna.", overrides.print)}>
          <ChoiceField name="company-print-mode" value={companyPrintMode} options={PRINT_MODE_OPTIONS} onChange={onCompanyPrintModeChange} />
        </SettingRow>
        <SettingRow title="Cardápio de mesa e equipe" help={help("Visual compacto mostra só capa e foto antes dos produtos.", overrides.compact)}>
          <ChoiceField name="company-compact-catalog" value={toMode(companyCompactInternalCatalog)} options={booleanOptions("Compacto", "Completo")} onChange={(mode) => onCompanyCompactInternalCatalogChange(mode === "enabled")} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Entrega">
        <SettingRow title="Taxa de entrega" help={help("O valor da taxa é definido em cada filial.", overrides.freight)}>
          <ChoiceField name="company-freight" value={toMode(companyEnabled)} options={booleanOptions("Cobrar taxa", "A combinar")} onChange={(mode) => onCompanyEnabledChange(mode === "enabled")} />
        </SettingRow>
        <SettingRow title="Forma de cálculo" help={help("Taxa fixa soma o mesmo valor; por km multiplica pela distância.", overrides.feeType)}>
          <ChoiceField name="company-fee-type" value={companyDeliveryFeeType} options={DELIVERY_FEE_TYPE_OPTIONS} isDisabled={!companyEnabled} onChange={onCompanyDeliveryFeeTypeChange} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Catálogo">
        <SettingRow title="Layout dos produtos" help={help("", overrides.layout)}>
          <ChoiceField name="company-layout" value={companyCatalogLayout} options={CATALOG_LAYOUT_OPTIONS} onChange={onCompanyCatalogLayoutChange} />
        </SettingRow>
        <SettingRow title="Controle de estoque" help={help("Desativado, o estoque some do cadastro e da planilha.", overrides.stock)}>
          <ChoiceField name="company-stock" value={toMode(companyControlsStock)} options={booleanOptions("Ativo", "Desativado")} onChange={(mode) => onCompanyControlsStockChange(mode === "enabled")} />
        </SettingRow>
        <SettingRow title="Adicionais nos produtos" help={help("", overrides.additions)}>
          <ChoiceField name="company-additions" value={toMode(companyEnablesAdditions)} options={booleanOptions("Ativo", "Desativado")} onChange={(mode) => onCompanyEnablesAdditionsChange(mode === "enabled")} />
        </SettingRow>
        {isCompanyPortal ? (
          <SettingRow title="Fotos por produto" help="Limite do seu plano. Fale com o suporte para alterar.">
            <span className="setting-readonly">{companyProductImageLimit}</span>
          </SettingRow>
        ) : (
          <SettingRow title="Fotos por produto" help={help(`Entre ${PRODUCT_IMAGE_LIMIT_MIN} e ${PRODUCT_IMAGE_LIMIT_MAX}.`, overrides.imageLimit)}>
            <ImageLimitStepper value={companyProductImageLimit} onChange={onCompanyProductImageLimitChange} />
          </SettingRow>
        )}
      </SettingsGroup>
    </>
  );
}

function BranchParameterFields({
  branch,
  isCompanyPortal,
  companyEnabled,
  companyDeliveryFeeType,
  companyCatalogLayout,
  companyProductImageLimit,
  companyControlsStock,
  companyEnablesAdditions,
  companyOrderMode,
  companyCompactInternalCatalog,
  companyPrintMode,
  freightMode,
  deliveryFeeTypeMode,
  fee,
  layoutMode,
  imageLimitMode,
  stockMode,
  additionsMode,
  orderMode,
  compactMode,
  printMode,
  businessHours,
  isGeneratingInstaller,
  isInstallerBusy,
  onFreightModeChange,
  onDeliveryFeeTypeModeChange,
  onFeeChange,
  onLayoutModeChange,
  onImageLimitModeChange,
  onStockModeChange,
  onAdditionsModeChange,
  onOrderModeChange,
  onCompactModeChange,
  onPrintModeChange,
  onBusinessHoursChange,
  onDownloadInstaller,
}: {
  branch: Branch;
  isCompanyPortal: boolean;
  companyEnabled: boolean;
  companyDeliveryFeeType: DeliveryFeeType;
  companyCatalogLayout: CatalogLayout;
  companyProductImageLimit: number;
  companyControlsStock: boolean;
  companyEnablesAdditions: boolean;
  companyOrderMode: OrderMode;
  companyCompactInternalCatalog: boolean;
  companyPrintMode: PrintMode;
  freightMode: FreightParameterMode;
  deliveryFeeTypeMode: BranchDeliveryFeeTypeMode;
  fee: string;
  layoutMode: BranchCatalogLayoutMode;
  imageLimitMode: ProductImageLimitMode;
  stockMode: StockControlMode;
  additionsMode: AdditionsMode;
  orderMode: BranchOrderMode;
  compactMode: CompactInternalCatalogMode;
  printMode: BranchPrintMode;
  businessHours: BusinessHoursConfig;
  isGeneratingInstaller: boolean;
  isInstallerBusy: boolean;
  onFreightModeChange: (mode: FreightParameterMode) => void;
  onDeliveryFeeTypeModeChange: (mode: BranchDeliveryFeeTypeMode) => void;
  onFeeChange: (fee: string) => void;
  onLayoutModeChange: (mode: BranchCatalogLayoutMode) => void;
  onImageLimitModeChange: (mode: ProductImageLimitMode) => void;
  onStockModeChange: (mode: StockControlMode) => void;
  onAdditionsModeChange: (mode: AdditionsMode) => void;
  onOrderModeChange: (mode: BranchOrderMode) => void;
  onCompactModeChange: (mode: CompactInternalCatalogMode) => void;
  onPrintModeChange: (mode: BranchPrintMode) => void;
  onBusinessHoursChange: (config: BusinessHoursConfig) => void;
  onDownloadInstaller: () => void;
}) {
  const isFreightEnabled = freightMode === "inherit" ? companyEnabled : freightMode === "enabled";
  const deliveryFeeType = deliveryFeeTypeMode === "inherit" ? companyDeliveryFeeType : deliveryFeeTypeMode;
  const effectiveOrderMode = orderMode === "inherit" ? companyOrderMode : orderMode;
  const effectivePrintMode = printMode === "inherit" ? companyPrintMode : printMode;
  const isImageLimitCustom = imageLimitMode !== "inherit";
  const imageLimit = isImageLimitCustom ? imageLimitMode : companyProductImageLimit;
  const onOff = (enabled: boolean, onLabel: string, offLabel: string) => enabled ? onLabel : offLabel;
  const booleanInheritOptions = (inherited: boolean, onLabel: string, offLabel: string) => [
    inheritOption<"enabled" | "disabled">(onOff(inherited, onLabel, offLabel)),
    ...booleanOptions(onLabel, offLabel),
  ];

  return (
    <>
      <SettingsGroup title="Horário de funcionamento">
        <div className="setting-row setting-row-full">
          <BusinessHoursEditor branchName={branch.name} config={businessHours} onChange={onBusinessHoursChange} />
          <small className="setting-row-note">Fora do horário, o catálogo mostra um aviso de loja fechada.</small>
        </div>
      </SettingsGroup>
      <SettingsGroup title="Pedidos">
        <SettingRow title="Destino dos pedidos" isOverridden={orderMode !== "inherit"}>
          <ChoiceField name="branch-order-mode" value={orderMode} options={[inheritOption<OrderMode>(orderModeLabel(companyOrderMode)), ...ORDER_MODE_OPTIONS]} onChange={onOrderModeChange} />
        </SettingRow>
        <div className="setting-row setting-row-full"><BranchOrderLinks branch={branch} mode={effectiveOrderMode} /></div>
        <SettingRow title="Impressão da comanda" isOverridden={printMode !== "inherit"}>
          <ChoiceField name="branch-print-mode" value={printMode} options={[inheritOption<PrintMode>(printModeLabel(companyPrintMode)), ...PRINT_MODE_OPTIONS]} onChange={onPrintModeChange} />
        </SettingRow>
        {effectivePrintMode === "automatic" || effectivePrintMode === "manual_and_automatic" ? (
          <SettingRow title="Agente de impressão" help="Execute no computador ligado à impressora desta filial.">
            <button className="admin-secondary" type="button" onClick={onDownloadInstaller} disabled={isInstallerBusy}>
              <Download size={16} /> {isGeneratingInstaller ? "Gerando..." : "Baixar instalador"}
            </button>
          </SettingRow>
        ) : null}
        <SettingRow title="Cardápio de mesa e equipe" isOverridden={compactMode !== "inherit"}>
          <ChoiceField name="branch-compact-catalog" value={compactMode} options={booleanInheritOptions(companyCompactInternalCatalog, "Compacto", "Completo")} onChange={onCompactModeChange} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Entrega">
        <SettingRow title="Taxa de entrega" isOverridden={freightMode !== "inherit"}>
          <ChoiceField name="branch-freight" value={freightMode} options={booleanInheritOptions(companyEnabled, "Cobrar taxa", "A combinar")} onChange={onFreightModeChange} />
        </SettingRow>
        <SettingRow title="Forma de cálculo" isOverridden={deliveryFeeTypeMode !== "inherit"}>
          <ChoiceField name="branch-fee-type" value={deliveryFeeTypeMode} options={[inheritOption<DeliveryFeeType>(deliveryFeeTypeLabel(companyDeliveryFeeType)), ...DELIVERY_FEE_TYPE_OPTIONS]} isDisabled={!isFreightEnabled} onChange={onDeliveryFeeTypeModeChange} />
        </SettingRow>
        <SettingRow title={deliveryFeeType === "fixed" ? "Valor da taxa" : "Valor por km"} help={isFreightEnabled ? undefined : "Ative a taxa de entrega para informar o valor."}>
          <div className="setting-money"><b>R$</b><input aria-label={deliveryFeeType === "fixed" ? "Valor da taxa" : "Valor por km"} value={fee} onChange={(event) => onFeeChange(formatMoneyInput(event.target.value))} placeholder="0,00" inputMode="decimal" disabled={!isFreightEnabled} /></div>
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Catálogo">
        <SettingRow title="Layout dos produtos" isOverridden={layoutMode !== "inherit"}>
          <ChoiceField name="branch-layout" value={layoutMode} options={[inheritOption<CatalogLayout>(catalogLayoutLabel(companyCatalogLayout)), ...CATALOG_LAYOUT_OPTIONS]} onChange={onLayoutModeChange} />
        </SettingRow>
        <SettingRow title="Controle de estoque" isOverridden={stockMode !== "inherit"}>
          <ChoiceField name="branch-stock" value={stockMode} options={booleanInheritOptions(companyControlsStock, "Ativo", "Desativado")} onChange={onStockModeChange} />
        </SettingRow>
        <SettingRow title="Adicionais nos produtos" isOverridden={additionsMode !== "inherit"}>
          <ChoiceField name="branch-additions" value={additionsMode} options={booleanInheritOptions(companyEnablesAdditions, "Ativo", "Desativado")} onChange={onAdditionsModeChange} />
        </SettingRow>
        {isCompanyPortal ? (
          <SettingRow title="Fotos por produto" help="Limite do seu plano.">
            <span className="setting-readonly">{imageLimit}</span>
          </SettingRow>
        ) : (
          <SettingRow title="Fotos por produto" isOverridden={isImageLimitCustom}>
            <div className="setting-inline">
              <ChoiceField name="branch-image-limit" value={isImageLimitCustom ? "custom" : "inherit"} options={[inheritOption<"custom">(String(companyProductImageLimit)), { value: "custom", label: "Personalizar" }]} onChange={(mode) => onImageLimitModeChange(mode === "inherit" ? "inherit" : companyProductImageLimit)} />
              {isImageLimitCustom ? <ImageLimitStepper value={imageLimit} onChange={onImageLimitModeChange} /> : null}
            </div>
          </SettingRow>
        )}
      </SettingsGroup>
    </>
  );
}


function ParameterToggle({ checked, title, description, onChange }: { checked: boolean; title: string; description: string; onChange: (checked: boolean) => void }) {
  return <label className="parameter-toggle-row"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true"><b /></i></label>;
}

function BusinessHoursEditor({ config, branchName, onChange }: { config: BusinessHoursConfig; branchName: string; onChange: (config: BusinessHoursConfig) => void }) {
  const value = businessHoursValue(config);
  return (
    <div className="business-hours-editor" aria-label={`Horário de funcionamento de ${branchName}`}>
      {value.days.map((day) => {
        const weekday = BUSINESS_WEEKDAYS.find((item) => item.value === day.weekday);
        return (
          <div className={day.isOpen ? "business-hours-line open" : "business-hours-line"} key={day.weekday}>
            <label className="business-hours-day-toggle">
              <input
                type="checkbox"
                checked={day.isOpen}
                onChange={(event) => onChange(updateBusinessHoursDay(value, day.weekday, { isOpen: event.target.checked }))}
              />
              <span>{weekday?.short ?? "Dia"}</span>
            </label>
            <label>
              <span>Abre</span>
              <input
                type="time"
                value={day.opensAt}
                disabled={!day.isOpen}
                onChange={(event) => onChange(updateBusinessHoursDay(value, day.weekday, { opensAt: event.target.value }))}
              />
            </label>
            <label>
              <span>Fecha</span>
              <input
                type="time"
                value={day.closesAt}
                disabled={!day.isOpen}
                onChange={(event) => onChange(updateBusinessHoursDay(value, day.weekday, { closesAt: event.target.value }))}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}

function LocationHelp({ issue }: { issue: string }) {
  return <div className="location-help" role="alert"><MapPin size={18} /><span><strong>Verifique a localização</strong><small>{issue}</small></span></div>;
}

function AdminCompanies({
  tenants,
  branches,
  statuses,
  onStatusChanged,
  onOpenRequests,
  onOpenCatalog,
  onOpenSettings,
}: {
  tenants: Tenant[];
  branches: Branch[];
  statuses: Map<string, CompanyStatusRow>;
  onStatusChanged: () => void;
  onOpenRequests: () => void;
  onOpenCatalog: (tenantId: string) => void;
  onOpenSettings: (tenantId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleTenants = tenants.filter((item) => {
    const companyBranches = branches.filter((branch) => branch.tenant_id === item.id);
    const searchable = [item.name, item.slug, ...companyBranches.map((branch) => branch.name)].join(" ");
    return normalizeText(searchable).includes(normalizeText(query));
  });
  const companiesWithMultipleBranches = tenants.filter((item) => branches.filter((branch) => branch.tenant_id === item.id).length > 1).length;

  return (
    <section className="admin-company-list">
      <div className="admin-company-summary" aria-label="Resumo das empresas">
        <div><Building2 size={20} /><span>Empresas</span><strong>{tenants.length}</strong></div>
        <div><Store size={20} /><span>Filiais</span><strong>{branches.length}</strong></div>
        <div><LayoutDashboard size={20} /><span>Com várias filiais</span><strong>{companiesWithMultipleBranches}</strong></div>
      </div>
      <div className="admin-company-toolbar">
        <div><span>Empresas cadastradas</span><h2>Acompanhamento</h2><p>Veja a situação de cada loja, suspenda ou reative. Novas lojas chegam pelas solicitações.</p></div>
        <button className="admin-primary" type="button" onClick={onOpenRequests}><Inbox size={16} /> Solicitações</button>
      </div>
      {tenants.length ? (
        <>
          <label className="admin-company-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por empresa ou filial" /></label>
          <div className="admin-company-table">
            <div className="company-table-head"><span>Empresa</span><span>Filiais</span><span>Situação</span><span>Ações</span></div>
            {visibleTenants.map((item) => {
              const companyBranches = branches.filter((branch) => branch.tenant_id === item.id);
              return (
                <article className="company-admin-card" key={item.id}>
                  <div className="company-admin-info">
                    <span className="company-admin-avatar" style={{ "--company-color": companyThemeColor(item.theme_color) } as CSSProperties}>{item.profile_image_url ? <img src={item.profile_image_url} alt="" /> : item.name.trim().slice(0, 2).toUpperCase()}</span>
                    <span><strong>{item.name}</strong><small>Identificador: {item.slug}</small>{statuses.has(item.id) ? null : <b className={item.is_active === false ? "company-status-badge inactive" : "company-status-badge active"}>{item.is_active === false ? "Inativa" : "Ativa"}</b>}</span>
                  </div>
                  <div className="company-branch-preview">
                    <strong>{companyBranches.length} {companyBranches.length === 1 ? "filial" : "filiais"}</strong>
                    <small>{companyBranches.slice(0, 2).map((branch) => branch.name).join(" · ") || "Nenhuma filial vinculada"}{companyBranches.length > 2 ? ` · +${companyBranches.length - 2}` : ""}</small>
                  </div>
                  <CompanyStatusControl tenantId={item.id} status={statuses.get(item.id)} onChanged={onStatusChanged} />
                  <div className="company-card-actions">
                    <button className="admin-secondary" type="button" onClick={() => onOpenSettings(item.id)}><Settings size={16} /> Gerenciar</button>
                    <button className="admin-primary" type="button" onClick={() => onOpenCatalog(item.id)}><Package size={16} /> Catálogo</button>
                  </div>
                </article>
              );
            })}
            {!visibleTenants.length ? <div className="admin-company-empty"><Search size={22} /><strong>Nenhuma empresa encontrada</strong><span>Revise o termo pesquisado.</span></div> : null}
          </div>
        </>
      ) : (
        <div className="admin-form-panel admin-company-empty"><Building2 size={24} /><strong>Nenhuma empresa ainda</strong><span>As lojas pedem acesso em /cadastro e aparecem em Solicitações para você aprovar.</span><button className="admin-primary" type="button" onClick={onOpenRequests}><Inbox size={16} /> Ver solicitações</button></div>
      )}
    </section>
  );
}

type DocumentFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showPrivacyHint?: boolean;
};

// Campo de documento com alternância CPF/CNPJ. O tipo vem do valor salvo até o usuário escolher.
function DocumentField({ label, value, onChange, showPrivacyHint = true }: DocumentFieldProps) {
  const inputId = useId();
  const [chosenKind, setChosenKind] = useState<DocumentKind | null>(null);
  const kind = chosenKind ?? detectDocumentKind(value);

  function selectKind(nextKind: DocumentKind) {
    setChosenKind(nextKind);
    onChange(formatDocument(value, nextKind));
  }

  return (
    <div className="document-field">
      <div className="document-field-head">
        <label htmlFor={inputId}>{label}<span className="required-mark" aria-hidden="true">*</span></label>
        <div className="document-kind" role="radiogroup" aria-label="Tipo de documento">
          {(["cpf", "cnpj"] as const).map((option) => (
            <button key={option} type="button" role="radio" aria-checked={kind === option} className={kind === option ? "active" : ""} onClick={() => selectKind(option)}>{option.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <input
        id={inputId}
        value={value}
        onChange={(event) => {
          setChosenKind(kind);
          onChange(formatDocument(event.target.value, kind));
        }}
        placeholder={DOCUMENT_PLACEHOLDER[kind]}
        inputMode="numeric"
        maxLength={documentMaxLength(kind)}
        required
      />
      {showPrivacyHint && kind === "cpf" ? <small className="document-field-hint">O CPF não aparece no catálogo nem nos links públicos.</small> : null}
    </div>
  );
}

// O login é um só, em /acesso; ele decide o painel pelos papéis da conta.
function LoginRedirect() {
  useEffect(() => {
    window.location.replace("/acesso");
  }, []);
  return <main className="admin-page"><section className="admin-login-card"><Building2 size={28} /><h1>Entrar</h1><p className="admin-muted">Abrindo a tela de entrada...</p><a className="admin-primary" href="/acesso">Ir para a entrada</a></section></main>;
}

function AdminDenied() {
  return <main className="admin-page"><section className="admin-login-card"><Building2 size={28} /><span>Central dos administradores</span><h1>Acesso não autorizado</h1><p className="admin-message">Esta conta não é administradora da plataforma.</p><a className="admin-primary" href="/acesso">Ir para a minha área</a></section></main>;
}

export default AdminPage;

function formatWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55/, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

