// ============================================================================
// firebase.js — inicializa o SDK (CDN, sem npm) e reexporta o que os módulos usam.
// Trocar a versão aqui atualiza o projeto inteiro.
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, setPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  query, where, orderBy, limit, writeBatch, serverTimestamp, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Mantém a sessão aberta entre recarregamentos da página.
setPersistence(auth, browserLocalPersistence).catch(() => {});

export {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  query, where, orderBy, limit, writeBatch, serverTimestamp, onSnapshot,
};

// Nomes das coleções em um só lugar.
export const COL = {
  notas: "notas",
  ocorrencias: "ocorrencias",
  retencoes: "retencoes",
};
