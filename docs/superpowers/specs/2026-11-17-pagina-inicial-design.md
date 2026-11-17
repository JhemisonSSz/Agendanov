# Página inicial do Agendanov + demonstrações

## Por quê
O Agendanov (nome novo do "Agenda Fácil") é a ferramenta de entrega do Jhemison: quando um cliente
pede "site + agendamento no WhatsApp", ele é cadastrado nesse sistema em vez de ganhar um site do zero.
O projeto vai aparecer no portfólio (jhemisontech.web.app). A página inicial serve para quem chega
pelo portfólio entender o produto, **testar** e chamar o Jhemison no WhatsApp.

## Objetivos
- Explicar em poucos segundos: o cliente agenda sozinho e o negócio recebe no WhatsApp.
- Deixar testar como cliente em 4 negócios de demonstração: barbearia, manicure, lash designer e salão de beleza.
- Levar para o WhatsApp do Jhemison (5573988045634).

## Fora do escopo
- Planos, preços e pagamento: quem fecha e cadastra o cliente é o Jhemison.
- Agendamento por robô ou IA no WhatsApp.
- O card no portfólio fica para depois, como um passo separado.

## Anti-objetivos (o que tornaria a página um fracasso)
- Parecer só o site de uma barbearia, e não um produto que serve para vários negócios.
- Dar trabalho de manutenção.

## Abordagens consideradas
- **A) Página curta de apresentação com demonstrações (ESCOLHIDA):** explica e deixa testar, com pouca manutenção.
- B) A raiz abriria direto uma demonstração: dá menos trabalho, mas não mostra que é um produto.
- C) Página de vendas com planos: não combina com o jeito de trabalhar (a venda é feita pelo Jhemison).

## Decisões do Jhemison
- Abordagem A, com mais de uma demonstração (barbearia, manicure, lash designer e salão de beleza).
- Nas demonstrações, o botão "Enviar no WhatsApp" manda para o WhatsApp do Jhemison.
- O nome/logo do produto é **Agendanov**.
- A marca do Jhemison agora é **NOVAA On** (substitui "JhemisonTech"). Neste projeto, nenhum texto
  pode dizer "JhemisonTech": onde a marca aparecer, deve aparecer "NOVAA On".

## Design
**`public/index.html` (página inicial)**
- Topo: logo Agendanov, título "Seu cliente agenda sozinho. Você recebe no WhatsApp."
  e o botão "Quero no meu negócio", que abre o WhatsApp do Jhemison com uma mensagem pronta.
- Vantagens (4 itens com ícones): site próprio do negócio, sem horário duplicado,
  painel simples (agenda, serviços, profissionais), folgas e bloqueios.
- "Experimente como cliente": 4 cards (Barbearia, Manicure, Lash Designer, Salão de beleza), cada um com a cor
  da demonstração, abrindo `/<slug-da-demo>`.
- "Como funciona" em 3 passos: você escolhe o serviço → escolhe o horário → a confirmação chega no WhatsApp.
- Rodapé com o botão do WhatsApp, o link "Acessar meu painel" (que existe hoje) e "feito por NOVAA On",
  com link para o portfólio (por enquanto https://jhemisontech.web.app).

**Demonstrações**
- 4 documentos em `negocios/`, com `demo: true`, `ativo: true`, `whatsapp` do Jhemison,
  cores próprias, de 4 a 6 serviços com preço e duração, de 1 a 2 profissionais fictícios e horário de funcionamento.
- O `negocio.html` mostra a faixa "Isto é uma demonstração. Agende à vontade." quando `demo: true`.
- O `/admin` ganha uma seção "Demonstrações" com o botão **"Criar/atualizar demonstrações"**:
  ele cria ou sobrescreve os 3 documentos. Não precisa de conta de dono, porque o super admin já
  gerencia qualquer negócio pelo `/painel?n=slug`.

## Decisões minhas (o Jhemison pode mudar)
- Visual igual ao do portfólio (branco, manchas azuis suaves), com animações reduzidas.
- Logo do Agendanov em forma de texto (ícone de calendário + "Agendanov"), sem imagem nova.
- Trocar "Agenda Fácil" por "Agendanov" nos títulos e no README.
- Botão **"Limpar agendamentos de teste"** no `/admin`: apaga `agendamentos` e `ocupados`
  das demonstrações, para a agenda não lotar com o tempo.
- Slugs: `demo-barbearia`, `demo-manicure`, `demo-lash`, `demo-salao`.

## Restrições
- HTML, CSS e JS puro com Firebase via CDN, sem etapa de build (igual ao restante do projeto).
- As regras do Firestore não mudam: o super admin já pode criar e apagar negócios e subcoleções.
- Deploy feito pelo Jhemison: `firebase deploy --project seuagendamentofacil --only hosting`.

## Fica a cargo de quem constrói
- Os textos exatos, os nomes fictícios e os serviços de cada demonstração.
- Os ícones e o layout para celular.
