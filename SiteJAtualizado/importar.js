// ============================================================================
// importar.js — planilha (uma linha por ITEM) → uma nota com lista de itens.
//
// Correção importante em relação à versão anterior: como o ID do documento é o
// número da NF e a planilha repete a NF em cada item, gravar linha a linha
// fazia cada item sobrescrever o anterior — sobrava só o último. Agora as
// linhas são agrupadas por NF antes de gravar.
// ============================================================================
import { db, COL, doc, writeBatch, serverTimestamp } from "./firebase.js";
import { COLUNAS, COLUNAS_OBRIGATORIAS, BASE_ITEM, DESTINATARIOS_PADRAO } from "./config.js";
import {
  $, aviso, chave, normalizar, paraNumero, fmtNum, fmtBRL, fmtKg,
  comCarregamento, mensagemDeErro, escapeHtml,
} from "./ui.js";
import { autor } from "./auth.js";

const TAMANHO_LOTE = 300; // limite do Firestore é 500 operações por lote

const CAMPOS_ITEM = ["codigoItem", "descricaoItem", "pesoLiquido", "valorUnitario", "quantidade"];

/** Descobre qual coluna da planilha corresponde a cada campo do sistema. */
function mapearCabecalho(cabecalhos) {
  const indice = new Map(cabecalhos.map((h) => [normalizar(h), h]));
  const mapa = {};
  for (const [campo, apelidos] of Object.entries(COLUNAS)) {
    for (const apelido of apelidos) {
      const achou = indice.get(normalizar(apelido));
      if (achou) { mapa[campo] = achou; break; }
    }
  }
  return mapa;
}

/**
 * Alguns ERPs repetem o peso da nota em toda linha; outros trazem o peso da
 * linha. Se todos os valores da NF forem iguais, é campo de cabeçalho e o
 * sistema pega um só. Se variarem, é campo de linha e o sistema soma.
 */
function agregarNumerico(valores) {
  const nums = valores.map(paraNumero);
  if (!nums.length) return 0;
  const todosIguais = nums.every((n) => n === nums[0]);
  return todosIguais ? nums[0] : nums.reduce((a, b) => a + b, 0);
}

/** Agrupa as linhas por NF e devolve as notas prontas para gravar. */
export function agruparNotas(linhas, mapa, contexto) {
  const ler = (linha, campo) => (mapa[campo] ? linha[mapa[campo]] : undefined);
  const texto = (linha, campo) => String(ler(linha, campo) ?? "").trim();

  const temColunaQuantidade = Boolean(mapa.quantidade);
  const unidade = BASE_ITEM === "auto" ? (temColunaQuantidade ? "un" : "kg") : BASE_ITEM;

  const porNf = new Map();
  let ignoradas = 0;

  for (const linha of linhas) {
    const numeroNf = chave(ler(linha, "numeroNf"));
    if (!numeroNf) { ignoradas++; continue; }

    if (!porNf.has(numeroNf)) {
      porNf.set(numeroNf, {
        numeroNf,
        numeroNfOriginal: texto(linha, "numeroNf"),
        placa: chave(ler(linha, "placa")),
        placaOriginal: texto(linha, "placa"),
        vendedor: texto(linha, "vendedor"),
        cliente: texto(linha, "cliente"),
        codigoCliente: texto(linha, "codigoCliente"),
        cidade: texto(linha, "cidade"),
        bairro: texto(linha, "bairro"),
        endereco: texto(linha, "endereco"),
        motorista: texto(linha, "motorista"),
        descricao: texto(linha, "descricao"),
        emailVendedor: texto(linha, "emailVendedor") || DESTINATARIOS_PADRAO.para,
        emailLogistica: texto(linha, "emailLogistica") || DESTINATARIOS_PADRAO.cc,
        unidade,
        itens: [],
        _pesos: [],
      });
    }
    const nota = porNf.get(numeroNf);
    nota._pesos.push(ler(linha, "peso"));

    // Linha sem nenhum dado de item (planilha só de cabeçalho) não vira item.
    if (!CAMPOS_ITEM.some((c) => mapa[c] && String(ler(linha, c) ?? "").trim() !== "")) continue;

    const codigo = texto(linha, "codigoItem") || `LINHA-${nota.itens.length + 1}`;
    const pesoLiquido = paraNumero(ler(linha, "pesoLiquido"));
    const quantidade = temColunaQuantidade ? paraNumero(ler(linha, "quantidade")) : pesoLiquido;
    const valorUnitario = paraNumero(ler(linha, "valorUnitario"));

    // Mesmo código na mesma NF: soma em vez de duplicar a linha.
    const existente = nota.itens.find((i) => i.codigo === codigo);
    if (existente) {
      existente.quantidade += quantidade;
      existente.pesoLiquido += pesoLiquido;
      if (!existente.valorUnitario) existente.valorUnitario = valorUnitario;
    } else {
      nota.itens.push({
        codigo,
        descricao: texto(linha, "descricaoItem") || "(sem descrição na planilha)",
        pesoLiquido,
        quantidade,
        valorUnitario,
      });
    }
  }

  const notas = [...porNf.values()].map((nota) => {
    const { _pesos, ...limpa } = nota;
    for (const item of limpa.itens) item.valorTotal = +(item.quantidade * item.valorUnitario).toFixed(2);
    limpa.peso = agregarNumerico(_pesos);
    limpa.pesoLiquido = +limpa.itens.reduce((s, i) => s + i.pesoLiquido, 0).toFixed(3);
    limpa.valor = +limpa.itens.reduce((s, i) => s + i.valorTotal, 0).toFixed(2);
    limpa.qtdItens = limpa.itens.length;
    limpa.lote = contexto.lote;
    limpa.importadoPor = contexto.autor;
    return limpa;
  });

  return { notas, ignoradas, unidade };
}

