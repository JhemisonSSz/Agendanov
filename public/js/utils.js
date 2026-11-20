// Funções puras compartilhadas entre site público, painel e admin.
import { SLUGS_DEMO } from './demos.js';

export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
export const NOMES_DIAS = {
  dom: 'Domingo', seg: 'Segunda', ter: 'Terça', qua: 'Quarta',
  qui: 'Quinta', sex: 'Sexta', sab: 'Sábado'
};

export const HORARIO_PADRAO = {
  dom: null,
  seg: ['09:00', '18:00'], ter: ['09:00', '18:00'], qua: ['09:00', '18:00'],
  qui: ['09:00', '18:00'], sex: ['09:00', '18:00'],
  sab: ['09:00', '13:00']
};

export const SLUGS_RESERVADOS = ['painel', 'admin', 'css', 'js', 'index', 'negocio'];

// Os endereços das demonstrações também são reservados: cliente real não pode usá-los
SLUGS_RESERVADOS.push(...SLUGS_DEMO);

// Descobre qual negócio abrir: /barbearia-do-ze  ou  negocio.html?n=barbearia-do-ze
export function obterSlug() {
  const params = new URLSearchParams(location.search);
  if (params.get('n')) return params.get('n');
  const parte = location.pathname.split('/').filter(Boolean)[0] || '';
  return decodeURIComponent(parte.replace(/\.html$/, ''));
}

// ID curto e único dentro de uma lista (usado em serviços e profissionais)
export function novoId(lista = []) {
  let id;
  do { id = Math.random().toString(36).slice(2, 10); } while (lista.some(i => i.id === id));
  return id;
}

export function slugify(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function slugValido(slug) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && !SLUGS_RESERVADOS.includes(slug);
}

export function paraMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function paraHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function hojeISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function diaDaSemana(dataISO) {
  const [a, m, d] = dataISO.split('-').map(Number);
  return DIAS[new Date(a, m - 1, d).getDay()];
}

// Todas as datas entre duas datas (inclusive): ["2026-12-24", "2026-12-25", ...]
export function datasEntre(inicioISO, fimISO) {
  const datas = [];
  const [a, m, d] = inicioISO.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  while (true) {
    const iso = isoLocal(dt);
    if (iso > fimISO) break;
    datas.push(iso);
    dt.setDate(dt.getDate() + 1);
  }
  return datas;
}

export function formatarData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// ID único de um horário: profissional + dia + hora  →  "ana_2026-11-20_1430"
export function idSlot(profissionalId, dataISO, hora) {
  return `${profissionalId}_${dataISO}_${hora.replace(':', '')}`;
}

const p2 = n => String(n).padStart(2, '0');

// Data local no formato "2026-11-20" (sem a conversão para UTC do toISOString)
export function isoLocal(dt) {
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
}

// Primeira data (hoje ou nos próximos dias) em que o serviço tem horário livre.
// A demonstração usa isso para nunca abrir num dia vazio (ex.: à noite).
// Se nada servir nos próximos `maxDias`, devolve hoje.
export function proximaDataComHorario(negocio, duracaoMin, agora = new Date(), maxDias = 14, profissional = null) {
  const d = new Date(agora);
  const hoje = hojeISO();
  for (let i = 0; i < maxDias; i++) {
    const dataISO = isoLocal(d);
    if (horariosDisponiveis(negocio, dataISO, duracaoMin, new Set(), agora, profissional).length) return dataISO;
    d.setDate(d.getDate() + 1);
  }
  return hoje;
}

// ---------- Profissionais ----------
// Cada profissional pode ter um horário próprio (mesmo formato do horário do negócio)
// e uma lista de serviços que faz. Sem horário próprio, segue o do negócio.
// Sem lista de serviços (ou lista vazia), faz todos.
export function faixaDoDia(negocio, dataISO, profissional = null) {
  const dia = diaDaSemana(dataISO);
  if (profissional?.horario) return profissional.horario[dia] || null;
  return negocio.horarioFuncionamento?.[dia] || null;
}

export function fazServico(profissional, servicoId) {
  const lista = profissional?.servicos;
  return !Array.isArray(lista) || lista.length === 0 || lista.includes(servicoId);
}

// ---------- Limites do agendamento ----------
export const DIAS_A_FRENTE_PADRAO = 60;

// Último dia que o cliente pode escolher (ex.: hoje + 60 dias)
export function dataMaxima(negocio, hoje = hojeISO()) {
  const dias = Number(negocio?.diasAFrente) || DIAS_A_FRENTE_PADRAO;
  const [a, m, d] = hoje.split('-').map(Number);
  return isoLocal(new Date(a, m - 1, d + dias));
}

// Telefone com DDD: de 10 a 13 números (aceita espaços, traços, parênteses e +55)
export function telefoneValido(texto) {
  const n = String(texto || '').replace(/\D/g, '');
  return n.length >= 10 && n.length <= 13;
}

// Mensagem certa para cada tipo de falha ao confirmar o agendamento
export function mensagemErroAgendar(err) {
  if (err?.code === 'permission-denied') {
    return 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.';
  }
  return 'Não foi possível confirmar o agendamento. Confira sua internet e tente de novo.';
}

// Todos os horários de início do dia, conforme o horário de funcionamento
// (ou o horário próprio do profissional, se ele tiver)
export function gerarSlotsDoDia(negocio, dataISO, profissional = null) {
  const faixa = faixaDoDia(negocio, dataISO, profissional);
  if (!faixa) return [];
  const [ini, fim] = faixa.map(paraMinutos);
  const passo = Number(negocio.intervaloMinutos) || 30;
  const slots = [];
  for (let t = ini; t + passo <= fim; t += passo) slots.push(paraHHMM(t));
  return slots;
}

