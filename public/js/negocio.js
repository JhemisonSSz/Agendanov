import { db } from './firebase-config.js';
import {
  doc, getDoc, collection, getDocs, query, where, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import * as U from './utils.js';

const $ = id => document.getElementById(id);
const slug = U.obterSlug();

const estado = {
  negocio: null,
  servicos: [],
  profissionais: [],
  servico: null,
  profissional: null,
  data: U.hojeISO(),
  hora: null
};

iniciar();

async function iniciar() {
  try {
    if (!slug) return mostrarIndisponivel();

    const snap = await getDoc(doc(db, 'negocios', slug));
    if (!snap.exists() || snap.data().ativo !== true) return mostrarIndisponivel();
    estado.negocio = snap.data();

    // Serviços e profissionais ficam dentro do próprio documento do negócio:
    // a página inteira carrega com 1 leitura só.
    estado.servicos = paraLista(estado.negocio.servicos);
    estado.profissionais = paraLista(estado.negocio.profissionais);

    renderCabecalho();
    renderServicos();
    renderProfissionais();

    $('data').min = U.hojeISO();
    $('data').value = estado.data;
    $('data').addEventListener('change', e => {
      estado.data = e.target.value;
      estado.hora = null;
      carregarHorarios();
    });
    $('form-agendar').addEventListener('submit', agendar);

    // Com um profissional só, já deixa selecionado
    if (estado.profissionais.length === 1) selecionar('profissional', estado.profissionais[0].id);

    carregarHorarios();
    $('carregando').classList.add('oculto');
    $('app').classList.remove('oculto');
  } catch (err) {
    console.error(err);
    mostrarIndisponivel();
  }
}

function paraLista(lista) {
  return (lista || [])
    .filter(x => x.ativo !== false)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

function mostrarIndisponivel() {
  $('carregando').classList.add('oculto');
  $('indisponivel').classList.remove('oculto');
}

function renderCabecalho() {
  const n = estado.negocio;
  document.title = `${n.nome} | Agendamento online`;
  U.aplicarTema(n);
  $('faixa-demo').classList.toggle('oculto', n.demo !== true);
  $('nome').textContent = n.nome;
  $('endereco').textContent = n.endereco || '';
  if (n.logoUrl) {
    $('logo').src = n.logoUrl;
    $('logo').alt = `Logo ${n.nome}`;
    $('logo').classList.remove('oculto');
  }
  if (n.whatsapp) {
    $('whats-flutuante').href = U.linkWhats(n.whatsapp, U.mensagemContato(n));
    $('whats-flutuante').classList.remove('oculto');
  }
}

function renderServicos() {
  const box = $('lista-servicos');
  if (!estado.servicos.length) {
    box.innerHTML = '<p class="muted">Nenhum serviço disponível no momento.</p>';
    return;
  }
  box.innerHTML = estado.servicos.map(s => `
    <button type="button" class="opcao" data-id="${U.esc(s.id)}">
      <span><strong>${U.esc(s.nome)}</strong><br><span class="muted">${Number(s.duracao)} min</span></span>
      <strong>${U.moeda(s.preco)}</strong>
    </button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => selecionar('servico', b.dataset.id));
}

function renderProfissionais() {
  const box = $('lista-profissionais');
  if (!estado.profissionais.length) {
    box.innerHTML = '<p class="muted">Nenhum profissional disponível no momento.</p>';
    return;
  }
  box.innerHTML = estado.profissionais.map(p => `
    <button type="button" class="opcao" data-id="${U.esc(p.id)}">
      <strong>${U.esc(p.nome)}</strong>
    </button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => selecionar('profissional', b.dataset.id));
}

function selecionar(tipo, id) {
  const lista = tipo === 'servico' ? estado.servicos : estado.profissionais;
  estado[tipo] = lista.find(x => x.id === id);
  estado.hora = null;
  const box = $(tipo === 'servico' ? 'lista-servicos' : 'lista-profissionais');
  box.querySelectorAll('button').forEach(b => b.classList.toggle('selecionado', b.dataset.id === id));
  carregarHorarios();
}

let ultimaBusca = 0;
async function carregarHorarios() {
  const box = $('lista-horarios');
  const { servico, profissional, data } = estado;

  if (!servico || !profissional || !data) {
    box.innerHTML = '<p class="muted">Escolha o serviço e o profissional para ver os horários.</p>';
    atualizarResumo();
    return;
  }

  const busca = ++ultimaBusca;
  box.innerHTML = '<p class="muted">Buscando horários...</p>';
  atualizarResumo();

  try {
    const snap = await getDocs(query(
      collection(db, 'negocios', slug, 'ocupados'),
      where('data', '==', data),
      where('profissionalId', '==', profissional.id)
    ));
    if (busca !== ultimaBusca) return; // o usuário mudou a seleção no meio da busca

    const ocupados = new Set(snap.docs.map(d => d.data().hora));
    const livres = U.horariosDisponiveis(estado.negocio, data, servico.duracao, ocupados);

    if (!livres.length) {
      box.innerHTML = '<p class="muted">Nenhum horário livre neste dia. Tente outra data.</p>';
      return;
    }
    box.innerHTML = livres.map(h =>
      `<button type="button" class="horario" data-hora="${h}">${h}</button>`).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = () => {
      estado.hora = b.dataset.hora;
      box.querySelectorAll('button').forEach(x => x.classList.toggle('selecionado', x === b));
      atualizarResumo();
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = '<p class="erro">Não foi possível carregar os horários. Recarregue a página.</p>';
  }
}

function atualizarResumo() {
  const { servico, profissional, data, hora } = estado;
  const completo = servico && profissional && data && hora;
  $('btn-agendar').disabled = !completo;
  $('resumo').textContent = completo
    ? `${servico.nome} com ${profissional.nome}, ${U.formatarData(data)} às ${hora} (${U.moeda(servico.preco)})`
    : 'Escolha serviço, profissional e horário.';
}

async function agendar(e) {
  e.preventDefault();
  const nome = $('cliente-nome').value.trim();
  const telefone = $('cliente-telefone').value.trim();
  const { servico, profissional, data, hora } = estado;
  if (!nome || !telefone || !servico || !profissional || !hora) return;

  const btn = $('btn-agendar');
  btn.disabled = true;
  btn.textContent = 'Agendando...';
  $('erro-agendar').textContent = '';

  // Um serviço de 60 min com intervalo de 30 ocupa 2 horários
  const horas = U.blocoDeSlots(estado.negocio, hora, servico.duracao);
  const ids = horas.map(h => U.idSlot(profissional.id, data, h));
  const agendamentoId = ids[0];

  const batch = writeBatch(db);
  batch.set(doc(db, 'negocios', slug, 'agendamentos', agendamentoId), {
    data, hora,
    servicoId: servico.id, servicoNome: servico.nome,
    duracao: Number(servico.duracao), preco: Number(servico.preco) || 0,
    profissionalId: profissional.id, profissionalNome: profissional.nome,
    clienteNome: nome, clienteTelefone: telefone,
    slots: ids,
    status: 'confirmado',
    criadoEm: serverTimestamp()
  });
  horas.forEach((h, i) => {
    batch.set(doc(db, 'negocios', slug, 'ocupados', ids[i]), {
      data, hora: h, profissionalId: profissional.id, agendamentoId
    });
  });

  try {
    // Se alguém pegou o horário antes, as regras recusam o lote inteiro
    await batch.commit();
    mostrarSucesso(nome);
  } catch (err) {
    console.error(err);
    $('erro-agendar').textContent = 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.';
    estado.hora = null;
    carregarHorarios();
  } finally {
    btn.textContent = 'Confirmar agendamento';
  }
}

function mostrarSucesso(nome) {
  const { servico, profissional, data, hora, negocio } = estado;
  const texto = `${servico.nome} com ${profissional.nome} em ${U.formatarData(data)} às ${hora}.`;
  $('sucesso-texto').textContent = texto;

  if (negocio.whatsapp) {
    $('sucesso-whats').href = U.linkWhats(negocio.whatsapp, U.mensagemAgendado(negocio, nome, texto));
  } else {
    $('sucesso-whats').classList.add('oculto');
  }

  $('etapas').classList.add('oculto');
  $('sucesso').classList.remove('oculto');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
