import { firebaseConfig, auth, db } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import * as U from './utils.js';
import { documentosDemo, SLUGS_DEMO, podeGravarDemo } from './demos.js';

const $ = id => document.getElementById(id);

// Criar um usuário com o SDK do navegador faz login automático nele.
// Por isso usamos uma 2ª instância do app só para criar os donos,
// e você continua logado como super admin na principal.
const authSecundario = getAuth(initializeApp(firebaseConfig, 'secundario'));

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

$('btn-sair').onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if (!user) return mostrarTela('tela-login');
  const perfil = await getDoc(doc(db, 'usuarios', user.uid)).catch(() => null);
  if (!perfil?.exists() || perfil.data().papel !== 'superadmin') {
    await signOut(auth);
    $('erro-login').textContent = 'Esta conta não é de super admin.';
    return;
  }
  mostrarTela('tela-admin');
  carregarNegocios();
});

function mostrarTela(id) {
  ['tela-login', 'tela-admin'].forEach(t => $(t).classList.toggle('oculto', t !== id));
}

// ---------- Slug automático a partir do nome ----------
const form = $('form-novo');
let slugEditado = false;
form.elements.slug.addEventListener('input', () => { slugEditado = true; });
form.elements.nome.addEventListener('input', () => {
  if (!slugEditado) form.elements.slug.value = U.slugify(form.elements.nome.value);
});

// ---------- Criar negócio ----------
form.addEventListener('submit', async e => {
  e.preventDefault();
  const el = form.elements;
  const msg = $('novo-msg');
  const btn = form.querySelector('button[type="submit"]');
  const slug = U.slugify(el.slug.value);

  if (!U.slugValido(slug)) {
    msg.textContent = 'Slug inválido. Use letras minúsculas, números e hífen (ex.: barbearia-do-ze).';
    return;
  }

  btn.disabled = true;
  msg.textContent = 'Criando...';
  try {
    if ((await getDoc(doc(db, 'negocios', slug))).exists()) {
      msg.textContent = 'Já existe um negócio com esse slug.';
      return;
    }

    const cred = await createUserWithEmailAndPassword(authSecundario, el.email.value.trim(), el.senha.value);

    await setDoc(doc(db, 'negocios', slug), {
      nome: el.nome.value.trim(),
      tipo: el.tipo.value,
      plano: el.plano.value,
      whatsapp: el.whatsapp.value.trim(),
      endereco: '',
      logoUrl: '',
      cores: { primaria: '#2563eb', secundaria: '#0f172a' },
      intervaloMinutos: 30,
      horarioFuncionamento: U.HORARIO_PADRAO,
      servicos: [],
      profissionais: [],
      ativo: true,
      donoUid: cred.user.uid,
      criadoEm: serverTimestamp()
    });

    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      papel: 'dono',
      negocioId: slug,
      email: el.email.value.trim()
    });

    await signOut(authSecundario);
    msg.textContent = `Pronto! Site: ${location.origin}/${slug} · Painel: ${location.origin}/painel`;
    form.reset();
    slugEditado = false;
    carregarNegocios();
  } catch (err) {
    console.error(err);
    msg.textContent = err.code === 'auth/email-already-in-use'
      ? 'Esse e-mail já tem uma conta.'
      : 'Erro ao criar: ' + (err.message || err);
  } finally {
    btn.disabled = false;
  }
});

// ---------- Demonstrações ----------
// Cria (ou recria) os 4 negócios de demonstração. Rodar duas vezes não duplica nada,
// porque o ID do documento é sempre o mesmo.
// Se o endereço já é de um negócio REAL, pula e avisa (nunca sobrescreve cliente).
// Mantém a data de criação original quando a demonstração já existia.
async function criarDemos() {
  const pulados = [];
  for (const { slug, dados } of documentosDemo()) {
    const ref = doc(db, 'negocios', slug);
    const atual = await getDoc(ref);
    if (!podeGravarDemo(atual.exists() ? atual.data() : null)) { pulados.push(slug); continue; }
    const criadoEm = atual.exists() && atual.data().criadoEm ? atual.data().criadoEm : serverTimestamp();
    await setDoc(ref, { ...dados, criadoEm });
  }
  return pulados;
}

