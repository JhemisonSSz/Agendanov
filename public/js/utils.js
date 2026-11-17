// Funções puras compartilhadas entre site público, painel e admin.

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
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
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

// Todos os horários de início do dia, conforme o horário de funcionamento
export function gerarSlotsDoDia(negocio, dataISO) {
  const faixa = negocio.horarioFuncionamento?.[diaDaSemana(dataISO)];
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
export function horariosDisponiveis(negocio, dataISO, duracaoMin, ocupados, agora = new Date()) {
  const passo = Number(negocio.intervaloMinutos) || 30;
  const todos = gerarSlotsDoDia(negocio, dataISO);
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

export function aplicarTema(negocio) {
  const raiz = document.documentElement.style;
  if (negocio.cores?.primaria) raiz.setProperty('--cor-primaria', negocio.cores.primaria);
  if (negocio.cores?.secundaria) raiz.setProperty('--cor-secundaria', negocio.cores.secundaria);
}
