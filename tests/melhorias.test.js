// Testes das melhorias: profissional com horário e serviços próprios, limite de datas,
// telefone, mensagens de erro, troca de intervalo e calendário do cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as U from '../public/js/utils.js';

const negocio = {
  nome: 'Barbearia do Zé', endereco: 'Rua A, 10',
  intervaloMinutos: 30,
  horarioFuncionamento: { ...U.HORARIO_PADRAO }
};
const SEXTA = '2026-11-20'; // sexta-feira
const DE_MANHA = new Date(2026, 0, 1, 8, 0); // outro dia: não corta horários "que já passaram"

test('profissional sem horário próprio segue o horário do negócio', () => {
  const slots = U.gerarSlotsDoDia(negocio, SEXTA, { id: 'ana', nome: 'Ana' });
  assert.equal(slots[0], '09:00');
  assert.equal(slots.at(-1), '17:30');
});

test('profissional com horário próprio usa o dele (e folga onde não tem faixa)', () => {
  const bia = { id: 'bia', nome: 'Bia', horario: { ...U.HORARIO_PADRAO, sex: ['13:00', '15:00'], seg: null } };
  assert.deepEqual(U.gerarSlotsDoDia(negocio, SEXTA, bia), ['13:00', '13:30', '14:00', '14:30']);
  assert.deepEqual(U.gerarSlotsDoDia(negocio, '2026-11-16', bia), []); // segunda: folga dela
  assert.deepEqual(U.horariosDisponiveis(negocio, SEXTA, 60, new Set(['14:00']), DE_MANHA, bia), ['13:00']);
});

test('profissional faz todos os serviços quando não tem lista, ou só os marcados', () => {
  assert.equal(U.fazServico({ id: 'a' }, 'corte'), true);
  assert.equal(U.fazServico({ id: 'a', servicos: [] }, 'corte'), true);
  assert.equal(U.fazServico({ id: 'a', servicos: ['barba'] }, 'corte'), false);
  assert.equal(U.fazServico({ id: 'a', servicos: ['barba', 'corte'] }, 'corte'), true);
});

test('agenda aberta só até um limite de dias (padrão 60, configurável)', () => {
  assert.equal(U.dataMaxima({}, '2026-11-20'), '2027-01-19');
  assert.equal(U.dataMaxima({ diasAFrente: 30 }, '2026-11-20'), '2026-12-20');
});

test('telefone precisa ter DDD (10 a 13 números)', () => {
  for (const ok of ['(73) 98804-5634', '73988045634', '+55 73 98804-5634', '7332115634']) assert.equal(U.telefoneValido(ok), true, ok);
  for (const ruim of ['', '988045634', 'abc', '12345', '+55 73 98804-5634 99']) assert.equal(U.telefoneValido(ruim), false, ruim);
});

test('erro ao agendar: só diz "horário reservado" quando foi isso mesmo', () => {
  assert.match(U.mensagemErroAgendar({ code: 'permission-denied' }), /reservado por outra pessoa/);
  assert.match(U.mensagemErroAgendar({ code: 'unavailable' }), /internet/);
  assert.match(U.mensagemErroAgendar(new Error('x')), /internet/);
});

test('troca de intervalo: um horário da grade antiga ocupa os horários da grade nova que caem por cima', () => {
  // 1 hora -> 30 min: o agendamento das 14:00 (que ocupava 14:00-15:00) trava 14:00 e 14:30
  const grade30 = ['13:30', '14:00', '14:30', '15:00'];
  assert.deepEqual(U.slotsSobrepostos(grade30, 30, '14:00', 60), ['14:00', '14:30']);
  // 30 min -> 1 hora: o das 14:30 (14:30-15:00) trava o horário das 14:00 (14:00-15:00)
  const grade60 = ['13:00', '14:00', '15:00'];
  assert.deepEqual(U.slotsSobrepostos(grade60, 60, '14:30', 30), ['14:00']);
  // 30 -> 45: 14:00-14:30 encosta em 13:30-14:15 e 14:15-15:00
  assert.deepEqual(U.slotsSobrepostos(['13:30', '14:15', '15:00'], 45, '14:00', 30), ['13:30', '14:15']);
});

test('aviso de cancelamento cita o horário e manda o link para remarcar', () => {
  const ag = { clienteNome: 'Ana', servicoNome: 'Corte', data: SEXTA, hora: '14:30' };
  assert.equal(U.mensagemCancelamento(negocio, ag, 'https://seuagendamentofacil.web.app/barbearia-do-ze'),
    'Olá, Ana! Seu horário de Corte em 20/11/2026 às 14:30 na Barbearia do Zé foi cancelado.'
    + ' Se quiser, marque outro horário por aqui: https://seuagendamentofacil.web.app/barbearia-do-ze');
});

test('calendário: evento com início e fim certos, link do Google e arquivo .ics', () => {
  const ev = U.eventoAgendamento(negocio, { nome: 'Corte', duracao: 45 }, { nome: 'Ana' }, SEXTA, '14:30');
  assert.deepEqual(ev, {
    titulo: 'Corte - Barbearia do Zé', inicio: '20261120T143000', fim: '20261120T151500',
    local: 'Rua A, 10', detalhes: 'Corte com Ana.'
  });
  const link = U.linkGoogleAgenda(ev);
  assert.ok(link.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
  assert.ok(link.includes('&dates=20261120T143000/20261120T151500'));
  assert.ok(link.includes('&text=Corte%20-%20Barbearia%20do%20Z%C3%A9'));

  const ics = U.arquivoIcs(ev, new Date(Date.UTC(2026, 10, 18, 12, 0, 0)));
  assert.ok(ics.includes('\r\nDTSTART:20261120T143000\r\n'));
  assert.ok(ics.includes('\r\nDTEND:20261120T151500\r\n'));
  assert.ok(ics.includes('\r\nDTSTAMP:20261118T120000Z\r\n'));
  assert.ok(ics.includes('\r\nLOCATION:Rua A\\, 10\r\n'), 'vírgula escapada no .ics');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR'));
});
