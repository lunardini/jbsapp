# Controle de Entregas e Ocorrências

SPA 100% frontend (HTML + CSS + JavaScript modular) com Firebase Auth e Firestore.
Sem Node, sem Python, sem build, sem instalação com privilégio de administrador.

```
index.html
assets/styles.css
firestore.rules
js/
  config.js        ← ÚNICO arquivo que você precisa editar
  firebase.js      inicialização do SDK (CDN)
  auth.js          login, logout, sessão
  importar.js      leitura da planilha → Firestore
  ocorrencias.js   busca de NF e registro de ocorrência
  dashboard.js     painel, filtros e exportação XLSX
  retencao.js      carga por placa e e-mail de retenção
  mailto.js        montagem dos rascunhos do Outlook
  ui.js            formatação, avisos, utilitários
  app.js           navegação e inicialização
```

## 1. Firebase (uma vez, ~10 minutos)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Adicionar projeto**.
2. **Criar banco de dados** em Firestore Database → modo produção → região `southamerica-east1` (São Paulo).
3. Aba **Regras** → cole o conteúdo de `firestore.rules` → **Publicar**.
4. **Authentication** → Sign-in method → habilite **E-mail/senha**.
5. Aba **Users** → **Adicionar usuário** para cada colega (não há tela de cadastro no app; isso é proposital, para ninguém de fora criar conta).
6. **Configurações do projeto** → role até "Seus apps" → ícone `</>` → registre um app web → copie o objeto `firebaseConfig` para `js/config.js`.

> As chaves do `firebaseConfig` não são segredo: elas apenas identificam o projeto.
> Quem protege os dados são as regras do passo 3.

## 2. Ajustar as colunas da sua planilha

Em `js/config.js`, acrescente o nome real de cada coluna na lista correspondente.
A comparação ignora acentos, maiúsculas, espaços e `_`, então `Numero_NF`, `número nf` e
`NUMERO NF` são equivalentes. Ao selecionar o arquivo, a tela de importação mostra
lado a lado qual coluna casou com qual campo — se algo aparecer como
"não encontrada", é só corrigir a lista e selecionar o arquivo de novo.

## 3. Rodar no PC corporativo

Não abra o `index.html` com duplo clique: módulos JavaScript e o Firebase Auth exigem
`http://`, não `file://`.

No VS Code, instale a extensão **Live Server** (Ritwick Dey) — extensões não pedem
direitos de administrador. Depois: botão direito no `index.html` → **Open with Live Server**.
O endereço vira `http://127.0.0.1:5500`, que o Firebase já aceita por padrão
(`localhost` está pré-autorizado em Authentication → Settings → Authorized domains).

Para publicar para a equipe sem servidor: **Firebase Hosting** (precisa da CLI) ou
qualquer pasta de rede servida por HTTP. Se hospedar, adicione o domínio na lista de
domínios autorizados do Authentication.

## 4. Domínios que precisam passar pelo proxy

Se a rede da empresa filtrar saída, libere:

- `www.gstatic.com` (SDK do Firebase)
- `*.googleapis.com` e `*.firebaseio.com` (Auth e Firestore)
- `cdn.jsdelivr.net` (SheetJS)
- `fonts.googleapis.com` e `fonts.gstatic.com` (fontes — se bloqueado, o app cai para Segoe UI/Consolas sem quebrar)

## 5. Sobre o `mailto:` e o Outlook

O `mailto:` abre o cliente de e-mail **padrão do Windows**. Confirme em
Configurações → Aplicativos → Aplicativos padrão → E-mail → Outlook.

Limitações conhecidas, já tratadas em `js/mailto.js`:

- O Windows corta a URL em torno de 2.000 caracteres. O corpo é abreviado antes disso,
  com aviso na tela — o e-mail nunca chega truncado sem você saber.
- Quebras de linha viram `%0D%0A`; sem isso o Outlook junta tudo num parágrafo só.
- O corpo é texto puro. `mailto:` não transporta HTML, anexo nem assinatura corporativa
  (a assinatura padrão do Outlook é aplicada por ele mesmo ao abrir o rascunho).
- Se o rascunho não abrir, use **Copiar e-mail como texto** e cole no Outlook.
- Vários destinatários são separados por vírgula (RFC 6068). Se a sua instalação do
  Outlook estiver configurada para ponto e vírgula, troque a constante `SEPARADOR`
  no topo de `js/mailto.js` para `";"`.

## 6. Modelo de dados

| Coleção | ID | Conteúdo |
|---|---|---|
| `notas` | número da NF normalizado | dados da planilha do dia |
| `ocorrencias` | automático | motivo, observação, NF, placa, autor, `dataRef` |
| `retencoes` | automático | placa, NFs, totais, vendedores, autor, `dataRef` |

Usar o número da NF como ID do documento faz a busca ser uma leitura direta
(rápida e barata) em vez de uma varredura da coleção, e faz a reimportação
atualizar a nota em vez de duplicá-la.

O campo `dataRef` (`YYYY-MM-DD`) existe para o filtro de período do dashboard:
como o `where` de intervalo e o `orderBy` usam o mesmo campo, o Firestore resolve
com o índice automático e você não precisa criar índice composto. Motivo e usuário
são filtrados na memória, sobre o resultado já reduzido do período.

## 7. Próximos passos naturais

- Trocar `getDocs` por `onSnapshot` no dashboard para a lista atualizar sozinha quando
  um colega registrar uma ocorrência (`onSnapshot` já está exportado em `firebase.js`).
- Custom claims para separar quem pode importar planilha de quem só registra ocorrência.
- Firebase Hosting para todo mundo acessar por uma URL, sem depender do Live Server.
