import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc, writeBatch,
  setDoc, serverTimestamp, onSnapshot, arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import * as U from './utils.js';

const $ = id => document.getElementById(id);
let negocioId = null;
let negocio = null;

// ---------- Login ----------
$('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  $('erro-login').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, $('email').value.trim(), $('senha').value);
  } catch {
    $('erro-login').textContent = 'E-mail ou senha inválidos.';
  }
});

$('btn-esqueci').onclick = async () => {
  const email = $('email').value.trim();
  if (!email) return ($('erro-login').textContent = 'Digite seu e-mail acima primeiro.');
  try {
    await sendPasswordResetEmail(auth, email);
    $('erro-login').textContent = 'Enviamos um link para redefinir sua senha.';
  } catch {
    $('erro-login').textContent = 'Não foi possível enviar o e-mail.';
  }
};

$('btn-sair').onclick = () => { pararAgenda(); signOut(auth); };

onAuthStateChanged(auth, async user => {
  if (!user) return mostrarTela('tela-login');
  try {
    const perfilSnap = await getDoc(doc(db, 'usuarios', user.uid));
    if (!perfilSnap.exists()) throw new Error('Usuário sem perfil');
    const perfil = perfilSnap.data();

    // O super admin pode abrir o painel de qualquer negócio: /painel/?n=slug
    negocioId = perfil.papel === 'superadmin'
      ? new URLSearchParams(location.search).get('n')
      : perfil.negocioId;
    if (!negocioId) throw new Error('Nenhum negócio vinculado');

    await carregarNegocio();
    mostrarTela('tela-painel');
    abrirAba('agenda');
  } catch (err) {
    console.error(err);
    await signOut(auth);
    $('erro-login').textContent = 'Sua conta não tem acesso a um painel.';
  }
});

function mostrarTela(id) {
  ['tela-login', 'tela-painel'].forEach(t => $(t).classList.toggle('oculto', t !== id));
}

async function carregarNegocio() {
  const snap = await getDoc(doc(db, 'negocios', negocioId));
  if (!snap.exists()) throw new Error('Negócio não encontrado');
  negocio = snap.data();
  U.aplicarTema(negocio);
  document.title = `Painel | ${negocio.nome}`;
  $('painel-nome').textContent = negocio.nome;
  $('link-site').href = `/${negocioId}`;
  $('aviso-inativo').classList.toggle('oculto', negocio.ativo === true);
}

// ---------- Abas ----------
document.querySelectorAll('.aba').forEach(b => b.onclick = () => abrirAba(b.dataset.aba));

function abrirAba(nome) {
  document.querySelectorAll('.aba').forEach(b => b.classList.toggle('ativa', b.dataset.aba === nome));
  document.querySelectorAll('.aba-conteudo').forEach(s => s.classList.toggle('oculto', s.id !== `aba-${nome}`));
  if (nome === 'agenda') carregarAgenda();
  else pararAgenda(); // fora da aba Agenda, para de escutar o banco
  if (nome === 'bloqueios') abrirBloqueios();
  if (nome === 'servicos') crudServicos.carregar();
  if (nome === 'profissionais') { prepararFormProfissional(); crudProfissionais.carregar(); }
  if (nome === 'config') preencherConfig();
}

// ---------- Agenda ----------
// A lista se atualiza sozinha: quando um cliente agenda, o horário aparece sem recarregar.
// Cancelados ficam no histórico (coleção "cancelados") e aparecem apagados na lista.
$('agenda-data').value = U.hojeISO();
$('agenda-data').addEventListener('change', carregarAgenda);

let pararAgenda = () => {};
let ativos = [];
let cancelados = [];

function carregarAgenda() {
  pararAgenda();
  const data = $('agenda-data').value;
  $('lista-agenda').innerHTML = '<p class="muted">Carregando...</p>';
  $('agenda-resumo').textContent = '';
  ativos = [];
  cancelados = [];

  const pronto = { ativos: false, cancelados: false };
  const ouvir = (colecao, chave) => onSnapshot(
    query(collection(db, 'negocios', negocioId, colecao), where('data', '==', data)),
    snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (chave === 'ativos') ativos = lista; else cancelados = lista;
      pronto[chave] = true;
      if (pronto.ativos && pronto.cancelados) renderAgenda(data);
    },
    err => {
      console.error(err);
      $('lista-agenda').innerHTML = '<p class="erro">Não foi possível carregar a agenda. Recarregue a página.</p>';
    }
  );
  const pararAtivos = ouvir('agendamentos', 'ativos');
  const pararCancelados = ouvir('cancelados', 'cancelados');
  pararAgenda = () => { pararAtivos(); pararCancelados(); pararAgenda = () => {}; };
}

