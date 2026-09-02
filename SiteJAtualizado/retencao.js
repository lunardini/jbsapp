// ============================================================================
// retencao.js — NF → placa → todas as NFs daquela placa → totais → e-mail.
// ============================================================================
import { db, COL, collection, query, where, getDocs, addDoc, serverTimestamp } from "./firebase.js";
import { APELIDO_OPERACAO, DESTINATARIOS_PADRAO } from "./config.js";
import {
  $, aviso, chave, hoje, fmtBRL, fmtKg, fmtNum, escapeHtml, comCarregamento, mensagemDeErro,
} from "./ui.js";
import { autor } from "./auth.js";
import { buscarNota } from "./nota.js";
import { abrirRascunho, copiarComoTexto, corpoDeCampos, guardarRascunho } from "./mailto.js";

let atual = null;

/** Todas as notas da mesma placa. Consulta por igualdade: sem índice composto. */
async function notasDaPlaca(placa) {
  const snap = await getDocs(query(collection(db, COL.notas), where("placa", "==", chave(placa))));
  return snap.docs.map((d) => d.data());
}

/** Consolida os números da carga. Função pura — fácil de conferir. */
export function consolidar(notas) {
  const porVendedor = new Map();
  let totalValor = 0, totalPeso = 0, totalPesoLiquido = 0, totalItens = 0;

  for (const n of notas) {
    totalValor += n.valor || 0;
    totalPeso += n.peso || 0;
    totalPesoLiquido += n.pesoLiquido || 0;
    totalItens += n.qtdItens || 0;
    const nome = n.vendedor || "(sem vendedor na planilha)";
    const v = porVendedor.get(nome) || { nome, email: n.emailVendedor || "", nfs: [], valor: 0, peso: 0 };
    v.nfs.push(n.numeroNfOriginal || n.numeroNf);
    v.valor += n.valor || 0;
    v.peso += n.peso || 0;
    if (!v.email && n.emailVendedor) v.email = n.emailVendedor;
    porVendedor.set(nome, v);
  }

  return {
    totalValor: +totalValor.toFixed(2),
    totalPeso: +totalPeso.toFixed(3),
    totalPesoLiquido: +totalPesoLiquido.toFixed(3),
    totalItens,
    quantidadeNfs: notas.length,
    motoristas: [...new Set(notas.map((n) => n.motorista).filter(Boolean))],
    cidades: [...new Set(notas.map((n) => n.cidade).filter(Boolean))],
    vendedores: [...porVendedor.values()].sort((a, b) => b.valor - a.valor),
    notas: notas.map((n) => ({
      nf: n.numeroNfOriginal || n.numeroNf,
      cliente: n.cliente || "—",
      cidade: [n.bairro, n.cidade].filter(Boolean).join(" / ") || "—",
      itens: n.qtdItens || 0,
      valor: n.valor || 0,
      peso: n.peso || 0,
    })).sort((a, b) => b.valor - a.valor),
    nfs: notas.map((n) => n.numeroNfOriginal || n.numeroNf),
    emailsVendedores: [...new Set(notas.map((n) => n.emailVendedor).filter(Boolean))],
    emailsLogistica: [...new Set(notas.map((n) => n.emailLogistica).filter(Boolean))],
  };
}

function desenhar(placa, d) {
  $("#indicadores-ret").innerHTML = [
    ["Placa", placa, "veículo retido", true],
    ["Notas retidas", fmtNum(d.quantidadeNfs), `${fmtNum(d.totalItens)} itens`],
    ["Valor total", fmtBRL(d.totalValor), "soma das notas"],
    ["Peso total", fmtKg(d.totalPeso), `líquido ${fmtKg(d.totalPesoLiquido)}`],
  ].map(([r, v, apoio, destaque]) => `
    <div class="indicador ${destaque ? "indicador--escuro" : ""}">
      <span class="indicador__rotulo">${r}</span>
      <strong class="indicador__valor mono">${escapeHtml(v)}</strong>
      <small class="indicador__apoio">${escapeHtml(apoio)}</small>
    </div>`).join("");

  $("#ret-contexto").innerHTML = [
    d.motoristas.length ? `<span><strong>Motorista:</strong> ${escapeHtml(d.motoristas.join(", "))}</span>` : "",
    d.cidades.length ? `<span><strong>Rota:</strong> ${escapeHtml(d.cidades.slice(0, 6).join(" · "))}</span>` : "",
  ].filter(Boolean).join("");

  $("#ret-vendedores tbody").innerHTML = d.vendedores.map((v) => `
    <tr>
      <td><strong>${escapeHtml(v.nome)}</strong></td>
      <td class="mono">${escapeHtml(v.email || "—")}</td>
      <td class="num mono">${v.nfs.length}</td>
      <td class="num mono forte">${fmtBRL(v.valor)}</td>
      <td class="num mono">${fmtKg(v.peso)}</td>
    </tr>`).join("");

  $("#ret-notas tbody").innerHTML = d.notas.map((n) => `
    <tr>
      <td class="mono">${escapeHtml(n.nf)}</td>
      <td>${escapeHtml(n.cliente)}</td>
      <td>${escapeHtml(n.cidade)}</td>
      <td class="num mono">${fmtNum(n.itens)}</td>
      <td class="num mono">${fmtBRL(n.valor)}</td>
      <td class="num mono">${fmtKg(n.peso)}</td>
    </tr>`).join("");

  $("#ret-para").value = d.emailsVendedores.join(", ") || DESTINATARIOS_PADRAO.para;
  $("#ret-cc").value = d.emailsLogistica.join(", ") || DESTINATARIOS_PADRAO.cc;
  $("#resultado-ret").hidden = false;
  $("#estado-inicial-ret").hidden = true;
}

