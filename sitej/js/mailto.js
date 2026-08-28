// ============================================================================
// mailto.js — monta e dispara rascunhos no Outlook.
//
// Pontos que costumam quebrar o mailto no Windows e que estão tratados aqui:
//  • Quebra de linha precisa virar %0D%0A (CRLF). "\n" sozinho some no Outlook.
//  • & ? = # nos textos precisam ser escapados, senão cortam a URL no meio.
//  • O Windows trunca o mailto em ~2000 caracteres. O corpo é cortado com aviso
//    antes disso, para o e-mail nunca chegar mutilado sem você perceber.
//  • Vários destinatários: a RFC 6068 manda vírgula. O Outlook aceita, mas se
//    a sua instalação estiver configurada para ponto e vírgula, troque
//    SEPARADOR abaixo para ";".
// ============================================================================
import { aviso } from "./ui.js";

const LIMITE_URL = 1900;
const SEPARADOR = ",";

/** Junta, limpa e valida uma lista de e-mails vinda da planilha. */
export function listaDeEmails(entrada) {
  const bruto = Array.isArray(entrada) ? entrada : [entrada];
  const vistos = new Set();
  return bruto
    .flatMap((e) => String(e ?? "").split(/[;,]/))
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .filter((e) => { const k = e.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .join(SEPARADOR);
}

/** Monta o corpo a partir de pares [rótulo, valor], já no formato do Outlook. */
export function corpoDeCampos(saudacao, campos, rodape = "") {
  const linhas = [saudacao, ""];
  for (const [rotulo, valor] of campos) {
    if (valor === undefined || valor === null || valor === "") continue;
    linhas.push(`${rotulo}: ${valor}`);
  }
  if (rodape) linhas.push("", rodape);
  return linhas.join("\r\n");
}

/** Codifica preservando o CRLF como %0D%0A. */
function codificar(texto) {
  return encodeURIComponent(String(texto).replace(/\r?\n/g, "\r\n"));
}

/**
 * Monta a URL mailto:. Corta o corpo se estourar o limite do Windows.
 * @returns {{url: string, cortado: boolean}}
 */
export function montarMailto({ para, cc = "", assunto = "", corpo = "" }) {
  const destino = listaDeEmails(para);
  const copia = listaDeEmails(cc);
  const base = `mailto:${destino}?${copia ? `cc=${encodeURIComponent(copia)}&` : ""}subject=${codificar(assunto)}&body=`;

  let texto = corpo;
  let cortado = false;
  while (base.length + codificar(texto).length > LIMITE_URL && texto.length > 120) {
    texto = texto.slice(0, Math.floor(texto.length * 0.9));
    cortado = true;
  }
  if (cortado) texto += "\r\n\r\n[Conteúdo abreviado. Consulte o registro completo no sistema.]";

  return { url: base + codificar(texto), cortado };
}

/**
 * Abre o rascunho no Outlook. Usa um <a> clicado por código em vez de
 * window.open: o navegador não trata isso como pop-up, então funciona mesmo
 * depois de um await (a gravação no Firestore).
 */
export function abrirRascunho(dados) {
  const { url, cortado } = montarMailto(dados);
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 0);
  if (cortado) aviso("O corpo do e-mail foi abreviado para caber no limite do Outlook.", "info");
  return url;
}

/** Plano B quando o Outlook não é o cliente padrão: copia o e-mail pronto. */
export async function copiarComoTexto({ para, cc, assunto, corpo }) {
  const texto = [
    `Para: ${listaDeEmails(para)}`,
    cc ? `Cc: ${listaDeEmails(cc)}` : "",
    `Assunto: ${assunto}`,
    "",
    corpo,
  ].filter(Boolean).join("\r\n");
  try {
    await navigator.clipboard.writeText(texto);
    aviso("E-mail copiado. Cole no Outlook com Ctrl+V.", "ok");
  } catch {
    aviso("O navegador bloqueou a cópia. Selecione o texto do painel manualmente.", "erro");
  }
  return texto;
}

/** Guarda o último rascunho para o botão "Reabrir no Outlook". */
export let ultimoRascunho = null;
export function guardarRascunho(dados) { ultimoRascunho = dados; }