function renderAgenda(data) {
  const box = $('lista-agenda');
  const itens = [
    ...ativos.map(a => ({ a, cancelado: false })),
    ...cancelados.map(a => ({ a, cancelado: true }))
  ].sort((x, y) => x.a.hora.localeCompare(y.a.hora)
    || Number(x.cancelado) - Number(y.cancelado)
    || String(x.a.profissionalNome).localeCompare(String(y.a.profissionalNome)));

  if (!itens.length) {
    $('agenda-resumo').textContent = '';
    box.innerHTML = '<p class="muted">Nenhum agendamento neste dia.</p>';
    return;
  }

  const total = ativos.reduce((soma, a) => soma + (Number(a.preco) || 0), 0);
  $('agenda-resumo').textContent =
    `${ativos.length} agendamento(s) em ${U.formatarData(data)} · previsto ${U.moeda(total)}`
    + (cancelados.length ? ` · ${cancelados.length} cancelado(s)` : '');

  const linkSite = `${location.origin}/${negocioId}`;
  box.innerHTML = itens.map(({ a, cancelado }) => cancelado ? `
    <div class="item item-cancelado">
      <div class="item-hora">${U.esc(a.hora)}</div>
      <div class="item-info">
        <strong>${U.esc(a.clienteNome)} <span class="selo selo-off">cancelado</span></strong>
        <span class="muted">${U.esc(a.servicoNome)} · ${U.esc(a.profissionalNome)}</span>
      </div>
      <div class="item-acoes">
        <a class="btn btn-whats btn-pequeno" target="_blank" rel="noopener"
           href="${U.esc(U.linkWhats(a.clienteTelefone, U.mensagemCancelamento(negocio, a, linkSite)))}">Avisar cliente</a>
      </div>
    </div>` : `
    <div class="item">
      <div class="item-hora">${U.esc(a.hora)}</div>
      <div class="item-info">
        <strong>${U.esc(a.clienteNome)}</strong>
        <span class="muted">${U.esc(a.servicoNome)} · ${U.esc(a.profissionalNome)} · ${Number(a.duracao)} min · ${U.moeda(a.preco)}</span>
      </div>
      <div class="item-acoes">
        <a class="btn btn-whats btn-pequeno" target="_blank" rel="noopener"
           href="${U.esc(U.linkWhats(a.clienteTelefone,
             `Olá, ${a.clienteNome}! Passando para lembrar do seu horário de ${a.servicoNome} em ${U.formatarData(a.data)} às ${a.hora} na ${negocio.nome}.`))}">WhatsApp</a>
        <button class="btn btn-perigo btn-pequeno" type="button" data-cancelar="${U.esc(a.id)}">Cancelar</button>
      </div>
    </div>`).join('');

  box.querySelectorAll('[data-cancelar]').forEach(b => {
    b.onclick = () => cancelarAgendamento(ativos.find(i => i.id === b.dataset.cancelar), b);
  });
}

// Guarda o agendamento no histórico de cancelados, apaga o original e libera os horários.
// (O original precisa sair: o ID dele é o horário, e outro cliente pode querer marcar ali.)
async function cancelarAgendamento(a, botao) {
  if (!a) return;
  if (!confirm(`Cancelar o horário de ${a.clienteNome} às ${a.hora}? O horário volta a ficar livre e depois você pode avisar o cliente pelo WhatsApp.`)) return;
  botao.disabled = true;
  try {
    const { id, ...dados } = a;
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'negocios', negocioId, 'cancelados')), {
      ...dados, agendamentoId: id, status: 'cancelado', canceladoEm: serverTimestamp()
    });
    batch.delete(doc(db, 'negocios', negocioId, 'agendamentos', id));
    (a.slots || [id]).forEach(s => batch.delete(doc(db, 'negocios', negocioId, 'ocupados', s)));
    await batch.commit(); // a lista se atualiza sozinha
  } catch (err) {
    console.error(err);
    botao.disabled = false;
    alert('Não foi possível cancelar. Tente de novo.');
  }
}

