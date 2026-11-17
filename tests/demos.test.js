import test from 'node:test';
import assert from 'node:assert/strict';
import { documentosDemo, SLUGS_DEMO, WHATS_NOVAA, podeGravarDemo } from '../public/js/demos.js';
import { slugValido, DIAS, horariosDisponiveis, hojeISO, proximaDataComHorario } from '../public/js/utils.js';

test('clientes reais não podem usar o endereço de uma demonstração', () => {
  SLUGS_DEMO.forEach(s => assert.equal(slugValido(s), false, s));
  assert.equal(slugValido('barbearia-do-ze'), true);
});

test('só grava ou limpa uma demonstração se o endereço está livre ou já é demo', () => {
  assert.equal(podeGravarDemo(null), true);
  assert.equal(podeGravarDemo({ demo: true, nome: 'Barbearia Exemplo' }), true);
  assert.equal(podeGravarDemo({ nome: 'Salão da Maria', donoUid: 'abc' }), false);
  assert.equal(podeGravarDemo({ demo: false }), false);
});

test('de noite, a demonstração abre no próximo dia que tem horário', () => {
  const hoje = hojeISO();
  const [a, m, d] = hoje.split('-').map(Number);
  const meiaNoite = new Date(a, m - 1, d, 23, 0);
  const { dados } = documentosDemo()[0];
  const data = proximaDataComHorario(dados, 30, meiaNoite);
  assert.ok(data > hoje, `esperava depois de ${hoje}, veio ${data}`);
  assert.ok(horariosDisponiveis(dados, data, 30, new Set(), meiaNoite).length > 0);
});

test('de manhã, a demonstração abre hoje mesmo', () => {
  const hoje = hojeISO();
  const [a, m, d] = hoje.split('-').map(Number);
  const manha = new Date(a, m - 1, d, 6, 0);
  assert.equal(proximaDataComHorario(documentosDemo()[0].dados, 30, manha), hoje);
});

test('sem nenhum horário nos próximos dias, volta para hoje', () => {
  const fechado = { intervaloMinutos: 30, horarioFuncionamento: {} };
  assert.equal(proximaDataComHorario(fechado, 30, new Date()), hojeISO());
});

test('4 demonstrações com os slugs combinados', () => {
  assert.deepEqual(documentosDemo().map(d => d.slug), SLUGS_DEMO);
  assert.deepEqual(SLUGS_DEMO, ['demo-barbearia', 'demo-manicure', 'demo-lash', 'demo-salao']);
  SLUGS_DEMO.forEach(s => assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/)); // formato de endereço válido
});

test('cada demonstração está ativa, marcada como demo e com o WhatsApp do Jhemison', () => {
  for (const { dados } of documentosDemo()) {
    assert.equal(dados.ativo, true);
    assert.equal(dados.demo, true);
    assert.equal(dados.whatsapp, WHATS_NOVAA);
  }
  assert.equal(WHATS_NOVAA, '5573988045634');
});

test('serviços e profissionais válidos e com IDs únicos', () => {
  for (const { dados } of documentosDemo()) {
    assert.ok(dados.servicos.length >= 4 && dados.servicos.length <= 6);
    assert.ok(dados.profissionais.length >= 1 && dados.profissionais.length <= 2);
    for (const s of dados.servicos) assert.ok(s.nome && s.duracao > 0 && s.preco > 0);
    const ids = [...dados.servicos, ...dados.profissionais].map(x => x.id);
    assert.equal(new Set(ids).size, ids.length);
    ids.forEach(id => assert.match(id, /^[a-z0-9]+$/));
  }
});

test('abre todos os dias, então sempre há horário em qualquer dia da semana', () => {
  for (const { dados } of documentosDemo()) {
    DIAS.forEach(d => assert.ok(Array.isArray(dados.horarioFuncionamento[d]), d));
    // 2030-01-06 é um domingo, o dia mais curto
    const livres = horariosDisponiveis(dados, '2030-01-06', dados.servicos[0].duracao, new Set());
    assert.ok(livres.length > 0);
  }
});

test('documentosDemo devolve cópias novas a cada chamada', () => {
  const a = documentosDemo();
  a[0].dados.nome = 'x';
  assert.notEqual(documentosDemo()[0].dados.nome, 'x');
});
