// ============================================================================
// config.js — ÚNICO arquivo que você precisa editar para colocar no ar.
// ============================================================================

// 1) Cole aqui o objeto do seu projeto Firebase
//    (Console Firebase > Configurações do projeto > Seus apps > Web)
export const firebaseConfig = {
  apiKey: "AIzaSyDvs3-MDUIWpPGezZDje5HBqNHF6S10OPU",
  authDomain: "ocorrencias-2e779.firebaseapp.com",
  projectId: "ocorrencias-2e779",
  storageBucket: "ocorrencias-2e779.firebasestorage.app",
  messagingSenderId: "945955063295",
  appId: "1:945955063295:web:5776def7a1ed6b3df593ca",
  measurementId: "G-YLLP6LFY7L"
};

// 2) Mapeamento das colunas da planilha.
//    A chave é o campo interno do sistema; a lista são os nomes aceitos no
//    cabeçalho do arquivo. A comparação ignora acentos, espaços, maiúsculas,
//    "_", "-" e ".". Ou seja: "Numero_NF", "número nf" e "NUMERO-NF" casam.
//    Basta acrescentar o nome real da sua coluna na lista correspondente.
export const COLUNAS = {
  numeroNf:       ["Numero_NF", "Numero NF", "NF", "Nota Fiscal", "Nota", "Documento"],
  placa:          ["Placa_Veiculo", "Placa Veiculo", "Placa", "Veiculo"],
  valor:          ["Valor", "Valor_NF", "Valor Total", "Valor da Nota"],
  peso:           ["Peso", "Peso_KG", "Peso Bruto", "Peso Liquido"],
  vendedor:       ["Vendedor", "Nome_Vendedor", "Representante"],
  emailVendedor:  ["Email_Vendedor", "E-mail Vendedor", "Email do Vendedor"],
  emailLogistica: ["Email_Logistica", "E-mail Logistica", "Email da Logistica"],
  // Campos opcionais: se não existirem na planilha, são simplesmente ignorados.
  cliente:        ["Cliente", "Razao_Social", "Destinatario"],
  cidade:         ["Cidade", "Municipio", "Cidade_Entrega"],
  transportadora: ["Transportadora", "Transp"],
  dataEmissao:    ["Data_Emissao", "Data Emissao", "Emissao", "Data"],
};

// Campos que a aplicação exige para funcionar. O import falha cedo e explica
// o que faltou, em vez de gravar lixo no banco.
export const COLUNAS_OBRIGATORIAS = ["numeroNf", "placa", "valor", "peso", "emailVendedor"];

// 3) Motivos disponíveis no dropdown de ocorrência.
export const MOTIVOS = [
  "Devolução total",
  "Devolução parcial",
  "Cliente fechado",
  "Sem carimbo",
  "Quebra de peso",
  "Demora no recebimento",
  "Localização",
  "Reentrega",
  "Outros",
];

// 4) E-mail que entra em cópia quando a planilha não trouxer Email_Logistica.
export const EMAIL_LOGISTICA_PADRAO = "logistica@suaempresa.com.br";

// 5) Identificação usada nos assuntos de e-mail.
export const APELIDO_OPERACAO = "Logística";
