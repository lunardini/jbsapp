// ============================================================================
// dashboard.js — painel de ocorrências.
//
// O período vai para o Firestore (where + orderBy no MESMO campo dataRef, que
// usa o índice automático). Motivo e usuário são filtrados na memória, sobre um
// conjunto já reduzido — sem precisar criar índice composto no console.
// ============================================================================
import { db, COL, collection, query, where, orderBy, getDocs } from "./firebase.js";
import { NOMES_MOTIVOS } from "./config.js";
import {
  $, $$, aviso, hoje, diasAtras, fmtBRL, fmtKg, fmtNum, dataHoraBR, dataBR,
  escapeHtml, comCarregamento, mensagemDeErro,
} from "./ui.js";

let carregadas = [];  // resultado do período
let visiveis = [];    // o que está na tela = o que é exportado

async function carregarPeriodo(inicio, fim) {
  const snap = await getDocs(query(
    collection(db, COL.ocorrencias),
    where("dataRef", ">=", inicio),
    where("dataRef", "<=", fim),
    orderBy("dataRef", "desc")
  ));
  const itens = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  itens.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  return itens;
}

function preencherUsuarios() {
  const emails = [...new Set(carregadas.map((o) => o.criadoPorEmail).filter(Boolean))].sort();
  const atual = $("#filtro-usuario").value;
  $("#filtro-usuario").innerHTML = `<option value="">Todos os usuários</option>` +
    emails.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
  if (emails.includes(atual)) $("#filtro-usuario").value = atual;
}

function desenharIndicadores() {
  const valor = visiveis.reduce((s, o) => s + (o.totalValor || 0), 0);
  const peso = visiveis.reduce((s, o) => s + (o.totalPeso || 0), 0);
  const nfs = new Set(visiveis.map((o) => o.numeroNf)).size;

  $("#indicadores").innerHTML = [
    ["Ocorrências", fmtNum(visiveis.length), "no recorte atual"],
    ["Notas afetadas", fmtNum(nfs), "NFs distintas"],
    ["Valor devolvido", fmtBRL(valor), "soma dos itens"],
    ["Peso devolvido", fmtKg(peso), "líquido proporcional"],
  ].map(([r, v, apoio], i) => `
    <div class="indicador ${i === 2 ? "indicador--destaque" : ""}">
      <span class="indicador__rotulo">${r}</span>
      <strong class="indicador__valor mono">${v}</strong>
      <small class="indicador__apoio">${apoio}</small>
    </div>`).join("");
}

/** Barras proporcionais em CSS puro — nenhuma biblioteca de gráfico. */
function desenharDistribuicao() {
  const agrupar = (chave) => {
    const mapa = new Map();
    for (const o of visiveis) {
      const k = chave(o) || "—";
      const atual = mapa.get(k) || { qtd: 0, valor: 0 };
      atual.qtd++; atual.valor += o.totalValor || 0;
      mapa.set(k, atual);
    }
    return [...mapa.entries()].sort((a, b) => b[1].qtd - a[1].qtd);
  };

  const barras = (dados) => {
    if (!dados.length) return `<p class="vazio vazio--baixo">Sem dados no recorte.</p>`;
    const maior = dados[0][1].qtd;
    return dados.map(([nome, d]) => `
      <div class="barra">
        <span class="barra__nome">${escapeHtml(nome)}</span>
        <span class="barra__trilho"><span class="barra__preenchida" style="width:${(d.qtd / maior) * 100}%"></span></span>
        <span class="barra__valor mono">${fmtNum(d.qtd)}</span>
      </div>`).join("");
  };

  $("#por-motivo").innerHTML = barras(agrupar((o) => o.motivo));
  $("#por-usuario").innerHTML = barras(agrupar((o) => o.criadoPor?.nome || o.criadoPorEmail));
}

