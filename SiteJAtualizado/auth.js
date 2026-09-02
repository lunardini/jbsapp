// ============================================================================
// auth.js
// ============================================================================
import {
  auth, signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
} from "./firebase.js";
import { firebaseConfig } from "./config.js";
import { $, aviso, comCarregamento, mensagemDeErro } from "./ui.js";

console.log("Passo 1: Arquivo auth.js carregado com sucesso!");

// ATENÇÃO: Se a sua página principal não for buscar.html, altere a linha abaixo!
const DESTINO = "buscar.html";

export function usuarioLogado() { return auth.currentUser; }

export function autor() {
  const u = auth.currentUser;
  if (!u) throw new Error("Sessão expirada. Entre novamente.");
  return { uid: u.uid, email: u.email, nome: u.displayName || u.email.split("@")[0] };
}

export function iniciarLogin() {
  console.log("Passo 2: Função iniciarLogin disparada!");

  if (firebaseConfig.apiKey.startsWith("COLE")) {
    aviso("Preencha as chaves do Firebase em js/config.js.", "erro", 15000);
  }

  const form = $("#form-login");
  const erro = $("#login-erro");

  console.log("Passo 3: Tela aguardando resposta do Firebase...");

  onAuthStateChanged(auth, (u) => {
    console.log("Passo 4: Firebase respondeu! Usuário logado?", u ? "Sim" : "Não");
    
    if (u) { 
        console.log("Passo 5: Redirecionando para", DESTINO);
        location.replace(DESTINO); 
        return; 
    }
    
    const carregando = $("#carregando");
    if (carregando) carregando.remove();
    
    $("#acesso").hidden = false;
    $("#login-email").focus();
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro.textContent = "";
    await comCarregamento($("#btn-entrar"), "Entrando…", async () => {
      try {
        await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-senha").value);
        location.replace(DESTINO);
      } catch (e) {
        erro.textContent = mensagemDeErro(e);
        $("#login-senha").select();
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
}