async function lerPlanilha(arquivo) {
  const buffer = await arquivo.arrayBuffer();
  const pasta = XLSX.read(buffer, { type: "array", cellDates: true });
  const aba = pasta.Sheets[pasta.SheetNames[0]];
  if (!aba) throw new Error("O arquivo não tem nenhuma aba com dados.");
  const linhas = XLSX.utils.sheet_to_json(aba, { defval: "", raw: false });
  if (!linhas.length) throw new Error("A primeira aba está vazia.");
  return linhas;
}

function desenharPreVisualizacao(arquivo, linhas, mapa, previa) {
  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !mapa[c]);
  const encontradas = Object.keys(COLUNAS).filter((c) => mapa[c]).length;

  $("#import-resultado").hidden = false;
  $("#import-cartoes").innerHTML = [
    ["Linhas no arquivo", fmtNum(linhas.length)],
    ["Notas fiscais", fmtNum(previa.notas.length)],
    ["Itens no total", fmtNum(previa.notas.reduce((s, n) => s + n.qtdItens, 0))],
    ["Valor da carga", fmtBRL(previa.notas.reduce((s, n) => s + n.valor, 0))],
  ].map(([r, v]) => `
    <div class="indicador">
      <span class="indicador__rotulo">${r}</span>
      <strong class="indicador__valor mono">${v}</strong>
    </div>`).join("");

  $("#import-mapa").innerHTML = Object.keys(COLUNAS).map((campo) => {
    const ok = Boolean(mapa[campo]);
    const obrigatorio = COLUNAS_OBRIGATORIAS.includes(campo);
    return `<tr class="${ok ? "" : obrigatorio ? "linha--erro" : "linha--apagada"}">
      <td class="mono">${campo}${obrigatorio ? ' <span class="marcador">obrigatória</span>' : ""}</td>
      <td>${ok ? escapeHtml(mapa[campo]) : "— não encontrada —"}</td>
      <td>${ok ? '<span class="pilula pilula--ok">casou</span>' : obrigatorio ? '<span class="pilula pilula--erro">falta</span>' : '<span class="pilula">ignorada</span>'}</td>
    </tr>`;
  }).join("");

  const amostra = previa.notas.slice(0, 3);
  $("#import-amostra").innerHTML = amostra.map((n) => `
    <details class="amostra">
      <summary><span class="mono">NF ${escapeHtml(n.numeroNfOriginal)}</span> · ${escapeHtml(n.cliente || "sem cliente")} · ${n.qtdItens} itens · ${fmtBRL(n.valor)}</summary>
      <table class="tabela tabela--compacta">
        <thead><tr><th>Código</th><th>Item</th><th class="num">Qtd</th><th class="num">Peso líq.</th><th class="num">Vl. unit.</th></tr></thead>
        <tbody>${n.itens.slice(0, 8).map((i) => `
          <tr><td class="mono">${escapeHtml(i.codigo)}</td><td>${escapeHtml(i.descricao)}</td>
              <td class="num mono">${i.quantidade}</td><td class="num mono">${fmtKg(i.pesoLiquido)}</td>
              <td class="num mono">${fmtBRL(i.valorUnitario)}</td></tr>`).join("")}
        </tbody>
      </table>
    </details>`).join("");

  $("#import-nota-unidade").textContent =
    previa.unidade === "kg"
      ? "Sem coluna de quantidade na planilha: as devoluções serão contadas em quilos, usando o peso líquido como base."
      : "Coluna de quantidade encontrada: as devoluções serão contadas em unidades.";

  if (faltando.length) {
    $("#import-erro").hidden = false;
    $("#import-erro").innerHTML =
      `Faltam colunas obrigatórias: <strong>${faltando.join(", ")}</strong>.
       Acrescente o nome exato dessas colunas em <span class="mono">js/config.js</span> e selecione o arquivo de novo.`;
    $("#btn-importar").disabled = true;
  } else {
    $("#import-erro").hidden = true;
    $("#btn-importar").disabled = false;
  }
  $("#import-encontradas").textContent = `${encontradas} de ${Object.keys(COLUNAS).length} colunas reconhecidas`;
}