// Apaga os agendamentos, horários ocupados e bloqueios SÓ das demonstrações.
// Usa SLUGS_DEMO e nunca a lista de negócios, para não tocar em clientes reais.
async function limparDemos() {
  let total = 0;
  for (const slug of SLUGS_DEMO) {
    const atual = await getDoc(doc(db, 'negocios', slug));
    if (!podeGravarDemo(atual.exists() ? atual.data() : null)) continue; // é cliente real: não toca
    for (const sub of ['agendamentos', 'ocupados', 'bloqueios']) {
      const docs = (await getDocs(collection(db, 'negocios', slug, sub))).docs;
      for (let i = 0; i < docs.length; i += 450) {
        const lote = writeBatch(db);
        docs.slice(i, i + 450).forEach(d => lote.delete(d.ref));
        await lote.commit();
      }
      total += docs.length;
    }
  }
  return total;
}

async function executarDemo(botao, trabalho, mensagemOk) {
  const msg = $('demos-msg');
  botao.disabled = true;
  msg.textContent = 'Trabalhando...';
  try {
    const resultado = await trabalho();
    msg.textContent = mensagemOk(resultado);
    carregarNegocios();
  } catch (err) {
    console.error(err);
    msg.textContent = 'Erro: ' + (err.message || err);
  } finally {
    botao.disabled = false;
  }
}

$('btn-criar-demos').onclick = e => executarDemo(e.currentTarget, criarDemos, pulados => pulados.length
  ? `Prontas, exceto ${pulados.join(', ')}: esse endereço já é de um cliente real e foi preservado.`
  : 'Demonstrações prontas.');

$('btn-limpar-demos').onclick = e => {
  if (!confirm('Apagar todos os agendamentos e bloqueios das 4 demonstrações?')) return;
  executarDemo(e.currentTarget, limparDemos, n => `${n} registros apagados.`);
};

// ---------- Listar e ativar/desativar ----------
async function carregarNegocios() {
  const snap = await getDocs(collection(db, 'negocios'));
  const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

  $('contagem').textContent = `(${itens.length}, ${itens.filter(i => i.ativo).length} ativos)`;

  $('lista-negocios').innerHTML = itens.map(n => `
    <tr>
      <td><strong>${U.esc(n.nome)}</strong><br><span class="muted">/${U.esc(n.id)}</span></td>
      <td>${U.esc(n.tipo)}</td>
      <td>${U.esc(n.plano)}</td>
      <td><span class="selo ${n.ativo ? 'selo-ok' : 'selo-off'}">${n.ativo ? 'ativo' : 'suspenso'}</span></td>
      <td class="item-acoes">
        <a class="btn btn-sec btn-pequeno" href="/${encodeURIComponent(n.id)}" target="_blank" rel="noopener">Site</a>
        <a class="btn btn-sec btn-pequeno" href="/painel/?n=${encodeURIComponent(n.id)}" target="_blank" rel="noopener">Painel</a>
        <button class="btn ${n.ativo ? 'btn-perigo' : ''} btn-pequeno" type="button" data-alternar="${U.esc(n.id)}">
          ${n.ativo ? 'Suspender' : 'Reativar'}</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhum negócio ainda.</td></tr>';

  document.querySelectorAll('[data-alternar]').forEach(b => b.onclick = async () => {
    const n = itens.find(i => i.id === b.dataset.alternar);
    const acao = n.ativo ? 'Suspender' : 'Reativar';
    if (!confirm(`${acao} "${n.nome}"?`)) return;
    await updateDoc(doc(db, 'negocios', n.id), { ativo: !n.ativo });
    carregarNegocios();
  });
}
