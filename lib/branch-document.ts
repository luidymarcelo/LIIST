// Documento da filial: CPF (pessoa física) ou CNPJ (empresa). Guardado só com dígitos.
export type DocumentKind = "cpf" | "cnpj";

const DOCUMENT_LENGTH: Record<DocumentKind, number> = { cpf: 11, cnpj: 14 };

export const DOCUMENT_PLACEHOLDER: Record<DocumentKind, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0001-00",
};

export function documentDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function detectDocumentKind(value: string | null | undefined): DocumentKind {
  return documentDigits(value).length === DOCUMENT_LENGTH.cpf ? "cpf" : "cnpj";
}

export function documentMaxLength(kind: DocumentKind): number {
  return DOCUMENT_PLACEHOLDER[kind].length;
}

export function formatDocument(value: string, kind: DocumentKind): string {
  const digits = documentDigits(value).slice(0, DOCUMENT_LENGTH[kind]);
  if (kind === "cpf") {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// Para campos sem seletor: até 11 dígitos usa a máscara de CPF, acima disso a de CNPJ.
export function formatDocumentAuto(value: string): string {
  const kind: DocumentKind = documentDigits(value).length > DOCUMENT_LENGTH.cpf ? "cnpj" : "cpf";
  return formatDocument(value, kind);
}

export function isValidCpf(value: string): boolean {
  const digits = documentDigits(value);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const checkDigit = (length: number) => {
    let total = 0;
    for (let index = 0; index < length; index += 1) total += Number(digits[index]) * (length + 1 - index);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

export function isValidCnpj(value: string): boolean {
  const digits = documentDigits(value);
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const checkDigit = (length: number) => {
    let factor = length - 7;
    let total = 0;
    for (let index = 0; index < length; index += 1) {
      total += Number(digits[index]) * factor;
      factor -= 1;
      if (factor === 1) factor = 9;
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13]);
}

// Sem tipo informado, aceita o documento válido de qualquer um dos dois tipos.
export function isValidDocument(value: string, kind?: DocumentKind): boolean {
  if (kind === "cpf") return isValidCpf(value);
  if (kind === "cnpj") return isValidCnpj(value);
  return isValidCpf(value) || isValidCnpj(value);
}

export function invalidDocumentMessage(kind: DocumentKind): string {
  return kind === "cpf" ? "Informe um CPF válido." : "Informe um CNPJ válido.";
}