// ---------- Folgas e bloqueios ----------
// Um bloqueio é um documento em "bloqueios" (pra listar e remover) +
// um documento em "ocupados" pra cada horário travado, com bloqueioId.
// O site público já esconde tudo que está em "ocupados", então não muda nada lá.
const formB = $('form-bloqueio');

formB.elements.diaInteiro.addEventListener('change', e => {
  $('bloqueio-horas').classList.toggle('oculto', e.target.checked);
});
formB.elements.dataInicio.addEventListener('change', e => {
  const fim = formB.elements.dataFim;
  if (!fim.value || fim.value < e.target.value) fim.value = e.target.value;
});

function listarProfissionais() {
  return [...(negocio.profissionais || [])]
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

async function abrirBloqueios() {
  const el = formB.elements;
  const profs = listarProfissionais();
  el.profissional.innerHTML = '<option value="todos">Todos os profissionais</option>' +
    profs.map(p => `<option value="${U.esc(p.id)}">${U.esc(p.nome)}</option>`).join('');
  el.dataInicio.min = el.dataFim.min = U.hojeISO();
  if (!el.dataInicio.value) el.dataInicio.value = el.dataFim.value = U.hojeISO();
  $('bloqueio-msg').textContent = '';
  carregarBloqueios();
}

// O Firestore aceita até 500 operações por lote; dividimos em pedaços
async function gravarEmLotes(operacoes) {
  for (let i = 0; i < operacoes.length; i += 450) {
    const batch = writeBatch(db);
    operacoes.slice(i, i + 450).forEach(op => op(batch));
    await batch.commit();
  }
}

async function removerOcupadosDoBloqueio(bloqueioId) {
  const snap = await getDocs(query(
    collection(db, 'negocios', negocioId, 'ocupados'),
    where('bloqueioId', '==', bloqueioId)
  ));
  await gravarEmLotes(snap.docs.map(d => b => b.delete(d.ref)));
}

formB.addEventListener('submit', async e => {
  e.preventDefault();
  const el = formB.elements;
  const msg = $('bloqueio-msg');
  const btn = formB.querySelector('button[type="submit"]');

  const dataInicio = el.dataInicio.value;
  const dataFim = el.dataFim.value;
  const diaInteiro = el.diaInteiro.checked;
  const horaInicio = diaInteiro ? '00:00' : el.horaInicio.value;
  const horaFim = diaInteiro ? '23:59' : el.horaFim.value;

  if (dataFim < dataInicio) return (msg.textContent = 'A data final é antes da inicial.');
  if (!diaInteiro && (!horaInicio || !horaFim || horaInicio >= horaFim)) {
    return (msg.textContent = 'Confira o horário: o início precisa ser antes do fim.');
  }
  const datas = U.datasEntre(dataInicio, dataFim);
  if (datas.length > 62) return (msg.textContent = 'Bloqueie no máximo 2 meses por vez.');

  btn.disabled = true;
  msg.textContent = 'Bloqueando...';
  const ref = doc(collection(db, 'negocios', negocioId, 'bloqueios')); // ID automático

  try {
    const profs = listarProfissionais();
    const alvo = el.profissional.value === 'todos'
      ? profs
      : profs.filter(p => p.id === el.profissional.value);
    if (!alvo.length) {
      msg.textContent = 'Cadastre um profissional antes de bloquear horários.';
      return;
    }

    // Monta a lista de horários a travar, pulando os que já estão ocupados
    const novos = [];
    let pulados = 0;
    for (const data of datas) {
      const snap = await getDocs(query(
        collection(db, 'negocios', negocioId, 'ocupados'),
        where('data', '==', data)
      ));
      const jaOcupados = new Set(snap.docs.map(d => d.id));

      for (const p of alvo) {
        // Cada profissional pode ter horário próprio
        const horas = U.gerarSlotsDoDia(negocio, data, p).filter(h => h >= horaInicio && h < horaFim);
        for (const hora of horas) {
          const id = U.idSlot(p.id, data, hora);
          if (jaOcupados.has(id)) { pulados++; continue; }
          novos.push({ id, data, hora, profissionalId: p.id });
        }
      }
    }

    if (!novos.length) {
      msg.textContent = 'Não há horários livres nesse período (o negócio está fechado ou já está tudo ocupado).';
      return;
    }

    await setDoc(ref, {
      dataInicio, dataFim, diaInteiro,
      horaInicio: diaInteiro ? null : horaInicio,
      horaFim: diaInteiro ? null : horaFim,
      profissionalId: el.profissional.value,
      profissionalNome: el.profissional.value === 'todos' ? 'Todos' : alvo[0].nome,
      motivo: el.motivo.value.trim(),
      totalHorarios: novos.length,
      criadoEm: serverTimestamp()
    });

    await gravarEmLotes(novos.map(n => b => b.set(
      doc(db, 'negocios', negocioId, 'ocupados', n.id),
      { data: n.data, hora: n.hora, profissionalId: n.profissionalId, bloqueioId: ref.id }
    )));

    msg.textContent = `${novos.length} horário(s) bloqueado(s).` +
      (pulados ? ` ${pulados} já estavam ocupados (agendamento ou outro bloqueio) e foram mantidos.` : '');
    el.motivo.value = '';
    carregarBloqueios();
  } catch (err) {
    // Ex.: um cliente agendou no meio do processo. Desfaz o que foi gravado.
    console.error(err);
    await removerOcupadosDoBloqueio(ref.id).catch(() => {});
    await deleteDoc(ref).catch(() => {});
    msg.textContent = 'Não foi possível bloquear (alguém pode ter agendado agora). Tente de novo.';
  } finally {
    btn.disabled = false;
  }
});

// Um profissional cadastrado depois também entra nas folgas marcadas para "Todos os profissionais"
async function aplicarBloqueiosDeTodos(prof) {
  const hoje = U.hojeISO();
  const snap = await getDocs(query(
    collection(db, 'negocios', negocioId, 'bloqueios'),
    where('dataFim', '>=', hoje)
  ));
  const operacoes = [];
  for (const d of snap.docs) {
    const b = d.data();
    if (b.profissionalId !== 'todos') continue;
    for (const data of U.datasEntre(b.dataInicio < hoje ? hoje : b.dataInicio, b.dataFim)) {
      const horas = U.gerarSlotsDoDia(negocio, data, prof)
        .filter(h => b.diaInteiro || (h >= b.horaInicio && h < b.horaFim));
      for (const hora of horas) {
        operacoes.push(batch => batch.set(
          doc(db, 'negocios', negocioId, 'ocupados', U.idSlot(prof.id, data, hora)),
          { data, hora, profissionalId: prof.id, bloqueioId: d.id }
        ));
      }
    }
  }
  await gravarEmLotes(operacoes);
}

async function carregarBloqueios() {
  const box = $('lista-bloqueios');
  box.innerHTML = '<p class="muted">Carregando...</p>';

  const snap = await getDocs(query(
    collection(db, 'negocios', negocioId, 'bloqueios'),
    where('dataFim', '>=', U.hojeISO())
  ));
  const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));

  if (!itens.length) {
    box.innerHTML = '<p class="muted">Nenhum bloqueio futuro.</p>';
    return;
  }

  box.innerHTML = itens.map(b => {
    const periodo = b.dataInicio === b.dataFim
      ? U.formatarData(b.dataInicio)
      : `${U.formatarData(b.dataInicio)} a ${U.formatarData(b.dataFim)}`;
    const horario = b.diaInteiro ? 'dia inteiro' : `${b.horaInicio} às ${b.horaFim}`;
    return `
      <div class="item">
        <div class="item-info">
          <strong>${U.esc(periodo)} · ${U.esc(horario)}</strong>
          <span class="muted">${U.esc(b.profissionalNome)}${b.motivo ? ' · ' + U.esc(b.motivo) : ''} · ${Number(b.totalHorarios)} horário(s)</span>
        </div>
        <div class="item-acoes">
          <button class="btn btn-perigo btn-pequeno" type="button" data-remover-bloqueio="${U.esc(b.id)}">Remover</button>
        </div>
      </div>`;
  }).join('');

  box.querySelectorAll('[data-remover-bloqueio]').forEach(btn => btn.onclick = async () => {
    if (!confirm('Remover este bloqueio? Os horários voltam a aparecer no site.')) return;
    btn.disabled = true;
    // Apaga só os "ocupados" deste bloqueio. Agendamentos de clientes nunca são tocados.
    await removerOcupadosDoBloqueio(btn.dataset.removerBloqueio);
    await deleteDoc(doc(db, 'negocios', negocioId, 'bloqueios', btn.dataset.removerBloqueio));
    carregarBloqueios();
  });
}

