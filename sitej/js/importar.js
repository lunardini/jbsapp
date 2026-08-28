// ============================================================================
// importar.js — planilha → Firestore, tudo no navegador.
// O SheetJS lê .xlsx, .xls e .csv, então um só caminho de código atende aos três.
// O ID de cada documento é o número da NF: reimportar o mesmo arquivo atualiza
// as notas em vez de duplicá-las.
// ============================================================================
import { db, COL, doc, writeBatch, serverTimestamp } from "./firebase.js";
import { COLUNAS, COLUNAS_OBRIGATORIAS, EMAIL_LOGISTICA_PADRAO } from "./config.js";
import { $, aviso, chave, normalizar, paraNumero, fmtNum, comCarregamento, mensagemDeErro, escapeHtml } from "./ui.js";
import { autor } from "./auth.js";

const TAMANHO_LOTE = 400; // o limite do Firestore é 500 operações por lote

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

/** Converte uma linha da planilha no documento que vai para o Firestore. */
function montarNota(linha, mapa, contexto) {
  const ler = (campo) => (mapa[campo] ? linha[mapa[campo]] : undefined);
  const numeroNf = chave(ler("numeroNf"));
  if (!numeroNf) return null;

  return {
    numeroNf,
    numeroNfOriginal: String(ler("numeroNf") ?? "").trim(),
    placa: chave(ler("placa")),
    placaOriginal: String(ler("placa") ?? "").trim(),
    valor: paraNumero(ler("valor")),
    peso: paraNumero(ler("peso")),
    vendedor: String(ler("vendedor") ?? "").trim(),
    emailVendedor: String(ler("emailVendedor") ?? "").trim(),
    emailLogistica: String(ler("emailLogistica") ?? "").trim() || EMAIL_LOGISTICA_PADRAO,
    cliente: String(ler("cliente") ?? "").trim(),
    cidade: String(ler("cidade") ?? "").trim(),
    transportadora: String(ler("transportadora") ?? "").trim(),
    dataEmissao: String(ler("dataEmissao") ?? "").trim(),
    lote: contexto.lote,
    importadoPor: contexto.autor,
    importadoEm: serverTimestamp(),
  };
}

/** Lê o arquivo e devolve as linhas já como objetos. */
async function lerPlanilha(arquivo) {
  const buffer = await arquivo.arrayBuffer();
  const pasta = XLSX.read(buffer, { type: "array", cellDates: true });
  const aba = pasta.Sheets[pasta.SheetNames[0]];
  if (!aba) throw new Error("O arquivo não tem nenhuma aba com dados.");
  const linhas = XLSX.utils.sheet_to_json(aba, { defval: "", raw: false });
  if (!linhas.length) throw new Error("A primeira aba está vazia.");
  return linhas;
}

export function iniciarImportacao() {
  const entrada = $("#arquivo");
  const painel = $("#import-resumo");
  let arquivoSelecionado = null;

  entrada.addEventListener("change", async () => {
    arquivoSelecionado = entrada.files[0] || null;
    painel.innerHTML = "";
    $("#btn-importar").disabled = true;
    if (!arquivoSelecionado) return;

    try {
      const linhas = await lerPlanilha(arquivoSelecionado);
      const mapa = mapearCabecalho(Object.keys(linhas[0]));
      const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !mapa[c]);

      painel.innerHTML = `
        <p class="resumo-linha"><strong>${escapeHtml(arquivoSelecionado.name)}</strong> — ${fmtNum(linhas.length)} linhas lidas.</p>
        <table class="tabela tabela--compacta">
          <thead><tr><th>Campo do sistema</th><th>Coluna da planilha</th></tr></thead>
          <tbody>${Object.keys(COLUNAS).map((campo) => `
            <tr class="${mapa[campo] ? "" : COLUNAS_OBRIGATORIAS.includes(campo) ? "linha--erro" : "linha--apagada"}">
              <td class="mono">${campo}</td>
              <td>${mapa[campo] ? escapeHtml(mapa[campo]) : "— não encontrada —"}</td>
            </tr>`).join("")}
          </tbody>
        </table>`;

      if (faltando.length) {
        painel.insertAdjacentHTML("beforeend",
          `<p class="alerta">Faltam colunas obrigatórias: <strong>${faltando.join(", ")}</strong>.
           Acrescente o nome real dessas colunas em <span class="mono">js/config.js</span> e selecione o arquivo de novo.</p>`);
        return;
      }
      $("#btn-importar").disabled = false;
      $("#btn-importar").dataset.linhas = String(linhas.length);
    } catch (e) {
      painel.innerHTML = `<p class="alerta">${escapeHtml(e.message)}</p>`;
    }
  });

  $("#btn-importar").addEventListener("click", async (ev) => {
    if (!arquivoSelecionado) return;
    await comCarregamento(ev.currentTarget, "Importando…", async () => {
      try {
        const linhas = await lerPlanilha(arquivoSelecionado);
        const mapa = mapearCabecalho(Object.keys(linhas[0]));
        const contexto = { lote: `${Date.now()}`, autor: autor() };

        const notas = linhas.map((l) => montarNota(l, mapa, contexto)).filter(Boolean);
        const ignoradas = linhas.length - notas.length;

        for (let i = 0; i < notas.length; i += TAMANHO_LOTE) {
          const lote = writeBatch(db);
          for (const nota of notas.slice(i, i + TAMANHO_LOTE)) {
            lote.set(doc(db, COL.notas, nota.numeroNf), nota, { merge: true });
          }
          await lote.commit();
          $("#import-progresso").textContent =
            `Gravadas ${fmtNum(Math.min(i + TAMANHO_LOTE, notas.length))} de ${fmtNum(notas.length)} notas…`;
        }

        $("#import-progresso").textContent = "";
        aviso(`${fmtNum(notas.length)} notas importadas${ignoradas ? ` (${ignoradas} linhas sem NF foram puladas)` : ""}.`, "ok");
        entrada.value = "";
        arquivoSelecionado = null;
        $("#btn-importar").disabled = true;
      } catch (e) {
        aviso(mensagemDeErro(e), "erro");
      }
    });
  });
}
