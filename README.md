# Agendanov: sistema de agendamento para vários negócios

Um código só e um projeto Firebase só, atendendo vários clientes (multi-tenant).
Feito em HTML, CSS e JS puro (ES modules), com Firestore, Authentication e Hosting.

```
seusite.com/                   → sua página de vendas
seusite.com/barbearia-do-ze    → site público de agendamento de cada negócio
seusite.com/painel             → painel do dono (agenda, serviços, profissionais, configurações)
seusite.com/admin              → seu painel: cadastrar, suspender e reativar clientes
```

## Estrutura

```
firebase.json          rewrites de URL (/slug → negocio.html) e caminho das regras
firestore.rules        regras de segurança (a parte mais importante)
public/
  index.html           página inicial / vendas
  negocio.html         site público de agendamento
  painel/index.html    painel do dono
  admin/index.html     painel do super admin
  css/style.css        estilos (cores via variáveis CSS, trocadas por negócio)
  js/firebase-config.js  configuração do Firebase  ← EDITE
  js/utils.js          funções puras (horários, slots, formatação, escape de HTML)
  js/negocio.js        lógica do site público
  js/painel.js         lógica do painel do dono
  js/admin.js          lógica do super admin
```

## Dados no Firestore

```
negocios/{slug}                 config pública: nome, cores, horários, ativo, plano
                                + servicos: [{ id, nome, duracao, preco, ativo }]
                                + profissionais: [{ id, nome, ativo, servicos?, horario? }]
                                + diasAFrente (até quantos dias o cliente pode marcar; padrão 60)
  agendamentos/{slotId}         dados do cliente (PRIVADO)
  cancelados/{id}               histórico de agendamentos cancelados (PRIVADO)
  ocupados/{slotId}             só "horário pego" (público, sem dados pessoais)
  bloqueios/{id}                folgas e horários travados pelo dono (privado)
usuarios/{uid}                  papel: "dono" | "superadmin", negocioId
```

Serviços e profissionais ficam em arrays dentro do documento do negócio: o site público
carrega tudo com **1 leitura**, o que importa no plano Spark (50 mil leituras/dia).

`slotId` = `profissional_data_hora`, ex.: `abc123_2026-11-20_1430`.
Como as regras só permitem **criar** esses documentos (nunca sobrescrever), duas pessoas
não conseguem pegar o mesmo horário. Um serviço de 60 min com intervalo de 30 ocupa
2 documentos em `ocupados`, todos gravados juntos num `writeBatch`.

## Como colocar para rodar

1. **Crie o projeto** em https://console.firebase.google.com e ative:
   - Firestore Database (modo produção)
   - Authentication → método **E-mail/senha**
   - Hosting
2. **Cadastre um app da Web** no projeto e cole a configuração em `public/js/firebase-config.js`.
3. **Instale a CLI e vincule o projeto:**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # escolha seu projeto (atualiza o .firebaserc)
   ```
4. **Publique as regras:**
   ```bash
   firebase deploy --only firestore:rules
   ```
5. **Crie o seu usuário de super admin** (só uma vez, manualmente):
   - Authentication → Adicionar usuário (seu e-mail e senha) → copie o **UID**
   - Firestore → coleção `usuarios` → documento com ID = seu UID → campo `papel` = `superadmin`
6. **Rode localmente:**
   ```bash
   firebase emulators:start --only hosting
   ```
   Abra http://localhost:5000/admin.
   (Com o Live Server do VS Code os rewrites não funcionam. Abra a pasta `public` como raiz
   e use `negocio.html?n=slug` para o site público.)
7. **Teste o fluxo completo:**
   - No `/admin`, cadastre um negócio (cria o negócio e o login do dono).
   - Entre no `/painel` com o login do dono, cadastre serviços e profissionais e ajuste os horários.
   - Abra `/slug-do-negocio` e faça um agendamento.
   - Tente agendar o mesmo horário em outra aba: precisa falhar.
   - Cadastre um 2º negócio e confirme que um dono não vê os dados do outro.
8. **Publique:**
   ```bash
   firebase deploy
   ```

## Demonstrações

A página inicial (`/`) tem 4 negócios de teste para o visitante experimentar:
`/demo-barbearia`, `/demo-manicure`, `/demo-lash` e `/demo-salao`.

- Os dados deles ficam em `public/js/demos.js` (serviços, preços, cores).
- No `/admin`, o botão **Criar/atualizar demonstrações** grava os 4 no banco (rodar de novo não duplica).
- O botão **Limpar agendamentos de teste** apaga os agendamentos, horários ocupados e bloqueios
  **só das demonstrações**, nunca de clientes reais.
- O botão de WhatsApp das demonstrações manda para o número do dono do Agendanov
  (`WHATS_NOVAA` em `demos.js`).

## Testes

```bash
npm test
```

Roda os testes das funções puras (`demos.js` e `utils.js`: horários, profissionais, limites, calendário) e confere a página inicial.

## Observações

- **Mudar o intervalo** (ex.: de 1 hora para 30 min): ao salvar, o painel faz cada horário já
  ocupado na grade antiga ocupar também os horários da grade nova que caem por cima dele.
  Assim não abre brecha para dois clientes no mesmo horário.
- **Cancelar** guarda uma cópia em `cancelados` (aparece riscado na agenda, com o botão
  "Avisar cliente") e apaga o original, liberando os horários.
- **Regras de segurança:** o ID de cada horário precisa bater com a data, a hora e o
  profissional gravados, e o telefone precisa ter pelo menos 10 caracteres.
- **Profissionais** podem ter horário próprio e uma lista de serviços que fazem
  (sem lista, fazem todos). Folgas marcadas para "Todos" valem também para quem for
  cadastrado depois.

## Proteção contra robôs (App Check)

Qualquer pessoa pode criar agendamentos (é a ideia), então um robô poderia ocupar todos os
horários. O código já está pronto para o App Check com reCAPTCHA v3; falta só a chave:

1. Em https://www.google.com/recaptcha/admin crie um site do tipo **reCAPTCHA v3** com o
   domínio `agendanov.web.app` e copie a **chave do site** e a **chave secreta**.
2. No console do Firebase: **App Check → Apps → app da Web → reCAPTCHA v3** e cole a chave secreta.
3. Em `public/js/firebase-config.js`, cole a chave do site em `RECAPTCHA_CHAVE_SITE` e publique.
4. Espere um dia vendo em **App Check → APIs → Cloud Firestore** se as requisições aparecem
   como verificadas. Só então clique em **Aplicar** (enforce). Antes disso, aplicar bloquearia
   todo mundo.
- A config do Firebase no front **não é segredo**. Quem protege os dados são as regras.

## Próximos passos sugeridos

- [x] Folgas e bloqueios de horário (aba no painel)
- [ ] Cloud Function: e-mail ou WhatsApp de lembrete 1 dia antes
- [ ] Cloud Function: validar disponibilidade no servidor
- [ ] Upload de logo e fotos com Firebase Storage
- [ ] Domínio próprio por cliente (plano premium)
- [ ] Controle de mensalidade no admin (vencimento, suspender automático)
- [ ] Página de vendas no `index.html` com planos e demonstração
