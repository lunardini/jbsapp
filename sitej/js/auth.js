// ============================================================================
// auth.js — sessão do usuário. Nenhuma tela do app aparece antes do login.
// ============================================================================
import {
  auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
} from "./firebase.js";
import { $, aviso, comCarregamento, mensagemDeErro } from "./ui.js";

let usuarioAtual = null;

/** Objeto gravado junto de cada ocorrência/retenção. */
export function autor() {
  if (!usuarioAtual) throw new Error("Sessão expirada. Entre novamente.");
  return {
    uid: usuarioAtual.uid,
    email: usuarioAtual.email,
    nome: usuarioAtual.displayName || usuarioAtual.email.split("@")[0],
  };
}

export const usuario = () => usuarioAtual;

/**
 * @param {(usuario: object|null) => void} aoEntrar  chamado quando a sessão muda
 */
export function iniciarAuth(aoEntrar) {
  const form = $("#form-login");
  const erro = $("#login-erro");

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro.textContent = "";
    const email = $("#login-email").value.trim();
    const senha = $("#login-senha").value;
    await comCarregamento($("#btn-entrar"), "Entrando…", async () => {
      try {
        await signInWithEmailAndPassword(auth, email, senha);
      } catch (e) {
        erro.textContent = mensagemDeErro(e);
      }
    });
  });

  $("#btn-esqueci").addEventListener("click", async () => {
    const email = $("#login-email").value.trim();
    if (!email) { erro.textContent = "Digite seu e-mail acima para receber o link."; return; }
    try {
      await sendPasswordResetEmail(auth, email);
      aviso("Link de redefinição enviado. Confira a caixa de entrada.", "ok");
    } catch (e) { erro.textContent = mensagemDeErro(e); }
  });

  $("#btn-sair").addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, (u) => {
    usuarioAtual = u;
    const logado = Boolean(u);
    $("#tela-login").hidden = logado;
    $("#app").hidden = !logado;
    if (logado) {
      $("#usuario-nome").textContent = u.displayName || u.email;
      $("#form-login").reset();
    }
    aoEntrar(u);
  });
}
