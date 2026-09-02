// ============================================================================
// layout.js — a casca comum das páginas internas.
//
// Cada tela é um arquivo .html separado. Em vez de repetir o menu em quatro
// arquivos, ele é montado aqui: uma alteração no menu vale para todas as telas.
// Este módulo também é a tranca da sessão — quem não está logado é mandado de
// volta para o login antes de qualquer conteúdo aparecer.
// ============================================================================
import { auth, onAuthStateChanged, signOut } from "./firebase.js";
import { $, aviso } from "./ui.js";

const PAGINAS = [
  { id: "buscar",      href: "buscar.html",      titulo: "Buscar NF",   apoio: "Consultar e registrar ocorrência", icone: "M11 4a7 7 0 105.2 11.7l3.5 3.6 1.4-1.4-3.5-3.6A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z" },
  { id: "importar",    href: "importar.html",    titulo: "Importar",    apoio: "Carregar a planilha do dia",       icone: "M12 3l4 4h-3v7h-2V7H8l4-4zM5 17h14v2H5v-2z" },
  { id: "ocorrencias", href: "ocorrencias.html", titulo: "Ocorrências", apoio: "Painel, filtros e exportação",     icone: "M4 5h16v2H4V5zm0 6h10v2H4v-2zm0 6h13v2H4v-2z" },
  { id: "retencao",    href: "retencao.html",    titulo: "Retenção",    apoio: "Carga consolidada por placa",      icone: "M3 13l2-5h14l2 5v6h-3a2 2 0 11-4 0H9a2 2 0 11-4 0H3v-6zm2.4-1h13.2l-1.2-3H6.6l-1.2 3z" },
];

function marcaSVG() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="marca__glifo">
    <path d="M4 19c0-6 4-11 10-12-1.5 3-1 5-3 7s-4 2-4 5z" fill="currentColor" opacity=".85"/>
    <path d="M4 19c3 0 5-1 7-3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function montarLateral(paginaAtiva) {
  return `
    <a class="marca marca--lateral" href="buscar.html">
      ${marcaSVG()}
      <span>Controle de<br><strong>Entregas</strong></span>
    </a>
    <nav class="menu" aria-label="Módulos">
      ${PAGINAS.map((p) => `
        <a class="menu__item ${p.id === paginaAtiva ? "menu__item--ativo" : ""}"
           href="${p.href}" ${p.id === paginaAtiva ? 'aria-current="page"' : ""}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${p.icone}" fill="currentColor"/></svg>
          <span class="menu__texto"><strong>${p.titulo}</strong><small>${p.apoio}</small></span>
        </a>`).join("")}
    </nav>
    <div class="menu__rodape">
      <div class="usuario">
        <span class="usuario__inicial" id="usuario-inicial"></span>
        <span class="usuario__dados">
          <strong id="usuario-nome">—</strong>
          <small id="usuario-email" class="mono"></small>
        </span>
      </div>
      <button id="btn-sair" class="botao botao--fantasma" type="button">Sair</button>
    </div>`;
}

/**
 * Chame no topo de cada página interna.
 * @param {string} paginaAtiva  id em PAGINAS
 * @param {(usuario: object) => void} aoEntrar  roda uma vez, com a sessão pronta
 */
export function iniciarPagina(paginaAtiva, aoEntrar) {
  const lateral = $("#lateral");
  if (lateral) lateral.innerHTML = montarLateral(paginaAtiva);

  $("#btn-sair")?.addEventListener("click", async () => {
    await signOut(auth);
    location.replace("index.html");
  });

  $("#abrir-menu")?.addEventListener("click", () => {
    document.body.classList.toggle("menu-aberto");
  });
  $("#lateral")?.addEventListener("click", (ev) => {
    if (ev.target.closest(".menu__item")) document.body.classList.remove("menu-aberto");
  });

  let jaIniciou = false;
  onAuthStateChanged(auth, (usuario) => {
    if (!usuario) { location.replace("index.html"); return; }

    $("#usuario-nome").textContent = usuario.displayName || usuario.email.split("@")[0];
    $("#usuario-email").textContent = usuario.email;
    $("#usuario-inicial").textContent = (usuario.displayName || usuario.email)[0].toUpperCase();

    $("#carregando")?.remove();
    $("#casca").hidden = false;

    if (!jaIniciou) {
      jaIniciou = true;
      try { aoEntrar(usuario); }
      catch (e) { console.error(e); aviso("Falha ao iniciar a tela. Veja o console (F12).", "erro"); }
    }
  });
}
