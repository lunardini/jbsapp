// ============================================================================
// app.js — liga tudo: sessão, navegação e inicialização dos módulos.
// ============================================================================
import { firebaseConfig } from "./config.js";
import { $, $$, aviso } from "./ui.js";
import { iniciarAuth } from "./auth.js";
import { iniciarImportacao } from "./importar.js";
import { iniciarOcorrencias } from "./ocorrencias.js";
import { iniciarDashboard, atualizar } from "./dashboard.js";
import { iniciarRetencao } from "./retencao.js";

function navegar(destino) {
  $$(".vista").forEach((v) => { v.hidden = v.dataset.vista !== destino; });
  $$(".nav__item").forEach((b) => {
    const ativo = b.dataset.ir === destino;
    b.classList.toggle("nav__item--ativo", ativo);
    b.setAttribute("aria-current", ativo ? "page" : "false");
  });
  if (destino === "dashboard") atualizar();
  const foco = $(`.vista[data-vista="${destino}"] input, .vista[data-vista="${destino}"] select`);
  if (foco) foco.focus();
}

function iniciar() {
  if (firebaseConfig.apiKey === "COLE_AQUI") {
    aviso("Preencha as chaves do Firebase em js/config.js antes de usar o sistema.", "erro", 15000);
  }

  $$(".nav__item").forEach((b) => b.addEventListener("click", () => navegar(b.dataset.ir)));

  iniciarAuth((usuario) => {
    if (usuario) navegar("buscar");
  });

  iniciarImportacao();
  iniciarOcorrencias();
  iniciarDashboard();
  iniciarRetencao();
}

document.addEventListener("DOMContentLoaded", iniciar);
