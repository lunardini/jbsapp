// ============================================================================
// retencao.js — NF → placa → todas as NFs daquela placa → totais → e-mail.
// ============================================================================
import { db, COL, collection, query, where, getDocs, addDoc, serverTimestamp } from "./firebase.js";
import { APELIDO_OPERACAO, EMAIL_LOGISTICA_PADRAO } from "./config.js";
import { $, aviso, chave, hoje, fmtBRL, fmtKg, fmtNum, escapeHtml, comCarregamento, mensagemDeErro } from "./ui.js";
import { autor } from "./auth.js";
import { buscarNota } from "./ocorrencias.js";
import { abrirRascunho, copiarComoTexto, corpoDeCampos, guardarRascunho, listaDeEmails } from "./mailto.js";

let retencaoAtual = null;

/** Todas as notas da mesma placa. Consulta por igualdade: sem índice composto. */
async function notasDaPlaca(placa) {
  const snap = await getDocs(query(collection(db, COL.notas), where("placa", "==", chave(placa))));
  return snap.docs.map((d) => d.data());
}

/** Consolida os números da carga. Função pura — fácil de conferir. */
export function consolidar(notas) {
  const porVendedor = new Map();
  let totalValor = 0, totalPeso = 0;

  for (const n of notas) {
    totalValor += n.valor || 0;
    totalPeso += n.peso || 0;
    const nome = n.vendedor || "(sem vendedor na planilha)";
    const atual = porVendedor.get(nome) || { nome, email: n.emailVendedor || "", nfs: [], valor: 0, peso: 0 };
    atual.nfs.push(n.numeroNfOriginal || n.numeroNf);
    atual.valor += n.valor || 0;
    atual.peso += n.peso || 0;
    if (!atual.email && n.emailVendedor) atual.email = n.emailVendedor;
    porVendedor.set(nome, atual);
  }

  return {
    totalValor,
    totalPeso,
    quantidadeNfs: notas.length,
    vendedores: [...porVendedor.values()].sort((a, b) => b.valor - a.valor),
    nfs: notas.map((n) => n.numeroNfOriginal || n.numeroNf),
    emailsVendedores: [...new Set(notas.map((n) => n.emailVendedor).filter(Boolean))],
    emailsLogistica: [...new Set(notas.map((n) => n.emailLogistica).filter(Boolean))],
  };
}

function desenhar(placa, dados) {
  $("#ret-placa").textContent = placa;
  $("#ret-qtd").textContent = fmtNum(dados.quantidadeNfs);
  $("#ret-valor").textContent = fmtBRL(dados.totalValor);
  $("#ret-peso").textContent = fmtKg(dados.totalPeso);

  $("#ret-vendedores tbody").innerHTML = dados.vendedores.map((v) => `
    <tr>
      <td>${escapeHtml(v.nome)}</td>
      <td>${escapeHtml(v.email || "—")}</td>
      <td class="num mono">${v.nfs.length}</td>
      <td class="num mono">${fmtBRL(v.valor)}</td>
      <td class="num mono">${fmtKg(v.peso)}</td>
      <td class="mono nfs">${escapeHtml(v.nfs.join(", "))}</td>
    </tr>`).join("");

  $("#resultado-retencao").hidden = false;
}

function emailDaRetencao(placa, dados, motivo, quem) {
  const assunto = `[${APELIDO_OPERACAO}] Retenção de veículo — Placa ${placa} — ${fmtNum(dados.quantidadeNfs)} NFs`;
  const corpo = corpoDeCampos(
    "Prezados,\r\n\r\nO veículo abaixo está retido. Segue o resumo da carga afetada.",
    [
      ["Placa", placa],
      ["Notas fiscais", `${fmtNum(dados.quantidadeNfs)} (${dados.nfs.join(", ")})`],
      ["Valor total", fmtBRL(dados.totalValor)],
      ["Peso total", fmtKg(dados.totalPeso)],
      ["Vendedores envolvidos", dados.vendedores.map((v) => `${v.nome} (${v.nfs.length} NF)`).join("; ")],
      ["Motivo da retenção", motivo || "—"],
      ["Registrado por", `${quem.nome} (${quem.email})`],
      ["Data", new Date().toLocaleString("pt-BR")],
    ],
    "Solicitamos posicionamento para liberação da carga.\r\n\r\nObrigado."
  );
  return {
    para: dados.emailsVendedores,
    cc: dados.emailsLogistica.length ? dados.emailsLogistica : EMAIL_LOGISTICA_PADRAO,
    assunto,
    corpo,
  };
}

export function iniciarRetencao() {
  $("#form-retencao").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("#resultado-retencao").hidden = true;
    $("#ret-vazio").hidden = true;

    await comCarregamento($("#btn-ret-buscar"), "Consultando…", async () => {
      try {
        const nota = await buscarNota($("#ret-nf").value);
        if (!nota) {
          $("#ret-vazio").hidden = false;
          $("#ret-vazio").textContent = "NF não encontrada na base. Confira o número ou importe a planilha do dia.";
          return;
        }
        if (!nota.placa) {
          $("#ret-vazio").hidden = false;
          $("#ret-vazio").textContent = "Esta NF está sem placa na planilha, então não dá para agrupar a carga.";
          return;
        }
        const notas = await notasDaPlaca(nota.placa);
        const dados = consolidar(notas);
        retencaoAtual = { placa: nota.placaOriginal || nota.placa, placaChave: nota.placa, dados, nfOrigem: nota.numeroNf };
        desenhar(retencaoAtual.placa, dados);
      } catch (e) { aviso(mensagemDeErro(e), "erro"); }
    });
  });

  $("#btn-gerar-retencao").addEventListener("click", async (ev) => {
    if (!retencaoAtual) return;
    await comCarregamento(ev.currentTarget, "Registrando…", async () => {
      try {
        const quem = autor();
        const { placa, placaChave, dados, nfOrigem } = retencaoAtual;
        const motivo = $("#ret-motivo").value.trim();

        await addDoc(collection(db, COL.retencoes), {
          placa: placaChave,
          placaOriginal: placa,
          nfOrigem,
          nfs: dados.nfs,
          quantidadeNfs: dados.quantidadeNfs,
          totalValor: dados.totalValor,
          totalPeso: dados.totalPeso,
          vendedores: dados.vendedores.map((v) => ({ nome: v.nome, email: v.email, nfs: v.nfs.length })),
          motivo,
          criadoPor: quem,
          criadoPorEmail: quem.email,
          dataRef: hoje(),
          criadoEm: serverTimestamp(),
        });

        const email = emailDaRetencao(placa, dados, motivo, quem);
        guardarRascunho(email);
        abrirRascunho(email);
        $("#ret-pos-salvar").hidden = false;
        aviso("Retenção registrada. O rascunho foi enviado ao Outlook.", "ok");
      } catch (e) { aviso(mensagemDeErro(e), "erro"); }
    });
  });

  $("#btn-ret-copiar").addEventListener("click", () => {
    if (!retencaoAtual) return;
    copiarComoTexto(emailDaRetencao(retencaoAtual.placa, retencaoAtual.dados, $("#ret-motivo").value.trim(), autor()));
  });
}
