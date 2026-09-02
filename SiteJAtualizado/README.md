# Controle de Entregas e Ocorrências — v2

SPA sem build, sem Node e sem Python. Agora com **uma página por módulo**.

```
index.html        Acesso (login). Sem sessão, todas as outras páginas voltam para cá.
buscar.html       Consulta da NF + grade de itens + registro da ocorrência
importar.html     Upload da planilha do dia
ocorrencias.html  Painel, filtros, distribuição e exportação
retencao.html     Carga consolidada por placa

assets/styles.css
firestore.rules
js/
  config.js       ← único arquivo que você edita
  firebase.js     inicialização do SDK
  layout.js       barra lateral, cabeçalho e trava de sessão (compartilhado)
  auth.js         login (só o index)
  importar.js     planilha → Firestore
  nota.js         busca da NF, grade de itens, ocorrência
  dashboard.js    painel de ocorrências
  retencao.js     retenção por placa
  mailto.js       rascunhos do Outlook
  ui.js           formatação e utilitários
```

## O que mudou nesta versão

**1. O login virou uma página própria.** O bug tinha uma causa específica: o
atributo `hidden` do HTML perde para qualquer `display` definido em CSS, e a
tela de login usava `display:grid`. Ela continuava ocupando espaço mesmo
"escondida". Agora são arquivos separados — depois de autenticar, o navegador
vai para `buscar.html` e o login some de vez. A folha de estilo também ganhou
`[hidden]{display:none !important}` para o problema não voltar em outro lugar.

**2. Quatro páginas independentes**, cada uma com sua URL. O menu lateral não é
copiado em quatro arquivos: `layout.js` monta a barra em todas elas, então
mexer no menu num lugar vale para o sistema inteiro. Esse módulo também é a
trava da sessão: quem não está logado é mandado ao login antes de qualquer
conteúdo renderizar.

**3. Correção de importação.** Sua planilha tem uma linha por item, com a NF
repetida. Como o ID do documento é o número da NF, cada linha sobrescrevia a
anterior e só o último item de cada nota sobrevivia no banco. Agora as linhas
são agrupadas por NF e viram uma lista de itens dentro da nota. Itens com o
mesmo código na mesma NF são somados.

**4. Grade de itens na tela de busca**, com as regras que você pediu:

| Motivo | Devolvido | Quebra |
|---|---|---|
| Devolução total | preenchido com a quantidade cheia, travado | zerado e travado |
| Devolução parcial | aberto | aberto |
| Quebra de peso | zerado e travado | aberto |
| Demais motivos | grade não aparece | — |

O valor devolvido de cada linha é `(devolvido + quebra) × valor unitário`, e o
peso devolvido é proporcional ao peso líquido do item. Trocar o motivo reinicia
a grade. Linha em que a soma passa da quantidade da nota fica marcada em
vermelho e bloqueia a gravação.

Essas regras estão em `MOTIVOS`, no `config.js` — cada motivo diz se abre,
trava ou preenche cada campo. Mudar o comportamento de um motivo é editar uma
linha, não mexer em código.

**5. "Cópia logística" saiu do canhoto da nota**, como você pediu. Os
destinatários agora são dois campos editáveis no formulário ("Para" e "Cc"),
preenchidos com o padrão de `DESTINATARIOS_PADRAO`.

## Um ponto que precisa da sua decisão

**Sua planilha não tem coluna de quantidade nem de e-mail.**

Sem quantidade, o sistema usa o **peso líquido como base** e conta a devolução
em quilos — o que é correto para quebra de peso, mas não para devolver "3
caixas". Se a planilha tiver (ou puder ter) uma coluna de quantidade,
acrescente o nome dela em `COLUNAS.quantidade` no `config.js`: o sistema passa
a contar em unidades sozinho. A tela de importação mostra qual dos dois modos
ficou ativo.

O mesmo vale para o valor: como não há coluna de valor total, ele é calculado
como `valor unitário × base`. Se a base for peso, isso só fecha se o valor
unitário for por quilo.

Sem e-mail na planilha, preencha `DESTINATARIOS_PADRAO` no `config.js` com o
endereço da logística, e digite o do vendedor na hora. Se um dia a planilha
trouxer os e-mails, basta o cabeçalho casar com `COLUNAS.emailVendedor` — o
resto já está pronto.

## Rodar

Não abra por duplo clique: módulos JavaScript e o Firebase Auth exigem `http://`.
No VS Code, extensão **Live Server** → botão direito no `index.html` →
*Open with Live Server*. Extensões não pedem direito de administrador.

## Regras do Firestore

As de `firestore.rules` continuam valendo sem alteração. Se ainda não publicou,
cole no console: Firestore Database → Regras → Publicar.

## Modelo de dados

```
notas/{NF}
  numeroNf, placa, cliente, vendedor, motorista, cidade, bairro, endereco
  unidade: "un" | "kg"
  itens: [{ codigo, descricao, pesoLiquido, quantidade, valorUnitario, valorTotal }]
  peso, pesoLiquido, valor, qtdItens, lote, importadoPor, importadoEm

ocorrencias/{auto}
  numeroNf, placa, motivo, observacao, unidade
  itens: [{ codigo, descricao, devolvido, quebra, pesoDevolvido, valorDevolvido }]
  totalQtd, totalPeso, totalValor, para, cc
  criadoPor{uid,nome,email}, criadoPorEmail, dataRef, criadoEm

retencoes/{auto}
  placa, nfs[], quantidadeNfs, totalValor, totalPeso, totalItens
  motoristas[], vendedores[], motivo, criadoPor, dataRef, criadoEm
```

O `peso` da nota usa uma heurística: se o valor da coluna "Peso" for igual em
todas as linhas da NF, é campo de cabeçalho e o sistema pega um só; se variar
entre linhas, é peso por item e o sistema soma. Confira o total de uma nota
conhecida na primeira importação.
