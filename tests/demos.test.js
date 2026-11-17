import test from 'node:test';
import assert from 'node:assert/strict';
import { documentosDemo, SLUGS_DEMO, WHATS_NOVAA } from '../public/js/demos.js';
import { slugValido, DIAS, horariosDisponiveis } from '../public/js/utils.js';

test('4 demonstrações com os slugs combinados', () => {
  assert.deepEqual(documentosDemo().map(d => d.slug), SLUGS_DEMO);
  assert.deepEqual(SLUGS_DEMO, ['demo-barbearia', 'demo-manicure', 'demo-lash', 'demo-salao']);
  SLUGS_DEMO.forEach(s => assert.ok(slugValido(s)));
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
