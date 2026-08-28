// ============================================================================
// dashboard.js — lista, filtra e exporta as ocorrências.
//
// Estratégia de consulta: o período vai para o Firestore (where + orderBy no
// MESMO campo dataRef, que usa o índice automático e não exige criar índice
// composto). Motivo e usuário são filtrados na memória, sobre o resultado do
// período — sempre um conjunto pequeno.
// ============================================================================
import { db, COL, collection, query, where, orderBy, getDocs } from "./firebase.js";
import { MOTIVOS } from "./config.js";
import { $, aviso, hoje, fmtBRL, fmtKg, fmtNum, dataHoraBR, escapeHtml, comCarregamento, mensagemDeErro } from "./ui.js";

let ocorrenciasCarregadas = [];  // resultado bruto do período
let ocorrenciasVisiveis = [];    // o que está na tela = o que é exportado

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function carregarPeriodo(inicio, fim) {
  const consulta = query(
    collection(db, COL.ocorrencias),
    where("dataRef", ">=", inicio),
    where("dataRef", "<=", fim),
    orderBy("dataRef", "desc")
  );
  const snap = await getDocs(consulta);
  const itens = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  itens.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  return itens;
}

function preencherFiltroUsuarios() {
  const emails = [...new Set(ocorrenciasCarregadas.map((o) => o.criadoPorEmail).filter(Boolean))].sort();
  const atual = $("#filtro-usuario").value;
  $("#filtro-usuario").innerHTML =
    `<option value="">Todos os usuários</option>` +
    emails.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
  if (emails.includes(atual)) $("#filtro-usuario").value = atual;
}

function aplicarFiltros() {
  const motivo = $("#filtro-motivo").value;
  const usuario = $("#filtro-usuario").value;
  ocorrenciasVisiveis = ocorrenciasCarregadas.filter((o) =>
    (!motivo || o.motivo === motivo) && (!usuario || o.criadoPorEmail === usuario));
  desenharTabela();
}

function desenharTabela() {
  const corpo = $("#tabela-oco tbody");
  if (!ocorrenciasVisiveis.length) {
    corpo.innerHTML = `<tr><td colspan="8" class="vazio">Nenhuma ocorrência neste recorte. Amplie o período ou limpe os filtros.</td></tr>`;
  } else {
    corpo.innerHTML = ocorrenciasVisiveis.map((o) => `
      <tr>
        <td class="mono">${escapeHtml(o.numeroNfOriginal || o.numeroNf)}</td>
        <td class="mono">${escapeHtml(o.placa || "—")}</td>
        <td><span class="etiqueta">${escapeHtml(o.motivo)}</span></td>
        <td>${escapeHtml(o.vendedor || "—")}</td>
        <td class="num mono">${fmtBRL(o.valor)}</td>
        <td class="num mono">${fmtKg(o.peso)}</td>
        <td>${escapeHtml(o.criadoPor?.nome || o.criadoPorEmail || "—")}</td>
        <td class="mono">${dataHoraBR(o.criadoEm)}</td>
      </tr>`).join("");
  }
  const valor = ocorrenciasVisiveis.reduce((s, o) => s + (o.valor || 0), 0);
  const peso = ocorrenciasVisiveis.reduce((s, o) => s + (o.peso || 0), 0);
  $("#oco-total").textContent =
    `${fmtNum(ocorrenciasVisiveis.length)} ocorrências · ${fmtBRL(valor)} · ${fmtKg(peso)}`;
  $("#btn-exportar").disabled = ocorrenciasVisiveis.length === 0;
}

/** Exporta exatamente o que está filtrado na tela. */
function exportarXlsx() {
  const linhas = ocorrenciasVisiveis.map((o) => ({
    NF: o.numeroNfOriginal || o.numeroNf,
    Placa: o.placa || "",
    Motivo: o.motivo,
    Observacao: o.observacao || "",
    Cliente: o.cliente || "",
    Vendedor: o.vendedor || "",
    Email_Vendedor: o.emailVendedor || "",
    Valor: Number(o.valor || 0),
    Peso: Number(o.peso || 0),
    Registrado_Por: o.criadoPor?.nome || "",
    Email_Usuario: o.criadoPorEmail || "",
    Data: o.dataRef || "",
    Data_Hora: dataHoraBR(o.criadoEm),
  }));
  const aba = XLSX.utils.json_to_sheet(linhas);
  aba["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 40 }, { wch: 28 },
                  { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 18 },
                  { wch: 28 }, { wch: 12 }, { wch: 18 }];
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, aba, "Ocorrências");
  XLSX.writeFile(pasta, `ocorrencias_${$("#filtro-inicio").value}_a_${$("#filtro-fim").value}.xlsx`);
}

export function iniciarDashboard() {
  $("#filtro-motivo").innerHTML =
    `<option value="">Todos os motivos</option>` + MOTIVOS.map((m) => `<option>${m}</option>`).join("");
  $("#filtro-inicio").value = diasAtras(30);
  $("#filtro-fim").value = hoje();

  $("#btn-atualizar").addEventListener("click", (ev) => atualizar(ev.currentTarget));
  $("#filtro-motivo").addEventListener("change", aplicarFiltros);
  $("#filtro-usuario").addEventListener("change", aplicarFiltros);
  $("#btn-limpar-filtros").addEventListener("click", () => {
    $("#filtro-motivo").value = "";
    $("#filtro-usuario").value = "";
    aplicarFiltros();
  });
  $("#btn-exportar").addEventListener("click", exportarXlsx);
}

export async function atualizar(botao) {
  const executar = async () => {
    try {
      ocorrenciasCarregadas = await carregarPeriodo($("#filtro-inicio").value, $("#filtro-fim").value);
      preencherFiltroUsuarios();
      aplicarFiltros();
    } catch (e) { aviso(mensagemDeErro(e), "erro"); }
  };
  botao ? await comCarregamento(botao, "Atualizando…", executar) : await executar();
}
