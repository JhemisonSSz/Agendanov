import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SLUGS_DEMO, WHATS_NOVAA } from '../public/js/demos.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const semHref = html.replace(/href="[^"]*"/g, '');

test('marca: Agendanov e NOVAA On, sem nomes antigos nos textos', () => {
  assert.doesNotMatch(semHref, /jhemisontech/i);
  assert.doesNotMatch(semHref, /agenda f[aá]cil/i);
  assert.match(html, /Agendanov/);
  assert.match(html, /NOVAA On/);
});

test('título e chamadas combinados', () => {
  const texto = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' '); // só o que o visitante lê
  assert.match(texto, /Seu cliente agenda sozinho\. Você recebe no WhatsApp\./);
  assert.match(texto, /Quero no meu negócio/);
  assert.match(texto, /Experimente como cliente/);
});

test('links para as 4 demonstrações, o WhatsApp do Jhemison e o painel', () => {
  for (const s of SLUGS_DEMO) assert.match(html, new RegExp(`href="/${s}"`));
  assert.match(html, new RegExp(`https://wa\\.me/${WHATS_NOVAA}\\?text=`));
  assert.match(html, /href="\/painel"/);
});

test('página adaptada ao celular e com descrição para buscadores', () => {
  assert.match(html, /name="viewport"/);
  assert.match(html, /name="description"/);
});

test('animações desligam para quem pede movimento reduzido', () => {
  const css = readFileSync(new URL('../public/css/inicio.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce/);
});
