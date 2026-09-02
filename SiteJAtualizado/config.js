// ============================================================================
// config.js — ÚNICO arquivo que você precisa editar para colocar no ar.
// ============================================================================

// 1) Projeto Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyDvs3-MDUIWpPGezZDje5HBqNHF6S10OPU",
  authDomain: "ocorrencias-2e779.firebaseapp.com",
  projectId: "ocorrencias-2e779",
  storageBucket: "ocorrencias-2e779.firebasestorage.app",
  messagingSenderId: "945955063295",
  appId: "1:945955063295:web:5776def7a1ed6b3df593ca",
  measurementId: "G-YLLP6LFY7L",
};

// ----------------------------------------------------------------------------
// 2) Colunas da planilha.
//    A comparação ignora acentos, maiúsculas, espaços, "_", "-" e ".".
//
//    IMPORTANTE: sua planilha tem UMA LINHA POR ITEM, com o número da NF
//    repetido. O sistema agrupa essas linhas: os campos de CABECALHO abaixo
//    vêm da primeira linha da NF, e os campos de ITEM viram a lista de itens.
// ----------------------------------------------------------------------------
export const COLUNAS = {
  // ---- cabeçalho da nota (repetido em toda linha da mesma NF) ----
  numeroNf:      ["Número_NF", "Número NF", "NF", "Nota Fiscal", "Nota", "Documento", "Número NFS"],
  placa:         ["Placa_Veiculo", "Placa Veiculo", "Placa", "Veiculo"],
  peso:          ["Peso", "Peso_KG", "Peso Bruto"],
  vendedor:      ["Vendedor", "Nome_Vendedor", "Representante"],
  cliente:       ["Cliente", "Razao_Social", "Destinatario"],
  codigoCliente: ["Código cliente", "Codigo cliente"],
  cidade:        ["Cidade", "Municipio", "Cidade_Entrega"],
  bairro:        ["Bairro"],
  endereco:      ["Endereço", "Endereco"],
  motorista:     ["Motorista"],
  descricao:     ["Descrição", "Descricao"],

  // Opcionais: se a planilha passar a trazer os e-mails, eles são usados
  // automaticamente no lugar dos destinatários padrão do item 4.
  emailVendedor:  ["Email_Vendedor", "E-mail Vendedor", "Email do Vendedor", "E-mail"],
  emailLogistica: ["Email_Logistica", "E-mail Logistica"],

  // ---- item (muda a cada linha da mesma NF) ----
  codigoItem:    ["Código item", "Codigo item", "Cod item", "SKU"],
  descricaoItem: ["Descrição item", "Descricao item", "Item", "Produto"],
  pesoLiquido:   ["Peso total liquido", "Peso total líquido", "Peso_total_liquido", "Peso liquido"],
  valorUnitario: ["Valor unitário do item", "Valor unitario do item", "Valor unitário", "Valor unitario"],
  quantidade:    ["Quantidade", "Qtde", "Qtd", "Quantidade item", "Qtd item", "Volumes", "Caixas"],
};

export const COLUNAS_OBRIGATORIAS = ["numeroNf", "placa"];

// ----------------------------------------------------------------------------
// 3) Base de cálculo do item.
//    Se a planilha tiver coluna de quantidade, o devolvido é contado em
//    unidades. Se não tiver, o sistema usa o peso líquido como base e conta
//    em quilos — que é o comportamento certo para quebra de peso.
//    Deixe "auto" para o sistema decidir por NF, ou fixe em "un" ou "kg".
// ----------------------------------------------------------------------------
export const BASE_ITEM = "auto";

// ----------------------------------------------------------------------------
// 4) Destinatários padrão dos e-mails.
//    Sua planilha ainda não traz e-mail, então estes valores preenchem os
//    campos "Para" e "Cc" do formulário — que continuam editáveis na tela.
// ----------------------------------------------------------------------------
export const DESTINATARIOS_PADRAO = {
  para: "",                                    // ex.: "vendas@suaempresa.com.br"
  cc: "logistica@suaempresa.com.br",
};

// ----------------------------------------------------------------------------
// 5) Motivos e como cada um trata a grade de itens.
//      devolvido: "cheio" (preenche com o total da nota e trava)
//                 "aberto" (você digita)
//                 "zero"   (fica em zero e travado)
//      quebra:    mesmas opções
// ----------------------------------------------------------------------------
export const MOTIVOS = [
  { nome: "Devolução total",       devolvido: "cheio",  quebra: "zero",   itens: true  },
  { nome: "Devolução parcial",     devolvido: "aberto", quebra: "aberto", itens: true  },
  { nome: "Quebra de peso",        devolvido: "zero",   quebra: "aberto", itens: true  },
  { nome: "Cliente fechado",       devolvido: "zero",   quebra: "zero",   itens: false },
  { nome: "Sem carimbo",           devolvido: "zero",   quebra: "zero",   itens: false },
  { nome: "Demora no recebimento", devolvido: "zero",   quebra: "zero",   itens: false },
  { nome: "Localização",           devolvido: "zero",   quebra: "zero",   itens: false },
  { nome: "Reentrega",             devolvido: "zero",   quebra: "zero",   itens: false },
  { nome: "Outros",                devolvido: "aberto", quebra: "aberto", itens: true  },
];

export const NOMES_MOTIVOS = MOTIVOS.map((m) => m.nome);
export const regraDoMotivo = (nome) =>
  MOTIVOS.find((m) => m.nome === nome) || { devolvido: "zero", quebra: "zero", itens: false };

// 6) Identificação usada nos assuntos de e-mail.
export const APELIDO_OPERACAO = "Logística";
