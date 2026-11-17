import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc, writeBatch,
  setDoc, serverTimestamp
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

$('btn-sair').onclick = () => signOut(auth);

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
  if (nome === 'bloqueios') abrirBloqueios();
  if (nome === 'servicos') crudServicos.carregar();
  if (nome === 'profissionais') crudProfissionais.carregar();
  if (nome === 'config') preencherConfig();
}

// ---------- Agenda ----------
$('agenda-data').value = U.hojeISO();
$('agenda-data').addEventListener('change', carregarAgenda);

async function carregarAgenda() {
  const data = $('agenda-data').value;
  const box = $('lista-agenda');
  box.innerHTML = '<p class="muted">Carregando...</p>';
  $('agenda-resumo').textContent = '';

  const snap = await getDocs(query(
    collection(db, 'negocios', negocioId, 'agendamentos'),
    where('data', '==', data)
  ));
  const itens = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.hora.localeCompare(b.hora) || a.profissionalNome.localeCompare(b.profissionalNome));

  if (!itens.length) {
    box.innerHTML = '<p class="muted">Nenhum agendamento neste dia.</p>';
    return;
  }

  const total = itens.reduce((soma, a) => soma + (Number(a.preco) || 0), 0);
  $('agenda-resumo').textContent =
    `${itens.length} agendamento(s) em ${U.formatarData(data)} · previsto ${U.moeda(total)}`;

  box.innerHTML = itens.map(a => `
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
    b.onclick = () => cancelarAgendamento(itens.find(i => i.id === b.dataset.cancelar));
  });
}

async function cancelarAgendamento(a) {
  if (!confirm(`Cancelar o horário de ${a.clienteNome} às ${a.hora}? O horário volta a ficar livre.`)) return;
  // Apaga o agendamento e libera todos os horários que ele ocupava
  const batch = writeBatch(db);
  batch.delete(doc(db, 'negocios', negocioId, 'agendamentos', a.id));
  (a.slots || [a.id]).forEach(s => batch.delete(doc(db, 'negocios', negocioId, 'ocupados', s)));
  await batch.commit();
  carregarAgenda();
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
      const horas = U.gerarSlotsDoDia(negocio, data).filter(h => h >= horaInicio && h < horaFim);

      for (const p of alvo) {
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
function criarCrud({ campo, formId, listaId, lerForm, preencherForm, renderLinha }) {
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
        await salvarLista(lista => [...lista, { id: U.novoId(lista), ...dados, ativo: true }]);
      }
      sairDaEdicao();
      carregar();
    } catch (err) {
      console.error(err);
      alert('Não foi possível salvar. Tente novamente.');
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

const crudProfissionais = criarCrud({
  campo: 'profissionais',
  formId: 'form-profissional',
  listaId: 'lista-profissionais',
  lerForm: el => ({ nome: el.nome.value.trim() }),
  preencherForm: (el, i) => { el.nome.value = i.nome; },
  renderLinha: i => `
    <strong>${U.esc(i.nome)} ${i.ativo === false ? '<span class="selo selo-off">oculto</span>' : ''}</strong>`
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

  const horario = negocio.horarioFuncionamento || U.HORARIO_PADRAO;
  $('dias-semana').innerHTML = U.DIAS.map(d => {
    const faixa = horario[d];
    return `
      <div class="dia" data-dia="${d}">
        <label><input type="checkbox" data-aberto ${faixa ? 'checked' : ''}> ${U.NOMES_DIAS[d]}</label>
        <input type="time" data-abre value="${faixa?.[0] || '09:00'}" aria-label="Abre às">
        <input type="time" data-fecha value="${faixa?.[1] || '18:00'}" aria-label="Fecha às">
      </div>`;
  }).join('');
  $('config-msg').textContent = '';
}

$('form-config').addEventListener('submit', async e => {
  e.preventDefault();
  const el = e.target.elements;

  const horarioFuncionamento = {};
  let erro = '';
  document.querySelectorAll('#dias-semana .dia').forEach(linha => {
    const aberto = linha.querySelector('[data-aberto]').checked;
    const abre = linha.querySelector('[data-abre]').value;
    const fecha = linha.querySelector('[data-fecha]').value;
    if (aberto && (!abre || !fecha || abre >= fecha)) erro = `Confira o horário de ${U.NOMES_DIAS[linha.dataset.dia]}.`;
    horarioFuncionamento[linha.dataset.dia] = aberto ? [abre, fecha] : null;
  });
  if (erro) return ($('config-msg').textContent = erro);

  const dados = {
    nome: el.nome.value.trim(),
    whatsapp: el.whatsapp.value.trim(),
    endereco: el.endereco.value.trim(),
    logoUrl: el.logoUrl.value.trim(),
    cores: { primaria: el.corPrimaria.value, secundaria: el.corSecundaria.value },
    intervaloMinutos: Number(el.intervaloMinutos.value),
    horarioFuncionamento
  };

  try {
    await updateDoc(doc(db, 'negocios', negocioId), dados);
    negocio = { ...negocio, ...dados };
    await carregarNegocio();
    $('config-msg').textContent = 'Configurações salvas!';
  } catch (err) {
    console.error(err);
    $('config-msg').textContent = 'Erro ao salvar. Tente novamente.';
  }
});