// ---------- CRUD genérico (serviços e profissionais) ----------
// Os itens ficam num array dentro do documento do negócio (negocio.servicos,
// negocio.profissionais). Isso economiza leituras: o site público carrega tudo de uma vez.
// Erro de preenchimento: a mensagem aparece para o dono como está
class ErroDoFormulario extends Error {}

function criarCrud({ campo, formId, listaId, lerForm, preencherForm, renderLinha, aoAdicionar }) {
  const form = $(formId);
  const btnSalvar = form.querySelector('button[type="submit"]');
  const btnCancelar = form.querySelector('[data-cancelar-edicao]');
  let editando = null;

  // Lê a versão mais recente antes de alterar, pra não sobrescrever outra edição
  async function salvarLista(transformar) {
    const ref = doc(db, 'negocios', negocioId);
    const atual = (await getDoc(ref)).data()?.[campo] || [];
    const nova = transformar(atual);
    await updateDoc(ref, { [campo]: nova });
    negocio[campo] = nova;
  }

  function sairDaEdicao() {
    editando = null;
    form.reset();
    btnSalvar.textContent = 'Adicionar';
    btnCancelar.classList.add('oculto');
  }

  btnCancelar.onclick = sairDaEdicao;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    btnSalvar.disabled = true;
    try {
      const dados = lerForm(form.elements);
      if (editando) {
        const id = editando;
        await salvarLista(lista => lista.map(i => (i.id === id ? { ...i, ...dados } : i)));
      } else {
        let novo;
        await salvarLista(lista => {
          novo = { id: U.novoId(lista), ...dados, ativo: true };
          return [...lista, novo];
        });
        if (aoAdicionar) await aoAdicionar(novo);
      }
      sairDaEdicao();
      carregar();
    } catch (err) {
      console.error(err);
      alert(err instanceof ErroDoFormulario ? err.message : 'Não foi possível salvar. Tente novamente.');
    } finally {
      btnSalvar.disabled = false;
    }
  });

  function carregar() {
    const box = $(listaId);
    const itens = [...(negocio[campo] || [])]
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

    box.innerHTML = itens.length ? itens.map(i => `
      <div class="item">
        <div class="item-info">${renderLinha(i)}</div>
        <div class="item-acoes">
          <button class="btn btn-sec btn-pequeno" type="button" data-pausar="${U.esc(i.id)}">
            ${i.ativo === false ? 'Mostrar no site' : 'Ocultar do site'}</button>
          <button class="btn btn-sec btn-pequeno" type="button" data-editar="${U.esc(i.id)}">Editar</button>
          <button class="btn btn-perigo btn-pequeno" type="button" data-remover="${U.esc(i.id)}">Remover</button>
        </div>
      </div>`).join('') : '<p class="muted">Nada cadastrado ainda.</p>';

    box.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => {
      const item = itens.find(i => i.id === b.dataset.editar);
      editando = item.id;
      preencherForm(form.elements, item);
      btnSalvar.textContent = 'Salvar alterações';
      btnCancelar.classList.remove('oculto');
      form.scrollIntoView({ behavior: 'smooth' });
    });
    box.querySelectorAll('[data-pausar]').forEach(b => b.onclick = async () => {
      const id = b.dataset.pausar;
      await salvarLista(lista => lista.map(i => (i.id === id ? { ...i, ativo: i.ativo === false } : i)));
      carregar();
    });
    box.querySelectorAll('[data-remover]').forEach(b => b.onclick = async () => {
      const item = itens.find(i => i.id === b.dataset.remover);
      if (!confirm(`Remover "${item.nome}"? Agendamentos já feitos não são apagados.`)) return;
      await salvarLista(lista => lista.filter(i => i.id !== item.id));
      carregar();
    });
  }

  return { carregar };
}