function desenharTabela() {
  const corpo = $("#tabela-oco tbody");
  if (!visiveis.length) {
    corpo.innerHTML = `<tr><td colspan="9" class="vazio">
      Nenhuma ocorrência neste recorte. Amplie o período ou limpe os filtros.</td></tr>`;
  } else {
    corpo.innerHTML = visiveis.map((o, i) => `
      <tr class="linha-mestre" data-linha="${i}" tabindex="0" aria-expanded="false">
        <td class="mono">${escapeHtml(o.numeroNfOriginal || o.numeroNf)}</td>
        <td class="mono">${escapeHtml(o.placa || "—")}</td>
        <td><span class="pilula pilula--motivo">${escapeHtml(o.motivo)}</span></td>
        <td>${escapeHtml(o.cliente || "—")}</td>
        <td>${escapeHtml(o.vendedor || "—")}</td>
        <td class="num mono">${fmtNum(o.itens?.length || 0)}</td>
        <td class="num mono forte">${fmtBRL(o.totalValor)}</td>
        <td class="num mono">${fmtKg(o.totalPeso)}</td>
        <td>${escapeHtml(o.criadoPor?.nome || o.criadoPorEmail || "—")}<br>
            <small class="mono apagado">${dataHoraBR(o.criadoEm)}</small></td>
      </tr>
      <tr class="linha-detalhe" data-detalhe="${i}" hidden>
        <td colspan="9">
          ${o.observacao ? `<p class="detalhe-obs"><strong>Observação:</strong> ${escapeHtml(o.observacao)}</p>` : ""}
          ${o.itens?.length ? `
            <table class="tabela tabela--compacta">
              <thead><tr><th>Código</th><th>Item</th><th class="num">Devolvido</th><th class="num">Quebra</th><th class="num">Peso</th><th class="num">Valor</th></tr></thead>
              <tbody>${o.itens.map((it) => `
                <tr><td class="mono">${escapeHtml(it.codigo)}</td><td>${escapeHtml(it.descricao)}</td>
                    <td class="num mono">${fmtNum(it.devolvido)}</td><td class="num mono">${fmtNum(it.quebra)}</td>
                    <td class="num mono">${fmtKg(it.pesoDevolvido)}</td><td class="num mono">${fmtBRL(it.valorDevolvido)}</td></tr>`).join("")}
              </tbody>
            </table>` : `<p class="detalhe-obs apagado">Motivo sem detalhamento por item.</p>`}
        </td>
      </tr>`).join("");

    $$(".linha-mestre").forEach((tr) => {
      const alternar = () => {
        const det = $(`[data-detalhe="${tr.dataset.linha}"]`);
        det.hidden = !det.hidden;
        tr.setAttribute("aria-expanded", String(!det.hidden));
        tr.classList.toggle("linha-mestre--aberta", !det.hidden);
      };
      tr.addEventListener("click", alternar);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternar(); } });
    });
  }
  $("#btn-exportar").disabled = visiveis.length === 0;
  $("#contador").textContent = `${fmtNum(visiveis.length)} de ${fmtNum(carregadas.length)} ocorrências do período`;
}

function aplicarFiltros() {
  const motivo = $("#filtro-motivo").value;
  const usuario = $("#filtro-usuario").value;
  const busca = $("#filtro-texto").value.trim().toUpperCase();
  visiveis = carregadas.filter((o) =>
    (!motivo || o.motivo === motivo) &&
    (!usuario || o.criadoPorEmail === usuario) &&
    (!busca || [o.numeroNf, o.placa, o.cliente, o.vendedor].join(" ").toUpperCase().includes(busca)));
  desenharIndicadores();
  desenharDistribuicao();
  desenharTabela();
}

