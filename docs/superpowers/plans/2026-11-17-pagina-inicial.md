# Página inicial do Agendanov + demonstrações: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar a página inicial provisória por uma apresentação do Agendanov e criar 4 negócios de demonstração (barbearia, manicure, lash e salão), com botões no `/admin` para criar e limpar essas demonstrações.

**Architecture:** os dados das demonstrações ficam em um módulo puro (`public/js/demos.js`) que pode ser testado com `node --test`. O `/admin` usa esse módulo para gravar ou limpar os documentos no Firestore. O `negocio.html` reconhece `demo: true` e mostra uma faixa de aviso. A página inicial é HTML estático com um CSS próprio (`inicio.css`), no visual do portfólio.

**Tech Stack:** HTML, CSS e JS puro (ES modules) e Firebase 10.12.2 via CDN. Os testes rodam com `node --test` (Node 22) e não têm dependências.

**Spec:** `docs/superpowers/specs/2026-11-17-pagina-inicial-design.md`

## Global Constraints
- Nome do produto: **Agendanov**. Marca do Jhemison: **NOVAA On**. Nenhum texto visível em `public/` pode conter "JhemisonTech" ou "Agenda Fácil". A URL `https://jhemisontech.web.app` pode aparecer só dentro de um `href`.
- WhatsApp do Jhemison: `5573988045634`.
- Slugs das demonstrações: `demo-barbearia`, `demo-manicure`, `demo-lash`, `demo-salao`.
- Texto da faixa: `Isto é uma demonstração. Agende à vontade.`
- Título da página inicial: `Seu cliente agenda sozinho. Você recebe no WhatsApp.`
- Sem etapa de build e sem npm em produção. O `package.json` serve só para rodar `npm test`.
- `firestore.rules` NÃO muda.
- Visual da página inicial: tokens do portfólio (`--azul-escuro #0b5cad`, `--azul #2f8fe6`, `--azul-claro #38a3f5`, `--azul-borda #cfe4f8`, `--azul-fundo #e3f1fd`, `--texto #0f1b2d`, `--texto-suave #3d5a80`, fundo `#fff`), com manchas de aquarela azul e animações desligadas em `prefers-reduced-motion: reduce`.
- Deploy só pelo Jhemison: `firebase deploy --project seuagendamentofacil --only hosting`.

## Review Focus
1. Visitante abre a demonstração às 23h: o dia de hoje não tem horário, mas os próximos dias precisam ter, inclusive o domingo. As demonstrações abrem todos os dias.
2. Depois de muitos testes, a demonstração fica sem horário livre. O "Limpar agendamentos de teste" precisa apagar `agendamentos`, `ocupados` e `bloqueios` só dos 4 slugs de demonstração, nunca dos clientes reais.
3. Clicar em "Criar/atualizar demonstrações" duas vezes não pode duplicar nada nem dar erro. É `setDoc` com o mesmo ID.
4. Mensagem de WhatsApp que chega para o Jhemison a partir de uma demonstração: precisa deixar claro que veio de um teste do Agendanov. Num negócio real, a mensagem continua igual à de hoje.
5. Página inicial no celular (375px): nada pode passar da largura da tela, e os 4 cards ficam um embaixo do outro.

---

### Task 1: Dados das demonstrações e mensagens (módulo puro + testes)

**Files:**
- Create: `package.json`, `tests/demos.test.js`, `tests/utils.test.js`
- Create: `public/js/demos.js`
- Modify: `public/js/utils.js` (adicionar `mensagemAgendado` e `mensagemContato`)

**Interfaces:**
- Produces:
  - `demos.js`: `export const WHATS_NOVAA = '5573988045634'`, `export const SLUGS_DEMO = ['demo-barbearia','demo-manicure','demo-lash','demo-salao']`, `export function documentosDemo(): Array<{ slug: string, dados: object }>`. Os `dados` seguem o formato de `negocios/{slug}` usado no `admin.js` (nome, tipo, plano:'demo', whatsapp, endereco, logoUrl:'', cores{primaria,secundaria}, intervaloMinutos:30, horarioFuncionamento, servicos[], profissionais[], ativo:true, demo:true, donoUid:null). Não inclui `criadoEm` (quem grava é o admin).
  - `utils.js`: `mensagemAgendado(negocio, nome, texto): string` e `mensagemContato(negocio): string`.

- [ ] **Step 1: criar `package.json`** com `{"name":"agendanov","private":true,"type":"module","scripts":{"test":"node --test tests/"}}`.
- [ ] **Step 2: escrever os testes que devem falhar**