const crudServicos = criarCrud({
  campo: 'servicos',
  formId: 'form-servico',
  listaId: 'lista-servicos',
  lerForm: el => ({
    nome: el.nome.value.trim(),
    duracao: Number(el.duracao.value),
    preco: Number(el.preco.value)
  }),
  preencherForm: (el, i) => {
    el.nome.value = i.nome;
    el.duracao.value = i.duracao;
    el.preco.value = i.preco;
  },
  renderLinha: i => `
    <strong>${U.esc(i.nome)} ${i.ativo === false ? '<span class="selo selo-off">oculto</span>' : ''}</strong>
    <span class="muted">${Number(i.duracao)} min · ${U.moeda(i.preco)}</span>`
});

// ---------- Dias da semana (usado no horário do negócio e no horário próprio do profissional) ----------
function renderDias(containerId, horario) {
  $(containerId).innerHTML = U.DIAS.map(d => {
    const faixa = horario?.[d];
    return `
      <div class="dia" data-dia="${d}">
        <label><input type="checkbox" data-aberto ${faixa ? 'checked' : ''}> ${U.NOMES_DIAS[d]}</label>
        <input type="time" data-abre value="${faixa?.[0] || '09:00'}" aria-label="Abre às">
        <input type="time" data-fecha value="${faixa?.[1] || '18:00'}" aria-label="Fecha às">
      </div>`;
  }).join('');
}

