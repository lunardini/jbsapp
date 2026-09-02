// ============================================================================
// nota.js — tela "Buscar NF": consulta, grade de itens e registro da ocorrência.
//
// Regra da grade, vinda de MOTIVOS em config.js:
//   Devolução total  → devolvido preenchido com o total da nota, ambos travados
//   Quebra de peso   → só o campo de quebra abre
//   Devolução parcial→ os dois campos abrem
//   Demais motivos   → grade some (o motivo não é de item)
//
// Valor devolvido do item = (devolvido + quebra) × valor unitário
// ============================================================================
import { db, COL, doc, getDoc, addDoc, collection, serverTimestamp } from "./firebase.js";
import { NOMES_MOTIVOS, regraDoMotivo, APELIDO_OPERACAO, DESTINATARIOS_PADRAO } from "./config.js";
import {
  $, $$, aviso, chave, hoje, fmtBRL, fmtKg, fmtDec, fmtQtd, fmtNum,
  escapeHtml, comCarregamento, mensagemDeErro,
} from "./ui.js";
import { autor } from "./auth.js";
import { abrirRascunho, copiarComoTexto, corpoDeCampos, guardarRascunho, ultimoRascunho } from "./mailto.js";

let notaAtual = null;

/** Busca uma NF pelo ID do documento — leitura direta, sem varrer a coleção. */
export async function buscarNota(numero) {
  const id = chave(numero);
  if (!id) return null;
  const snap = await getDoc(doc(db, COL.notas, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// --------------------------------------------------------------- cabeçalho --
function desenharNota(nota) {
  const campos = [
    ["Nota fiscal", nota.numeroNfOriginal || nota.numeroNf, "destaque"],
    ["Placa", nota.placaOriginal || nota.placa, "destaque"],
    ["Cliente", nota.codigoCliente ? `${nota.cliente} (${nota.codigoCliente})` : nota.cliente],
    ["Vendedor", nota.vendedor],
    ["Motorista", nota.motorista],
    ["Endereço", nota.endereco],
    ["Bairro", nota.bairro],
    ["Cidade", nota.cidade],
    ["Peso bruto", nota.peso ? fmtKg(nota.peso) : ""],
    ["Peso líquido", nota.pesoLiquido ? fmtKg(nota.pesoLiquido) : ""],
    ["Valor da nota", nota.valor ? fmtBRL(nota.valor) : ""],
    ["Itens", nota.qtdItens ? fmtNum(nota.qtdItens) : ""],
    ["Observação", nota.descricao],
  ].filter(([, v]) => v !== "" && v !== undefined && v !== null);

  $("#nota-campos").innerHTML = campos.map(([rotulo, valor, tipo]) => `
    <div class="campo ${tipo === "destaque" ? "campo--destaque" : ""}">
      <span class="campo__rotulo">${rotulo}</span>
      <span class="campo__valor mono">${escapeHtml(valor)}</span>
    </div>`).join("");
}

// -------------------------------------------------------------- itens ------
function desenharItens(nota) {
  const unidade = nota.unidade || "kg";
  const corpo = $("#itens-corpo");

  if (!nota.itens?.length) {
    corpo.innerHTML = `<tr><td colspan="7" class="vazio">
      Esta nota foi importada sem itens. Reimporte a planilha do dia para carregar o detalhamento.</td></tr>`;
    return;
  }

  corpo.innerHTML = nota.itens.map((item, i) => `
    <tr data-item="${i}">
      <td class="mono">${escapeHtml(item.codigo)}</td>
      <td class="celula-item">
        <strong>${escapeHtml(item.descricao)}</strong>
        <small>na nota: ${fmtQtd(item.quantidade, unidade)}</small>
      </td>
      <td class="num mono">${fmtDec(item.pesoLiquido, 3)}</td>
      <td class="num">
        <input class="entrada entrada--celula mono" type="number" step="0.001" min="0"
               max="${item.quantidade}" data-campo="devolvido" value="0"
               aria-label="Devolvido do item ${escapeHtml(item.codigo)}">
      </td>
      <td class="num">
        <input class="entrada entrada--celula mono" type="number" step="0.001" min="0"
               max="${item.quantidade}" data-campo="quebra" value="0"
               aria-label="Quebra do item ${escapeHtml(item.codigo)}">
      </td>
      <td class="num mono">${fmtBRL(item.valorUnitario)}</td>
      <td class="num mono forte" data-saida="valor">R$ 0,00</td>
    </tr>`).join("");

  corpo.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", () => recalcular());
    inp.addEventListener("focus", () => inp.select());
  });
}

/** Lê a grade e devolve os itens afetados + totais. Função pura o suficiente. */
export function lerGrade(nota) {
  const unidade = nota.unidade || "kg";
  const afetados = [];
  let totalQtd = 0, totalPeso = 0, totalValor = 0;

  $$("#itens-corpo tr[data-item]").forEach((tr) => {
    const item = nota.itens[Number(tr.dataset.item)];
    const campo = (nome) => tr.querySelector(`input[data-campo="${nome}"]`);
    let devolvido = Math.max(0, Number(campo("devolvido").value) || 0);
    let quebra = Math.max(0, Number(campo("quebra").value) || 0);

    const excedeu = devolvido + quebra > item.quantidade + 0.0001;
    tr.classList.toggle("linha--excedida", excedeu);

    const total = devolvido + quebra;
    const valor = +(total * item.valorUnitario).toFixed(2);
    const peso = item.quantidade > 0 ? +((total / item.quantidade) * item.pesoLiquido).toFixed(3) : 0;

    tr.querySelector('[data-saida="valor"]').textContent = fmtBRL(valor);
    tr.classList.toggle("linha--ativa", total > 0);

    if (total > 0) {
      afetados.push({ ...item, devolvido, quebra, valorDevolvido: valor, pesoDevolvido: peso });
      totalQtd += total; totalPeso += peso; totalValor += valor;
    }
  });

  return { unidade, itens: afetados, totalQtd, totalPeso: +totalPeso.toFixed(3), totalValor: +totalValor.toFixed(2) };
}

function recalcular() {
  if (!notaAtual) return;
  const r = lerGrade(notaAtual);
  $("#total-qtd").textContent = fmtQtd(r.totalQtd, r.unidade);
  $("#total-peso").textContent = fmtKg(r.totalPeso);
  $("#total-valor").textContent = fmtBRL(r.totalValor);
  $("#total-itens").textContent = `${fmtNum(r.itens.length)} de ${fmtNum(notaAtual.itens?.length || 0)} itens`;
  return r;
}

/** Aplica ao formulário a regra do motivo escolhido. */
function aplicarRegra(motivo) {
  const regra = regraDoMotivo(motivo);
  const temItens = Boolean(notaAtual?.itens?.length);
  const mostrarGrade = Boolean(motivo) && regra.itens && temItens;

  // O aviso alternativo também aparece quando a nota veio sem itens — senão a
  // tela ficaria sem nenhum botão de salvar.
  $("#bloco-itens").hidden = !mostrarGrade;
  $("#itens-dispensados").hidden = !motivo || mostrarGrade;
  $("#texto-dispensados").textContent = !regra.itens
    ? "Este motivo não exige detalhamento por item. A ocorrência é registrada com a observação."
    : "Esta nota foi importada sem itens. Reimporte a planilha do dia para detalhar, ou salve apenas com a observação.";

  if (!mostrarGrade) { recalcular(); return; }

  $$("#itens-corpo tr[data-item]").forEach((tr) => {
    const item = notaAtual.itens[Number(tr.dataset.item)];
    for (const nome of ["devolvido", "quebra"]) {
      const inp = tr.querySelector(`input[data-campo="${nome}"]`);
      const modo = regra[nome];
      inp.disabled = modo !== "aberto";
      inp.classList.toggle("entrada--travada", modo !== "aberto");
      // Trocar de motivo sempre reinicia a grade: o que foi digitado para um
      // motivo não pode vazar para o seguinte.
      inp.value = modo === "cheio" ? item.quantidade : 0;
    }
  });

  $("#dica-regra").textContent = {
    "cheio-zero": "Devolução total: a grade já veio preenchida com a quantidade cheia de cada item.",
    "aberto-aberto": "Devolução parcial: informe o que voltou e, se houver, o que quebrou.",
    "zero-aberto": "Quebra de peso: só o campo de quebra está aberto.",
  }[`${regra.devolvido}-${regra.quebra}`] || "Informe os itens afetados.";

  recalcular();
}

// -------------------------------------------------------------- e-mail -----
export function emailDaOcorrencia(nota, ocorrencia, quem) {
  const assunto = `[${APELIDO_OPERACAO}] ${ocorrencia.motivo} — NF ${nota.numeroNfOriginal || nota.numeroNf}`;
  const linhasItens = ocorrencia.itens.slice(0, 12).map((i) =>
    `  • ${i.codigo} ${i.descricao} — devolvido ${fmtDec(i.devolvido, 2)}` +
    (i.quebra ? ` | quebra ${fmtDec(i.quebra, 2)}` : "") + ` | ${fmtBRL(i.valorDevolvido)}`);
  if (ocorrencia.itens.length > 12) linhasItens.push(`  • (+${ocorrencia.itens.length - 12} itens no sistema)`);

  const corpo = corpoDeCampos(
    `Olá${nota.vendedor ? ` ${nota.vendedor}` : ""},\r\n\r\nRegistramos a seguinte ocorrência na entrega abaixo.`,
    [
      ["Nota fiscal", nota.numeroNfOriginal || nota.numeroNf],
      ["Cliente", nota.cliente],
      ["Placa", nota.placaOriginal || nota.placa],
      ["Motorista", nota.motorista],
      ["Cidade", [nota.bairro, nota.cidade].filter(Boolean).join(" / ")],
      ["Motivo", ocorrencia.motivo],
      ["Observação", ocorrencia.observacao || "—"],
      ["Itens afetados", ocorrencia.itens.length ? `\r\n${linhasItens.join("\r\n")}` : "nenhum item detalhado"],
      ["Peso devolvido", fmtKg(ocorrencia.totalPeso)],
      ["Valor devolvido", fmtBRL(ocorrencia.totalValor)],
      ["Registrado por", `${quem.nome} (${quem.email})`],
      ["Data do registro", new Date().toLocaleString("pt-BR")],
    ],
    "Por favor, retorne com a tratativa para seguirmos com o atendimento.\r\n\r\nObrigado."
  );
  return { para: ocorrencia.para, cc: ocorrencia.cc, assunto, corpo };
}

// -------------------------------------------------------------- tela -------
export function iniciarBusca() {
  $("#oco-motivo").innerHTML =
    `<option value="">Selecione o motivo</option>` + NOMES_MOTIVOS.map((m) => `<option>${m}</option>`).join("");

  $("#form-busca").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    await comCarregamento($("#btn-buscar"), "Buscando…", async () => {
      try {
        $("#busca-vazio").hidden = true;
        const nota = await buscarNota($("#busca-nf").value);
        if (!nota) {
          notaAtual = null;
          $("#resultado").hidden = true;
          $("#estado-inicial").hidden = true;
          $("#busca-vazio").hidden = false;
          $("#busca-vazio-nf").textContent = chave($("#busca-nf").value);
          return;
        }
        notaAtual = nota;
        desenharNota(nota);
        desenharItens(nota);
        $("#estado-inicial").hidden = true;
        $("#resultado").hidden = false;
        $("#pos-salvar").hidden = true;
        $("#form-ocorrencia").reset();
        $("#oco-para").value = nota.emailVendedor || DESTINATARIOS_PADRAO.para;
        $("#oco-cc").value = nota.emailLogistica || DESTINATARIOS_PADRAO.cc;
        aplicarRegra("");
        $("#oco-motivo").focus();
      } catch (e) { aviso(mensagemDeErro(e), "erro"); }
    });
  });

  $("#oco-motivo").addEventListener("change", (ev) => aplicarRegra(ev.target.value));

  $("#form-ocorrencia").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!notaAtual) return;
    const motivo = $("#oco-motivo").value;
    if (!motivo) { aviso("Escolha um motivo antes de salvar.", "erro"); return; }

    const regra = regraDoMotivo(motivo);
    const grade = regra.itens && notaAtual.itens?.length
      ? lerGrade(notaAtual)
      : { itens: [], totalQtd: 0, totalPeso: 0, totalValor: 0, unidade: notaAtual.unidade || "kg" };

    if (regra.itens && notaAtual.itens?.length && !grade.itens.length) {
      aviso("Preencha o que foi devolvido ou quebrado em pelo menos um item.", "erro");
      return;
    }
    if ($$("#itens-corpo .linha--excedida").length) {
      aviso("Há item com devolução maior que a quantidade da nota. Ajuste antes de salvar.", "erro");
      return;
    }

    await comCarregamento($("#btn-salvar"), "Salvando…", async () => {
      try {
        const quem = autor();
        const ocorrencia = {
          numeroNf: notaAtual.numeroNf,
          numeroNfOriginal: notaAtual.numeroNfOriginal || notaAtual.numeroNf,
          placa: notaAtual.placa,
          cliente: notaAtual.cliente || "",
          vendedor: notaAtual.vendedor || "",
          motorista: notaAtual.motorista || "",
          cidade: notaAtual.cidade || "",
          motivo,
          observacao: $("#oco-obs").value.trim(),
          unidade: grade.unidade,
          itens: grade.itens,
          totalQtd: grade.totalQtd,
          totalPeso: grade.totalPeso,
          totalValor: grade.totalValor,
          valorNota: notaAtual.valor || 0,
          pesoNota: notaAtual.peso || 0,
          para: $("#oco-para").value.trim(),
          cc: $("#oco-cc").value.trim(),
          criadoPor: quem,
          criadoPorEmail: quem.email,
          dataRef: hoje(),
          criadoEm: serverTimestamp(),
        };

        await addDoc(collection(db, COL.ocorrencias), ocorrencia);

        const email = emailDaOcorrencia(notaAtual, ocorrencia, quem);
        guardarRascunho(email);
        abrirRascunho(email);

        $("#pos-salvar").hidden = false;
        $("#pos-salvar-resumo").textContent =
          `${motivo} · NF ${ocorrencia.numeroNfOriginal} · ${fmtBRL(ocorrencia.totalValor)} · ${fmtKg(ocorrencia.totalPeso)}`;
        aviso("Ocorrência salva. O rascunho foi enviado ao Outlook.", "ok");
      } catch (e) { aviso(mensagemDeErro(e), "erro"); }
    });
  });

  $("#btn-reabrir").addEventListener("click", () => ultimoRascunho && abrirRascunho(ultimoRascunho));
  $("#btn-copiar").addEventListener("click", () => ultimoRascunho && copiarComoTexto(ultimoRascunho));
  $("#btn-nova-busca").addEventListener("click", () => {
    $("#resultado").hidden = true;
    $("#estado-inicial").hidden = false;
    $("#busca-nf").value = "";
    $("#busca-nf").focus();
  });
}