`tests/demos.test.js`:
```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { documentosDemo, SLUGS_DEMO, WHATS_NOVAA } from '../public/js/demos.js';
import { slugValido, DIAS, horariosDisponiveis } from '../public/js/utils.js';

test('4 demonstrações com os slugs combinados', () => {
  assert.deepEqual(documentosDemo().map(d => d.slug), SLUGS_DEMO);
  assert.deepEqual(SLUGS_DEMO, ['demo-barbearia', 'demo-manicure', 'demo-lash', 'demo-salao']);
  SLUGS_DEMO.forEach(s => assert.ok(slugValido(s)));
});
test('cada demonstração está ativa, marcada como demo e com o WhatsApp do Jhemison', () => {
  for (const { dados } of documentosDemo()) {
    assert.equal(dados.ativo, true); assert.equal(dados.demo, true);
    assert.equal(dados.whatsapp, WHATS_NOVAA); assert.equal(WHATS_NOVAA, '5573988045634');
  }
});
test('serviços e profissionais válidos e com IDs únicos', () => {
  for (const { dados } of documentosDemo()) {
    assert.ok(dados.servicos.length >= 4 && dados.servicos.length <= 6);
    assert.ok(dados.profissionais.length >= 1 && dados.profissionais.length <= 2);
    for (const s of dados.servicos) { assert.ok(s.nome && s.duracao > 0 && s.preco > 0); }
    const ids = [...dados.servicos, ...dados.profissionais].map(x => x.id);
    assert.equal(new Set(ids).size, ids.length);
    ids.forEach(id => assert.match(id, /^[a-z0-9]+$/));
  }
});
test('abre todos os dias, então sempre há horário em algum dia da semana', () => {
  for (const { dados } of documentosDemo()) {
    DIAS.forEach(d => assert.ok(Array.isArray(dados.horarioFuncionamento[d]), d));
    const livres = horariosDisponiveis(dados, '2030-01-06', dados.servicos[0].duracao, new Set());
    assert.ok(livres.length > 0);
  }
});
test('documentosDemo devolve cópias novas a cada chamada', () => {
  const a = documentosDemo(); a[0].dados.nome = 'x';
  assert.notEqual(documentosDemo()[0].dados.nome, 'x');
});
```

`tests/utils.test.js`:
```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { mensagemAgendado, mensagemContato } from '../public/js/utils.js';

test('mensagem de negócio real não muda', () => {
  assert.equal(mensagemAgendado({ nome: 'Barbearia do Zé' }, 'Ana', 'Corte em 20/11/2026 às 14:00.'),
    'Olá! Sou Ana e acabei de agendar pelo site: Corte em 20/11/2026 às 14:00.');
  assert.equal(mensagemContato({ nome: 'Barbearia do Zé' }), 'Olá! Vim pelo site da Barbearia do Zé.');
});
test('mensagem de demonstração avisa que é teste do Agendanov', () => {
  const n = { nome: 'Barbearia Exemplo', demo: true };
  assert.equal(mensagemAgendado(n, 'Ana', 'Corte em 20/11/2026 às 14:00.'),
    'Olá! Sou Ana e testei a demonstração do Agendanov (Barbearia Exemplo): Corte em 20/11/2026 às 14:00. Quero saber mais!');
  assert.equal(mensagemContato(n), 'Olá! Vi a demonstração do Agendanov (Barbearia Exemplo) e quero saber mais.');
});
```