export function iniciarImportacao() {
  const entrada = $("#arquivo");
  const area = $("#area-arquivo");
  let arquivoSelecionado = null;
  let previaAtual = null;

  async function processar(arquivo) {
    arquivoSelecionado = arquivo;
    $("#arquivo-nome").textContent = arquivo.name;
    $("#arquivo-info").hidden = false;
    try {
      const linhas = await lerPlanilha(arquivo);
      const mapa = mapearCabecalho(Object.keys(linhas[0]));
      previaAtual = agruparNotas(linhas, mapa, { lote: "previa", autor: { nome: "", email: "" } });
      desenharPreVisualizacao(arquivo, linhas, mapa, previaAtual);
    } catch (e) {
      $("#import-erro").hidden = false;
      $("#import-erro").textContent = e.message;
      $("#btn-importar").disabled = true;
    }
  }

  entrada.addEventListener("change", () => entrada.files[0] && processar(entrada.files[0]));

  ["dragenter", "dragover"].forEach((ev) =>
    area.addEventListener(ev, (e) => { e.preventDefault(); area.classList.add("area-arquivo--sobre"); }));
  ["dragleave", "drop"].forEach((ev) =>
    area.addEventListener(ev, (e) => { e.preventDefault(); area.classList.remove("area-arquivo--sobre"); }));
  area.addEventListener("drop", (e) => {
    const arquivo = e.dataTransfer.files[0];
    if (arquivo) processar(arquivo);
  });

  $("#btn-importar").addEventListener("click", async (ev) => {
    if (!arquivoSelecionado) return;
    await comCarregamento(ev.currentTarget, "Importando…", async () => {
      try {
        const linhas = await lerPlanilha(arquivoSelecionado);
        const mapa = mapearCabecalho(Object.keys(linhas[0]));
        const { notas, ignoradas } = agruparNotas(linhas, mapa, { lote: `${Date.now()}`, autor: autor() });

        $("#import-progresso").hidden = false;
        for (let i = 0; i < notas.length; i += TAMANHO_LOTE) {
          const lote = writeBatch(db);
          for (const nota of notas.slice(i, i + TAMANHO_LOTE)) {
            lote.set(doc(db, COL.notas, nota.numeroNf), { ...nota, importadoEm: serverTimestamp() });
          }
          await lote.commit();
          const feito = Math.min(i + TAMANHO_LOTE, notas.length);
          $("#barra-progresso").style.width = `${Math.round((feito / notas.length) * 100)}%`;
          $("#texto-progresso").textContent = `${fmtNum(feito)} de ${fmtNum(notas.length)} notas gravadas`;
        }

        aviso(`${fmtNum(notas.length)} notas importadas${ignoradas ? ` · ${ignoradas} linhas sem NF ignoradas` : ""}.`, "ok");
        $("#texto-progresso").textContent = "Importação concluída.";
        $("#btn-importar").disabled = true;
      } catch (e) {
        aviso(mensagemDeErro(e), "erro");
      }
    });
  });
}
