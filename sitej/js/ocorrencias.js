// ============================================================================
// ocorrencias.js — buscar a NF, registrar a ocorrência, abrir o Outlook.
// ============================================================================
import { db, COL, doc, getDoc, addDoc, collection, serverTimestamp } from "./firebase.js";
import { MOTIVOS, APELIDO_OPERACAO } from "./config.js";
import { $, aviso, chave, hoje, fmtBRL, fmtKg, escapeHtml, comCarregamento, mensagemDeErro } from "./ui.js";
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

function desenharNota(nota) {
  const campos = [
    ["NF", nota.numeroNfOriginal || nota.numeroNf],
    ["Placa", nota.placaOriginal || nota.placa],
    ["Valor", fmtBRL(nota.valor)],
    ["Peso", fmtKg(nota.peso)],
    ["Vendedor", nota.vendedor || "—"],
    ["Cliente", nota.cliente],
    ["Cidade", nota.cidade],
    ["Transportadora", nota.transportadora],
    ["E-mail vendedor", nota.emailVendedor],
    ["Cópia logística", nota.emailLogistica],
  ].filter(([, v]) => v !== "" && v !== undefined && v !== null);

  $("#nota-detalhe").innerHTML = campos.map(([r, v]) => `
    <div class="campo">
      <span class="campo__rotulo">${r}</span>
      <span class="campo__valor mono">${escapeHtml(v)}</span>
    </div>`).join("");
}

/** Monta o e-mail da ocorrência. Separado para poder ser testado sozinho. */
export function emailDaOcorrencia(nota, ocorrencia, quem) {
  const assunto = `[${APELIDO_OPERACAO}] Ocorrência ${ocorrencia.motivo} — NF ${nota.numeroNfOriginal || nota.numeroNf}`;
  const corpo = corpoDeCampos(
    `Olá${nota.vendedor ? ` ${nota.vendedor}` : ""},\r\n\r\nRegistramos a seguinte ocorrência na entrega abaixo.`,
    [
      ["Nota fiscal", nota.numeroNfOriginal || nota.numeroNf],
      ["Placa do veículo", nota.placaOriginal || nota.placa],
      ["Cliente", nota.cliente],
      ["Cidade", nota.cidade],
      ["Valor", fmtBRL(nota.valor)],
      ["Peso", fmtKg(nota.peso)],
      ["Motivo", ocorrencia.motivo],
      ["Observação", ocorrencia.observacao || "—"],
      ["Registrado por", `${quem.nome} (${quem.email})`],
      ["Data do registro", new Date().toLocaleString("pt-BR")],
    ],
    "Por favor, retorne com a tratativa para seguirmos com o atendimento.\r\n\r\nObrigado."
  );
  return { para: nota.emailVendedor, cc: nota.emailLogistica, assunto, corpo };
}

export function iniciarOcorrencias() {
  $("#oco-motivo").innerHTML =
    `<option value="">Selecione o motivo</option>` +
    MOTIVOS.map((m) => `<option>${m}</option>`).join("");

  $("#form-busca").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const termo = $("#busca-nf").value;
    $("#resultado-busca").hidden = true;
    $("#busca-vazio").hidden = true;

    await comCarregamento($("#btn-buscar"), "Buscando…", async () => {
      try {
        const nota = await buscarNota(termo);
        if (!nota) {
          notaAtual = null;
          $("#busca-vazio").hidden = false;
          $("#busca-vazio").innerHTML =
            `NF <span class="mono">${escapeHtml(chave(termo))}</span> não está na base.
             Confira o número ou importe a planilha do dia.`;
          return;
        }
        notaAtual = nota;
        desenharNota(nota);
        $("#resultado-busca").hidden = false;
        $("#form-ocorrencia").reset();
        $("#oco-motivo").focus();
      } catch (e) { aviso(mensagemDeErro(e), "erro"); }
    });
  });

  $("#form-ocorrencia").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!notaAtual) return;
    const motivo = $("#oco-motivo").value;
    if (!motivo) { aviso("Escolha um motivo antes de salvar.", "erro"); return; }

    await comCarregamento($("#btn-salvar-oco"), "Salvando…", async () => {
      try {
        const quem = autor();
        const ocorrencia = {
          numeroNf: notaAtual.numeroNf,
          numeroNfOriginal: notaAtual.numeroNfOriginal || notaAtual.numeroNf,
          placa: notaAtual.placa,
          motivo,
          observacao: $("#oco-obs").value.trim(),
          valor: notaAtual.valor,
          peso: notaAtual.peso,
          vendedor: notaAtual.vendedor,
          emailVendedor: notaAtual.emailVendedor,
          emailLogistica: notaAtual.emailLogistica,
          cliente: notaAtual.cliente,
          criadoPor: quem,
          criadoPorEmail: quem.email,   // campo plano: permite filtrar no Firestore
          dataRef: hoje(),              // YYYY-MM-DD: permite filtrar por período
          criadoEm: serverTimestamp(),
        };

        await addDoc(collection(db, COL.ocorrencias), ocorrencia);

        const email = emailDaOcorrencia(notaAtual, ocorrencia, quem);
        guardarRascunho(email);
        abrirRascunho(email);

        $("#pos-salvar").hidden = false;
        aviso("Ocorrência salva. O rascunho foi enviado ao Outlook.", "ok");
        $("#form-ocorrencia").reset();
      } catch (e) { aviso(mensagemDeErro(e), "erro"); }
    });
  });

  $("#btn-reabrir-outlook").addEventListener("click", () => {
    if (ultimoRascunho) abrirRascunho(ultimoRascunho);
  });
  $("#btn-copiar-email").addEventListener("click", () => {
    if (ultimoRascunho) copiarComoTexto(ultimoRascunho);
  });
}