/** Exporta exatamente o que está filtrado, em duas abas: notas e itens. */
function exportar() {
  const resumo = visiveis.map((o) => ({
    NF: o.numeroNfOriginal || o.numeroNf,
    Placa: o.placa || "",
    Motivo: o.motivo,
    Cliente: o.cliente || "",
    Vendedor: o.vendedor || "",
    Motorista: o.motorista || "",
    Cidade: o.cidade || "",
    Observacao: o.observacao || "",
    Itens_Afetados: o.itens?.length || 0,
    Peso_Devolvido: Number(o.totalPeso || 0),
    Valor_Devolvido: Number(o.totalValor || 0),
    Valor_Nota: Number(o.valorNota || 0),
    Registrado_Por: o.criadoPor?.nome || "",
    Email_Usuario: o.criadoPorEmail || "",
    Data: o.dataRef || "",
    Data_Hora: dataHoraBR(o.criadoEm),
  }));

  const itens = visiveis.flatMap((o) => (o.itens || []).map((i) => ({
    NF: o.numeroNfOriginal || o.numeroNf,
    Motivo: o.motivo,
    Codigo_Item: i.codigo,
    Descricao_Item: i.descricao,
    Qtd_Nota: Number(i.quantidade || 0),
    Devolvido: Number(i.devolvido || 0),
    Quebra: Number(i.quebra || 0),
    Unidade: o.unidade || "",
    Peso_Devolvido: Number(i.pesoDevolvido || 0),
    Valor_Unitario: Number(i.valorUnitario || 0),
    Valor_Devolvido: Number(i.valorDevolvido || 0),
    Data: o.dataRef || "",
  })));

  const pasta = XLSX.utils.book_new();
  const abaResumo = XLSX.utils.json_to_sheet(resumo);
  abaResumo["!cols"] = Object.keys(resumo[0] || { a: 1 }).map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(pasta, abaResumo, "Ocorrências");
  if (itens.length) {
    const abaItens = XLSX.utils.json_to_sheet(itens);
    abaItens["!cols"] = Object.keys(itens[0]).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(pasta, abaItens, "Itens");
  }
  XLSX.writeFile(pasta, `ocorrencias_${$("#filtro-inicio").value}_a_${$("#filtro-fim").value}.xlsx`);
  aviso("Arquivo gerado. Confira a pasta de downloads.", "ok");
}

function atalhoPeriodo(dias) {
  $("#filtro-inicio").value = dias === 0 ? hoje() : diasAtras(dias);
  $("#filtro-fim").value = hoje();
  atualizar();
}

export async function atualizar(botao) {
  const executar = async () => {
    try {
      carregadas = await carregarPeriodo($("#filtro-inicio").value, $("#filtro-fim").value);
      $("#legenda-periodo").textContent =
        `${dataBR($("#filtro-inicio").value)} a ${dataBR($("#filtro-fim").value)}`;
      preencherUsuarios();
      aplicarFiltros();
    } catch (e) { aviso(mensagemDeErro(e), "erro"); }
  };
  botao ? await comCarregamento(botao, "Atualizando…", executar) : await executar();
}

export function iniciarDashboard() {
  $("#filtro-motivo").innerHTML = `<option value="">Todos os motivos</option>` +
    NOMES_MOTIVOS.map((m) => `<option>${m}</option>`).join("");
  $("#filtro-inicio").value = diasAtras(30);
  $("#filtro-fim").value = hoje();

  $("#btn-atualizar").addEventListener("click", (ev) => atualizar(ev.currentTarget));
  ["#filtro-motivo", "#filtro-usuario"].forEach((s) => $(s).addEventListener("change", aplicarFiltros));
  $("#filtro-texto").addEventListener("input", aplicarFiltros);
  $("#btn-limpar").addEventListener("click", () => {
    $("#filtro-motivo").value = ""; $("#filtro-usuario").value = ""; $("#filtro-texto").value = "";
    aplicarFiltros();
  });
  $$("[data-periodo]").forEach((b) =>
    b.addEventListener("click", () => atalhoPeriodo(Number(b.dataset.periodo))));
  $("#btn-exportar").addEventListener("click", exportar);

  atualizar();
}