// Lê os dias da tela: { horario, erro }
function lerDias(containerId) {
  const horario = {};
  let erro = '';
  $(containerId).querySelectorAll('.dia').forEach(linha => {
    const aberto = linha.querySelector('[data-aberto]').checked;
    const abre = linha.querySelector('[data-abre]').value;
    const fecha = linha.querySelector('[data-fecha]').value;
    if (aberto && (!abre || !fecha || abre >= fecha)) erro = `Confira o horário de ${U.NOMES_DIAS[linha.dataset.dia]}.`;
    horario[linha.dataset.dia] = aberto ? [abre, fecha] : null;
  });
  return { horario, erro };
}

// ---------- Profissionais: serviços que faz e horário próprio ----------
const formProf = $('form-profissional');

function prepararFormProfissional(item = null) {
  const marcados = new Set(item?.servicos || []);
  const servicos = [...(negocio.servicos || [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  $('prof-servicos').innerHTML = servicos.length
    ? servicos.map(s => `
      <label class="check"><input type="checkbox" value="${U.esc(s.id)}" ${marcados.has(s.id) ? 'checked' : ''}> ${U.esc(s.nome)}</label>`).join('')
    : '<p class="muted">Cadastre os serviços primeiro.</p>';
  formProf.elements.horarioProprio.checked = Boolean(item?.horario);
  renderDias('prof-dias', item?.horario || negocio.horarioFuncionamento || U.HORARIO_PADRAO);
  $('prof-dias').classList.toggle('oculto', !item?.horario);
}

formProf.elements.horarioProprio.addEventListener('change', e => {
  $('prof-dias').classList.toggle('oculto', !e.target.checked);
});
// "Cancelar edição" e "Adicionar" limpam o formulário: volta ao estado inicial
formProf.addEventListener('reset', () => setTimeout(() => prepararFormProfissional()));

function nomesDosServicos(ids) {
  const mapa = new Map((negocio.servicos || []).map(s => [s.id, s.nome]));
  return ids.map(id => mapa.get(id)).filter(Boolean);
}

const crudProfissionais = criarCrud({
  campo: 'profissionais',
  formId: 'form-profissional',
  listaId: 'lista-profissionais',
  lerForm: el => {
    const servicos = [...$('prof-servicos').querySelectorAll('input:checked')].map(i => i.value);
    let horario = null;
    if (el.horarioProprio.checked) {
      const lido = lerDias('prof-dias');
      if (lido.erro) throw new ErroDoFormulario(lido.erro);
      horario = lido.horario;
    }
    return { nome: el.nome.value.trim(), servicos, horario };
  },
  preencherForm: (el, i) => {
    el.nome.value = i.nome;
    prepararFormProfissional(i);
  },
  renderLinha: i => {
    const faz = nomesDosServicos(i.servicos || []);
    return `
    <strong>${U.esc(i.nome)} ${i.ativo === false ? '<span class="selo selo-off">oculto</span>' : ''}</strong>
    <span class="muted">${faz.length ? 'Faz: ' + U.esc(faz.join(', ')) : 'Faz todos os serviços'}${i.horario ? ' · horário próprio' : ''}</span>`;
  },
  aoAdicionar: novo => aplicarBloqueiosDeTodos(novo)
});

// ---------- Configurações ----------
function preencherConfig() {
  const el = $('form-config').elements;
  el.nome.value = negocio.nome || '';
  el.whatsapp.value = negocio.whatsapp || '';
  el.endereco.value = negocio.endereco || '';
  el.logoUrl.value = negocio.logoUrl || '';
  el.corPrimaria.value = negocio.cores?.primaria || '#2563eb';
  el.corSecundaria.value = negocio.cores?.secundaria || '#0f172a';
  el.intervaloMinutos.value = String(negocio.intervaloMinutos || 30);
  el.diasAFrente.value = String(negocio.diasAFrente || U.DIAS_A_FRENTE_PADRAO);

  renderDias('dias-semana', negocio.horarioFuncionamento || U.HORARIO_PADRAO);
  $('config-msg').textContent = '';
}

// Troca de intervalo (ex.: de 1 hora para 30 min) sem abrir brecha para agendamento duplo.
// Cada horário ocupado na grade antiga passa a ocupar também os horários da grade nova
// que caem por cima dele. Os novos horários ganham o mesmo agendamento ou bloqueio,
// então cancelar o agendamento ou remover o bloqueio continua liberando tudo.
async function ajustarOcupadosAoIntervalo(passoAntigo, novoNegocio) {
  const snap = await getDocs(query(
    collection(db, 'negocios', negocioId, 'ocupados'),
    where('data', '>=', U.hojeISO())
  ));
  const existentes = new Set(snap.docs.map(d => d.id));
  const passoNovo = Number(novoNegocio.intervaloMinutos) || 30;
  const profs = new Map((novoNegocio.profissionais || []).map(p => [p.id, p]));
  const operacoes = [];
  const novosPorAgendamento = new Map();

  for (const d of snap.docs) {
    const o = d.data();
    const grade = U.gerarSlotsDoDia(novoNegocio, o.data, profs.get(o.profissionalId) || null);
    for (const hora of U.slotsSobrepostos(grade, passoNovo, o.hora, passoAntigo)) {
      const id = U.idSlot(o.profissionalId, o.data, hora);
      if (existentes.has(id)) continue;
      existentes.add(id);
      const novo = { data: o.data, hora, profissionalId: o.profissionalId };
      if (o.agendamentoId) {
        novo.agendamentoId = o.agendamentoId;
        if (!novosPorAgendamento.has(o.agendamentoId)) novosPorAgendamento.set(o.agendamentoId, []);
        novosPorAgendamento.get(o.agendamentoId).push(id);
      }
      if (o.bloqueioId) novo.bloqueioId = o.bloqueioId;
      operacoes.push(batch => batch.set(doc(db, 'negocios', negocioId, 'ocupados', id), novo));
    }
  }
  // O agendamento guarda a lista dos seus horários (o cancelamento libera todos eles)
  for (const [agendamentoId, ids] of novosPorAgendamento) {
    operacoes.push(batch => batch.update(
      doc(db, 'negocios', negocioId, 'agendamentos', agendamentoId), { slots: arrayUnion(...ids) }
    ));
  }
  await gravarEmLotes(operacoes);
  return operacoes.length;
}

$('form-config').addEventListener('submit', async e => {
  e.preventDefault();
  const el = e.target.elements;

  const { horario: horarioFuncionamento, erro } = lerDias('dias-semana');
  if (erro) return ($('config-msg').textContent = erro);

  const dados = {
    nome: el.nome.value.trim(),
    whatsapp: el.whatsapp.value.trim(),
    endereco: el.endereco.value.trim(),
    logoUrl: el.logoUrl.value.trim(),
    cores: { primaria: el.corPrimaria.value, secundaria: el.corSecundaria.value },
    intervaloMinutos: Number(el.intervaloMinutos.value),
    diasAFrente: Number(el.diasAFrente.value),
    horarioFuncionamento
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const passoAntigo = Number(negocio.intervaloMinutos) || 30;
    if (dados.intervaloMinutos !== passoAntigo) {
      $('config-msg').textContent = 'Ajustando os horários já ocupados ao novo intervalo...';
      await ajustarOcupadosAoIntervalo(passoAntigo, { ...negocio, ...dados });
    }
    await updateDoc(doc(db, 'negocios', negocioId), dados);
    negocio = { ...negocio, ...dados };
    await carregarNegocio();
    $('config-msg').textContent = 'Configurações salvas!';
  } catch (err) {
    console.error(err);
    $('config-msg').textContent = 'Erro ao salvar. Tente novamente.';
  } finally {
    btn.disabled = false;
  }
});