export function slotsNecessarios(duracaoMin, intervaloMin) {
  return Math.max(1, Math.ceil(Number(duracaoMin) / Number(intervaloMin)));
}

// Horários em que o serviço cabe inteiro sem bater em nenhum ocupado
export function horariosDisponiveis(negocio, dataISO, duracaoMin, ocupados, agora = new Date(), profissional = null) {
  const passo = Number(negocio.intervaloMinutos) || 30;
  const todos = gerarSlotsDoDia(negocio, dataISO, profissional);
  const n = slotsNecessarios(duracaoMin, passo);
  const ehHoje = dataISO === hojeISO();
  const minAgora = agora.getHours() * 60 + agora.getMinutes();

  return todos.filter((hora, i) => {
    if (ehHoje && paraMinutos(hora) <= minAgora) return false;
    const bloco = todos.slice(i, i + n);
    if (bloco.length < n) return false; // não cabe antes de fechar
    return bloco.every(h => !ocupados.has(h));
  });
}

// Horários que um agendamento vai ocupar: ["14:00", "14:30"] para 60 min
export function blocoDeSlots(negocio, horaInicio, duracaoMin) {
  const passo = Number(negocio.intervaloMinutos) || 30;
  const n = slotsNecessarios(duracaoMin, passo);
  const ini = paraMinutos(horaInicio);
  return Array.from({ length: n }, (_, k) => paraHHMM(ini + k * passo));
}

// Horários da grade (de `passo` em `passo` minutos) que encostam no período [hora, hora + minutos).
// Usado quando o dono troca o intervalo: um horário ocupado na grade antiga
// também precisa ocupar os horários da grade nova que caem por cima dele.
export function slotsSobrepostos(grade, passo, hora, minutos) {
  const ini = paraMinutos(hora);
  const fim = ini + Number(minutos);
  return grade.filter(s => {
    const a = paraMinutos(s);
    return a < fim && a + Number(passo) > ini;
  });
}

// ---------- Calendário do cliente ----------
// "20261120T143000": data e hora locais (o calendário usa o fuso do aparelho)
function carimbo(dataISO, minutos) {
  const [a, m, d] = dataISO.split('-').map(Number);
  const dt = new Date(a, m - 1, d, 0, minutos);
  return `${dt.getFullYear()}${p2(dt.getMonth() + 1)}${p2(dt.getDate())}T${p2(dt.getHours())}${p2(dt.getMinutes())}00`;
}

export function eventoAgendamento(negocio, servico, profissional, dataISO, hora) {
  const ini = paraMinutos(hora);
  return {
    titulo: `${servico.nome} - ${negocio.nome}`,
    inicio: carimbo(dataISO, ini),
    fim: carimbo(dataISO, ini + (Number(servico.duracao) || 30)),
    local: negocio.endereco || '',
    detalhes: `${servico.nome} com ${profissional.nome}.`
  };
}

export function linkGoogleAgenda(ev) {
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(ev.titulo)}`
    + `&dates=${ev.inicio}/${ev.fim}`
    + `&details=${encodeURIComponent(ev.detalhes)}`
    + `&location=${encodeURIComponent(ev.local)}`;
}

// Arquivo .ics: abre no calendário do iPhone, Outlook e outros
export function arquivoIcs(ev, agora = new Date()) {
  const texto = s => String(s).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  const carimboUtc = agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agendanov//PT-BR', 'BEGIN:VEVENT',
    `UID:${ev.inicio}-${carimboUtc}@agendanov`,
    `DTSTAMP:${carimboUtc}`,
    `DTSTART:${ev.inicio}`,
    `DTEND:${ev.fim}`,
    `SUMMARY:${texto(ev.titulo)}`,
    `LOCATION:${texto(ev.local)}`,
    `DESCRIPTION:${texto(ev.detalhes)}`,
    'END:VEVENT', 'END:VCALENDAR', ''
  ].join('\r\n');
}

export function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Sempre use ao colocar texto do banco dentro de innerHTML
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function linkWhats(numero, texto = '') {
  let n = String(numero || '').replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) n = '55' + n; // número brasileiro sem DDI
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

// Mensagem que o cliente manda ao negócio logo depois de agendar
export function mensagemAgendado(negocio, nomeCliente, texto) {
  if (negocio.demo) {
    return `Olá! Sou ${nomeCliente} e testei a demonstração do Agendanov (${negocio.nome}): ${texto} Quero saber mais!`;
  }
  return `Olá! Sou ${nomeCliente} e acabei de agendar pelo site: ${texto}`;
}

// Mensagem que o dono manda ao cliente depois de cancelar um horário
export function mensagemCancelamento(negocio, ag, linkSite) {
  return `Olá, ${ag.clienteNome}! Seu horário de ${ag.servicoNome} em ${formatarData(ag.data)} às ${ag.hora} na ${negocio.nome} foi cancelado.`
    + ` Se quiser, marque outro horário por aqui: ${linkSite}`;
}

// Mensagem do botão flutuante de WhatsApp
export function mensagemContato(negocio) {
  if (negocio.demo) {
    return `Olá! Vi a demonstração do Agendanov (${negocio.nome}) e quero saber mais.`;
  }
  return `Olá! Vim pelo site da ${negocio.nome}.`;
}

export function aplicarTema(negocio) {
  const raiz = document.documentElement.style;
  if (negocio.cores?.primaria) raiz.setProperty('--cor-primaria', negocio.cores.primaria);
  if (negocio.cores?.secundaria) raiz.setProperty('--cor-secundaria', negocio.cores.secundaria);
}
