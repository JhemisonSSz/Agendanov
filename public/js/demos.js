// Negócios de demonstração do Agendanov (mostrados na página inicial).
// O /admin grava estes dados no Firestore com um clique.
// Funções puras: sem Firebase, para poder testar com `npm test`.

export const WHATS_NOVAA = '5573988045634';
export const SLUGS_DEMO = ['demo-barbearia', 'demo-manicure', 'demo-lash', 'demo-salao'];

// Todas abrem todos os dias, para o visitante sempre achar horário livre
const HORARIO_DEMO = {
  dom: ['09:00', '13:00'],
  seg: ['09:00', '19:00'], ter: ['09:00', '19:00'], qua: ['09:00', '19:00'],
  qui: ['09:00', '19:00'], sex: ['09:00', '19:00'], sab: ['09:00', '19:00']
};

// Proteção: só mexe no endereço de uma demonstração se ele está livre ou já é demonstração.
// Assim, um cliente real cadastrado por engano como "demo-salao" nunca é sobrescrito nem limpo.
export function podeGravarDemo(documentoExistente) {
  return !documentoExistente || documentoExistente.demo === true;
}

function demo(slug, nome, cores, servicos, profissionais) {
  return {
    slug,
    dados: {
      nome,
      tipo: slug === 'demo-barbearia' ? 'barbearia' : 'salao',
      plano: 'demo',
      whatsapp: WHATS_NOVAA,
      endereco: 'Itamaraju – BA (demonstração)',
      logoUrl: '',
      cores,
      intervaloMinutos: 30,
      horarioFuncionamento: { ...HORARIO_DEMO },
      servicos: servicos.map(([id, nomeServico, duracao, preco]) => ({ id, nome: nomeServico, duracao, preco, ativo: true })),
      profissionais: profissionais.map(([id, nomePessoa]) => ({ id, nome: nomePessoa, ativo: true })),
      ativo: true,
      demo: true,
      donoUid: null
    }
  };
}

// Devolve objetos novos a cada chamada (quem usa pode alterar à vontade)
export function documentosDemo() {
  return [
    demo('demo-barbearia', 'Barbearia Exemplo',
      { primaria: '#1e3a8a', secundaria: '#0f172a' },
      [['corte', 'Corte', 30, 35], ['barba', 'Barba', 30, 25], ['cortebarba', 'Corte + barba', 60, 55],
       ['pigmento', 'Pigmentação', 30, 30], ['sobrancelha', 'Sobrancelha', 30, 15]],
      [['rafael', 'Rafael'], ['diego', 'Diego']]),
    demo('demo-manicure', 'Studio Unhas Exemplo',
      { primaria: '#db2777', secundaria: '#500724' },
      [['mao', 'Mão', 60, 30], ['pe', 'Pé', 60, 35], ['pemao', 'Pé e mão', 90, 60],
       ['gel', 'Alongamento em gel', 120, 120], ['esmalte', 'Esmaltação em gel', 60, 50]],
      [['camila', 'Camila']]),
    demo('demo-lash', 'Lash Exemplo',
      { primaria: '#9d6b9f', secundaria: '#3b2340' },
      [['fio', 'Fio a fio', 120, 130], ['volume', 'Volume brasileiro', 120, 150], ['manutencao', 'Manutenção', 60, 80],
       ['lifting', 'Lash lifting', 60, 90], ['design', 'Design de sobrancelha', 30, 35]],
      [['juliana', 'Juliana']]),
    demo('demo-salao', 'Salão Exemplo',
      { primaria: '#b45309', secundaria: '#451a03' },
      [['corte', 'Corte feminino', 60, 70], ['escova', 'Escova', 60, 45], ['hidratacao', 'Hidratação', 60, 60],
       ['coloracao', 'Coloração', 120, 150], ['progressiva', 'Progressiva', 180, 220]],
      [['patricia', 'Patrícia'], ['larissa', 'Larissa']])
  ];
}
