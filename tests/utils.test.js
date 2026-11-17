import test from 'node:test';
import assert from 'node:assert/strict';
import { mensagemAgendado, mensagemContato } from '../public/js/utils.js';

test('mensagem de negócio real não muda', () => {
  assert.equal(
    mensagemAgendado({ nome: 'Barbearia do Zé' }, 'Ana', 'Corte em 20/11/2026 às 14:00.'),
    'Olá! Sou Ana e acabei de agendar pelo site: Corte em 20/11/2026 às 14:00.');
  assert.equal(mensagemContato({ nome: 'Barbearia do Zé' }), 'Olá! Vim pelo site da Barbearia do Zé.');
});

test('mensagem de demonstração avisa que é teste do Agendanov', () => {
  const n = { nome: 'Barbearia Exemplo', demo: true };
  assert.equal(
    mensagemAgendado(n, 'Ana', 'Corte em 20/11/2026 às 14:00.'),
    'Olá! Sou Ana e testei a demonstração do Agendanov (Barbearia Exemplo): Corte em 20/11/2026 às 14:00. Quero saber mais!');
  assert.equal(mensagemContato(n),
    'Olá! Vi a demonstração do Agendanov (Barbearia Exemplo) e quero saber mais.');
});