- [ ] **Step 3: rodar `npm test`.** Esperado: FALHA (`demos.js` não existe e `mensagemAgendado` não está exportada).
- [ ] **Step 4: implementar `public/js/demos.js` e as duas funções em `utils.js`.** `documentosDemo()` monta os objetos na hora (cópias novas a cada chamada). Valores sugeridos (quem constrói pode ajustar os nomes):
  - `demo-barbearia`: "Barbearia Exemplo", tipo `barbearia`, cores `#1e3a8a`/`#0f172a`. Serviços: Corte 30min R$35, Barba 30min R$25, Corte + barba 60min R$55, Pigmentação 30min R$30, Sobrancelha 30min R$15. Profissionais: Rafael e Diego.
  - `demo-manicure`: "Studio Unhas Exemplo", tipo `salao`, cores `#db2777`/`#500724`. Serviços: Mão 60min R$30, Pé 60min R$35, Pé e mão 90min R$60, Alongamento em gel 120min R$120, Esmaltação em gel 60min R$50. Profissional: Camila.
  - `demo-lash`: "Lash Exemplo", tipo `salao`, cores `#9d6b9f`/`#3b2340`. Serviços: Fio a fio 120min R$130, Volume brasileiro 120min R$150, Manutenção 60min R$80, Lash lifting 60min R$90, Design de sobrancelha 30min R$35. Profissional: Juliana.
  - `demo-salao`: "Salão Exemplo", tipo `salao`, cores `#b45309`/`#451a03`. Serviços: Corte feminino 60min R$70, Escova 60min R$45, Hidratação 60min R$60, Coloração 120min R$150, Progressiva 180min R$220. Profissionais: Patrícia e Larissa.
  - Horário (as 4 iguais): seg a sáb `['09:00','19:00']`, dom `['09:00','13:00']`. Endereço: `Itamaraju – BA (demonstração)`.
  - IDs fixos e legíveis, por exemplo `corte`, `barba`, `rafael`.
- [ ] **Step 5: trocar em `negocio.js`** os dois textos montados na mão (linhas 83 e 230-231) por `U.mensagemContato(n)` e `U.mensagemAgendado(negocio, nome, texto)`.
- [ ] **Step 6: rodar `npm test`.** Esperado: todos os testes PASSAM.
- [ ] **Step 7: commit** `Dados das demonstrações e mensagens de WhatsApp`.

### Task 2: Faixa de demonstração no site do negócio

**Files:**
- Modify: `public/negocio.html` (faixa logo acima do `<header class="topo">`), `public/js/negocio.js` (`renderCabecalho`), `public/css/style.css`

**Interfaces:**
- Consumes: o campo `negocio.demo === true` (Task 1).

- [ ] **Step 1:** adicionar `<div id="faixa-demo" class="faixa-demo oculto">Isto é uma demonstração. Agende à vontade. <a href="/">Conhecer o Agendanov</a></div>`.
- [ ] **Step 2:** em `renderCabecalho`, remover `oculto` de `#faixa-demo` quando `n.demo === true`.
- [ ] **Step 3:** criar `.faixa-demo` em `style.css`: fundo `#fef3c7`, texto `#92400e`, centralizado, padding de 10px e fonte de .9rem.
- [ ] **Step 4: verificar no navegador** (Task 5 traz os comandos): ainda não há dados no banco, então usar um teste de navegador com Firebase falso (padrão já usado em `scratchpad/testes/modelo.cjs`). Opcionalmente, pular esta etapa e conferir depois na Task 5, com as demonstrações já criadas. Esperado: a faixa aparece com `demo:true` e some sem.
- [ ] **Step 5: commit** `Faixa de demonstração no site do negócio`.

### Task 3: Botões "Criar/atualizar demonstrações" e "Limpar agendamentos de teste" no /admin

**Files:**
- Modify: `public/admin/index.html` (nova `<section class="cartao">` entre o cadastro e a lista) e `public/js/admin.js`

**Interfaces:**
- Consumes: `documentosDemo()` e `SLUGS_DEMO` de `demos.js`.
- Produces: `async function criarDemos(): Promise<void>` e `async function limparDemos(): Promise<number>` (devolve quantos documentos apagou), ambas em `admin.js`.

- [ ] **Step 1:** adicionar ao HTML a seção "Demonstrações", com o texto "Barbearia, manicure, lash e salão para mostrar o sistema.", os links para os 4 sites, os botões `#btn-criar-demos` e `#btn-limpar-demos` (`btn-perigo`) e `<p id="demos-msg" class="muted">`.
- [ ] **Step 2:** `criarDemos`: para cada item de `documentosDemo()`, `setDoc(doc(db,'negocios',slug), {...dados, criadoEm: serverTimestamp()})`. Ao terminar, mostrar "Demonstrações prontas." e chamar `carregarNegocios()`.
- [ ] **Step 3:** `limparDemos`: pedir `confirm('Apagar todos os agendamentos e bloqueios das 4 demonstrações?')`. Para cada slug de `SLUGS_DEMO` e cada subcoleção (`agendamentos`, `ocupados`, `bloqueios`), fazer `getDocs` e apagar em `writeBatch`, com no máximo 450 por lote. Só usa `SLUGS_DEMO`, nunca a lista de negócios. Ao terminar, mostrar "N registros apagados.".
- [ ] **Step 4:** desabilitar o botão enquanto ele trabalha. Em caso de erro, mostrar `'Erro: ' + err.message` em `#demos-msg`.
- [ ] **Step 5: verificação.** `node --check public/js/admin.js` não pode acusar erro de sintaxe. O teste de verdade (com login) é feito pelo Jhemison na Task 5.
- [ ] **Step 6: commit** `Botões de demonstração no admin`.

