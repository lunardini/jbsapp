// ============================================================================
// ui.js — helpers de DOM, formatação e feedback. Sem regra de negócio aqui.
// ============================================================================

export const $  = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

/** Remove acentos, pontuação e espaços. Usado para casar cabeçalhos e chaves. */
export function normalizar(txt) {
  return String(txt ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Só dígitos e letras, em maiúsculas. Usado para NF e placa. */
export function chave(txt) {
  return String(txt ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Converte "1.234,56", "1234.56", 1234.56 → 1234.56. Retorna 0 se não der. */
export function paraNumero(valor) {
  if (typeof valor === "number") return isFinite(valor) ? valor : 0;
  let t = String(valor ?? "").trim();
  if (!t) return 0;
  t = t.replace(/[R$\s\u00A0kgKG]/g, "");
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}

export const fmtBRL = (n) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtKg = (n) =>
  `${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;

export const fmtNum = (n) => Number(n || 0).toLocaleString("pt-BR");

/** Data local no formato YYYY-MM-DD (usada como campo de filtro no Firestore). */
export function hoje() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dataHoraBR(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function escapeHtml(txt) {
  return String(txt ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Aviso temporário no canto da tela. tipo: "ok" | "erro" | "info" */
export function aviso(mensagem, tipo = "info", duracaoMs = 4500) {
  const caixa = $("#avisos");
  if (!caixa) return;
  const el = document.createElement("div");
  el.className = `aviso aviso--${tipo}`;
  el.setAttribute("role", tipo === "erro" ? "alert" : "status");
  el.textContent = mensagem;
  caixa.appendChild(el);
  setTimeout(() => { el.classList.add("aviso--saindo"); setTimeout(() => el.remove(), 250); }, duracaoMs);
}

/** Desabilita um botão e troca o rótulo enquanto uma promise roda. */
export async function comCarregamento(botao, rotuloOcupado, tarefa) {
  const original = botao.textContent;
  botao.disabled = true;
  botao.textContent = rotuloOcupado;
  try { return await tarefa(); }
  finally { botao.disabled = false; botao.textContent = original; }
}

/** Traduz códigos do Firebase para frases que dizem o que fazer. */
export function mensagemDeErro(erro) {
  const cod = erro?.code || "";
  const mapa = {
    "auth/invalid-email": "E-mail em formato inválido.",
    "auth/user-not-found": "Não existe usuário com esse e-mail.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos.",
    "auth/network-request-failed": "Sem conexão com o Firebase. Verifique a rede corporativa/proxy.",
    "permission-denied": "Seu usuário não tem permissão para esta operação.",
    "failed-precondition": "O Firestore pediu um índice para esta consulta. Abra o console (F12): o link de criação está no erro.",
    "unavailable": "Firestore indisponível no momento. Tente de novo.",
  };
  return mapa[cod] || erro?.message || "Não foi possível concluir a operação.";
}
