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

/** Só letras e dígitos, em maiúsculas. Usado para NF e placa. */
export function chave(txt) {
  return String(txt ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Converte "1.234,56", "1234.56", 1234.56 → 1234.56. Retorna 0 se não der. */
export function paraNumero(valor) {
  if (typeof valor === "number") return isFinite(valor) ? valor : 0;
  let t = String(valor ?? "").trim();
  if (!t) return 0;
  t = t.replace(/[R$\s\u00A0]/g, "").replace(/kg/gi, "");
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}

export const fmtBRL = (n) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDec = (n, casas = 2) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const fmtKg = (n) => `${fmtDec(n)} kg`;
export const fmtNum = (n) => Number(n || 0).toLocaleString("pt-BR");

/** Quantidade com a unidade da nota ("un" ou "kg"). */
export const fmtQtd = (n, unidade = "un") =>
  unidade === "kg" ? fmtKg(n) : `${fmtDec(n, Number.isInteger(Number(n)) ? 0 : 2)} un`;

/** Data local no formato YYYY-MM-DD (usada como campo de filtro no Firestore). */
export function hoje() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dataHoraBR(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function dataBR(iso) {
  if (!iso) return "—";
  const [a, m, d] = String(iso).split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

export function escapeHtml(txt) {
  return String(txt ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Aviso temporário no canto da tela. tipo: "ok" | "erro" | "info" */
export function aviso(mensagem, tipo = "info", duracaoMs = 4500) {
  let caixa = $("#avisos");
  if (!caixa) {
    caixa = document.createElement("div");
    caixa.id = "avisos";
    caixa.className = "avisos";
    caixa.setAttribute("aria-live", "polite");
    document.body.appendChild(caixa);
  }
  const el = document.createElement("div");
  el.className = `aviso aviso--${tipo}`;
  el.setAttribute("role", tipo === "erro" ? "alert" : "status");
  el.textContent = mensagem;
  caixa.appendChild(el);
  setTimeout(() => { el.classList.add("aviso--saindo"); setTimeout(() => el.remove(), 250); }, duracaoMs);
}

/** Desabilita um botão e troca o rótulo enquanto uma promise roda. */
export async function comCarregamento(botao, rotuloOcupado, tarefa) {
  const original = botao.innerHTML;
  botao.disabled = true;
  botao.classList.add("botao--ocupado");
  botao.textContent = rotuloOcupado;
  try { return await tarefa(); }
  finally { botao.disabled = false; botao.classList.remove("botao--ocupado"); botao.innerHTML = original; }
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