### Task 4: Página inicial do Agendanov

**Files:**
- Modify: `public/index.html` (reescrever)
- Create: `public/css/inicio.css`, `tests/inicio.test.js`

**Interfaces:**
- Consumes: `SLUGS_DEMO`, `WHATS_NOVAA` (os valores entram fixos no HTML; o teste confere se batem).

- [ ] **Step 1: escrever o teste que deve falhar** `tests/inicio.test.js`. Ele lê `public/index.html` como texto e confere:
```js
// texto sem os atributos href:  html.replace(/href="[^"]*"/g, '')
assert.doesNotMatch(semHref, /jhemisontech/i);
assert.doesNotMatch(semHref, /agenda f[aá]cil/i);
assert.match(html, /Agendanov/);
assert.match(html, /NOVAA On/);
assert.match(html, /Seu cliente agenda sozinho\. Você recebe no WhatsApp\./);
for (const s of SLUGS_DEMO) assert.match(html, new RegExp(`href="/${s}"`));
assert.match(html, new RegExp(`https://wa\\.me/${WHATS_NOVAA}\\?text=`));
assert.match(html, /href="\/painel"/);
assert.match(html, /name="viewport"/);
```
- [ ] **Step 2: rodar `npm test`.** Esperado: FALHA no título.
- [ ] **Step 3: escrever `index.html` e `inicio.css`** seguindo a spec: topo (logo de texto "📅 Agendanov" com ícone SVG de calendário de traço fino azul, título, subtítulo, botão "Quero no meu negócio"), 4 vantagens com ícones SVG de traço fino, "Experimente como cliente" (4 cards com a cor de cada demonstração, ícone, nome e "Testar agendamento →"), "Como funciona" em 3 passos e rodapé ("Me chama no WhatsApp", "Acessar meu painel", "feito por NOVAA On" com link para `https://jhemisontech.web.app`). Mensagem pronta do WhatsApp: `Olá! Vi o Agendanov e quero agendamento online no meu negócio.` (com encode na URL). Incluir `<meta name="description">` e o title `Agendanov | Agendamento online pelo WhatsApp`. O CSS usa os tokens das Global Constraints, as manchas `.mancha` com `position: fixed` e `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`. Não carregar o `style.css`.
- [ ] **Step 4: rodar `npm test`.** Esperado: PASSA.
- [ ] **Step 5: verificar no navegador.** Abrir `public/index.html` servido localmente (ver Task 5) em desktop e em 375px. Esperado: sem rolagem horizontal (`document.documentElement.scrollWidth <= innerWidth`), cards em 1 coluna no celular e sem erros no console. Tirar prints.
- [ ] **Step 6: commit** `Página inicial do Agendanov`.

### Task 5: Renomear, README e entrega

**Files:**
- Modify: `README.md` (título "Agendanov", seção "Demonstrações", como rodar `npm test`), `public/painel/index.html` e `public/admin/index.html` (se algum título disser "Agenda Fácil")
- Create: `.claude/launch.json` (servidor local: `npx --yes http-server public -p 5600 -c-1`, ou `firebase emulators:start --only hosting --project seuagendamentofacil`)

- [ ] **Step 1:** `Grep` por `Agenda Fácil|JhemisonTech` em `public/` e no `README.md`. Esperado: nenhum texto visível, só a URL do portfólio no `href`.
- [ ] **Step 2:** rodar `npm test`. Esperado: tudo PASSA.
- [ ] **Step 3: commit** `Renomeia para Agendanov e atualiza README` e `git push`.
- [ ] **Step 4: o Jhemison faz** o deploy (`firebase deploy --project seuagendamentofacil --only hosting`), entra no `/admin` e clica em "Criar/atualizar demonstrações".
- [ ] **Step 5: conferir no ar:** abrir `/`, `/demo-barbearia`, `/demo-manicure`, `/demo-lash` e `/demo-salao`. Esperado: a faixa aparece, os serviços e horários listam e as cores mudam por demonstração. Fazer 1 agendamento de teste, ver o botão de WhatsApp com a mensagem da demonstração e pedir ao Jhemison para clicar em "Limpar agendamentos de teste".