function emailDaRetencao(placa, d, motivo, quem, para, cc) {
  const assunto = `[${APELIDO_OPERACAO}] Retenção de veículo — Placa ${placa} — ${fmtNum(d.quantidadeNfs)} NFs`;
  const corpo = corpoDeCampos(
    "Prezados,\r\n\r\nO veículo abaixo está retido. Segue o resumo da carga afetada.",
    [
      ["Placa", placa],
      ["Motorista", d.motoristas.join(", ")],
      ["Notas fiscais", `${fmtNum(d.quantidadeNfs)} (${d.nfs.join(", ")})`],
      ["Valor total", fmtBRL(d.totalValor)],
      ["Peso total", fmtKg(d.totalPeso)],
      ["Vendedores envolvidos", d.vendedores.map((v) => `${v.nome} (${v.nfs.length} NF · ${fmtBRL(v.valor)})`).join("; ")],
      ["Motivo da retenção", motivo || "—"],
      ["Registrado por", `${quem.nome} (${quem.email})`],
      ["Data", new Date().toLocaleString("pt-BR")],
    ],
    "Solicitamos posicionamento para liberação da carga.\r\n\r\nObrigado."
  );
  return { para, cc, assunto, corpo };
}

const emailAtual = () => emailDaRetencao(
  atual.placa, atual.dados, $("#ret-motivo").value.trim(), autor(),
  $("#ret-para").value.trim(), $("#ret-cc").value.trim());

export function iniciarRetencao() {
  $("#form-ret").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    await comCarregamento($("#btn-ret-buscar"), "Consultando…", async () => {
      try {
        $("#ret-vazio").hidden = true;
        const nota = await buscarNota($("#ret-nf").value);
        if (!nota) {
          $("#resultado-ret").hidden = true;
          $("#ret-vazio").hidden = false;
          $("#ret-vazio").textContent = "NF não encontrada na base. Confira o número ou importe a planilha do dia.";
          return;
        }
        if (!nota.placa) {
          $("#resultado-ret").hidden = true;
          $("#ret-vazio").hidden = false;
          $("#ret-vazio").textContent = "Esta NF está sem placa na planilha, então não dá para agrupar a carga.";
          return;
        }
        const dados = consolidar(await notasDaPlaca(nota.placa));
        atual = { placa: nota.placaOriginal || nota.placa, placaChave: nota.placa, dados, nfOrigem: nota.numeroNf };
        desenhar(atual.placa, dados);
        $("#pos-ret").hidden = true;
      } catch (e) { aviso(mensagemDeErro(e), "erro"); }
    });
  });

  $("#btn-gerar-ret").addEventListener("click", async (ev) => {
    if (!atual) return;
    await comCarregamento(ev.currentTarget, "Registrando…", async () => {
      try {
        const quem = autor();
        const { placa, placaChave, dados, nfOrigem } = atual;
        await addDoc(collection(db, COL.retencoes), {
          placa: placaChave,
          placaOriginal: placa,
          nfOrigem,
          nfs: dados.nfs,
          quantidadeNfs: dados.quantidadeNfs,
          totalValor: dados.totalValor,
          totalPeso: dados.totalPeso,
          totalItens: dados.totalItens,
          motoristas: dados.motoristas,
          vendedores: dados.vendedores.map((v) => ({ nome: v.nome, email: v.email, nfs: v.nfs.length, valor: v.valor })),
          motivo: $("#ret-motivo").value.trim(),
          para: $("#ret-para").value.trim(),
          cc: $("#ret-cc").value.trim(),
          criadoPor: quem,
          criadoPorEmail: quem.email,
          dataRef: hoje(),
          criadoEm: serverTimestamp(),
        });

        const email = emailAtual();
        guardarRascunho(email);
        abrirRascunho(email);
        $("#pos-ret").hidden = false;
        aviso("Retenção registrada. O rascunho foi enviado ao Outlook.", "ok");
      } catch (e) { aviso(mensagemDeErro(e), "erro"); }
    });
  });

  $("#btn-ret-copiar").addEventListener("click", () => atual && copiarComoTexto(emailAtual()));
  $("#btn-ret-reabrir").addEventListener("click", () => atual && abrirRascunho(emailAtual()));
}
