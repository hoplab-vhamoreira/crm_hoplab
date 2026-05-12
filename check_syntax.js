
const SECTIONS = {
  dashboard: {title:'Dashboard',icon:'&#x1f4ca;',group:'Geral'},
  alertas: {title:'Alertas',icon:'&#x1f6a8;',group:'Geral',
    cols:['Tipo','Cliente','Detalhe','ResponsÃ¡vel','DataLimite','DiasAtraso','Prioridade','Fonte']},
  pipeline: {title:'Pipeline Comercial',icon:'&#x1f4c8;',group:'Comercial',columnFilters:true,
    cols:['NÂº ON','Contacto','Status','Aberta/Fechada','Tipo','Comercial','Fonte AquisiÃ§Ã£o','Canal Contacto'],
    fields:[{k:'Tipo',t:'select',opts:['Studio','Lab']},{k:'Comercial',t:'text'},{k:'Contacto',t:'text'},{k:'Fonte AquisiÃ§Ã£o',t:'text'},{k:'Canal Contacto',t:'select',opts:['Chamada TelefÃ³nica','WhatsApp','Email','Presencial','Instagram','Website']},{k:'Parceiro',t:'text'},{k:'Segmento Mercado',t:'text'}]},
  log_comercial: {title:'Log Comercial',icon:'&#x1f4dd;',group:'Comercial',hidden:true,
    cols:['NÂº ON','Contacto','Data AÃ§Ã£o','Dias AtrÃ¡s','Canal','Tipo AÃ§Ã£o','Resumo','Resultado'],
    fields:[
      {k:'NÂº ON',t:'number'},
      {k:'Contacto',t:'lookup',src:'pipeline',sf:'Contacto',
        fills:[{src:'pipeline',mf:'Contacto',rf:'NÂº ON',tf:'NÂº ON'}]},
      {k:'Data AÃ§Ã£o',t:'date'},
      {k:'Canal',t:'select',opts:['WhatsApp','Chamada TelefÃ³nica','Email','Presencial']},
      {k:'Tipo AÃ§Ã£o',t:'select',opts:['WhatsApp','Chamada','Email','ReuniÃ£o']},
      {k:'Resumo',t:'text'},
      {k:'DescriÃ§Ã£o',t:'textarea'},
      {k:'Resultado',t:'select',opts:['Pendente','Agendado','Ganho','Convertido','Sem resposta','Perdido','NÃ£o AvanÃ§ou']},
      {k:'Tipo ConversÃ£o',t:'select',opts:['Cliente','Parceiro'],showIf:{k:'Resultado',v:'Ganho'}},
      {k:'Comercial',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'}
    ]},
  clientes: {title:'Clientes',icon:'&#x1f465;',group:'Clientes',
    cols:['ID','Nome','Status','Email','TelemÃ³vel','Ãšltimo Contacto','Dias s/ Contacto','Localidade'],
    fields:[
      {k:'Nome',t:'text'},
      {k:'Email',t:'text'},
      {k:'TelemÃ³vel',t:'text'},
      {k:'NIF',t:'text'},
      {k:'Morada',t:'text'},
      {k:'Localidade',t:'text'},
      {k:'Segmento',t:'text'},
      {k:'PT',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'Nutricionista',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'MÃ©todo Pagamento',t:'select',opts:['TransferÃªncia Multibanco','DÃ©bito Direto','Pagamento Mbway','NumerÃ¡rio']},
      {k:'ComentÃ¡rios',t:'textarea'}
    ]},
  clientes_hibridos: {title:'Clientes HÃ­bridos',icon:'&#x1f500;',group:'Clientes'},
  parceiros: {title:'Parceiros',icon:'&#x1f91d;',group:'Clientes',
    cols:['Nome / Empresa','Tipo Entidade','ResponsÃ¡vel','Email','Telefone','CÃ³digo','Modelo Parceria'],
    fields:[
      {k:'Nome / Empresa',t:'text'},
      {k:'Tipo Entidade',t:'select',opts:['Empresa B2B','Empresa B2B2C','Particular','Outro']},
      {k:'Morada',t:'text'},
      {k:'Locadidade',t:'text'},
      {k:'ResponsÃ¡vel',t:'text'},
      {k:'Email',t:'text'},
      {k:'Telefone',t:'text'},
      {k:'CÃ³digo',t:'text'},
      {k:'Modelo Parceria',t:'text'},
      {k:'ComissÃ£o %',t:'number'}
    ]},
  entidades_faturacao: {title:'Entidades FaturaÃ§Ã£o',icon:'&#x1f4c4;',group:'Clientes',
    cols:['Nome','NIF','Morada','Email'],
    fields:[
      {k:'Nome',t:'text'},
      {k:'NIF',t:'text'},
      {k:'Morada',t:'text'},
      {k:'Email',t:'text'},
      {k:'Notas',t:'textarea'}
    ]},
  conversoes: {title:'ConversÃµes',icon:'&#x1f504;',group:'Operacional',
    cols:['Cliente','ServiÃ§o','CÃ³digo ServiÃ§o','TÃ©cnico ResponsÃ¡vel','NÃ­vel','Data da MarcaÃ§Ã£o/InÃ­cio','CobranÃ§a'],
    fields:[
      {k:'Cliente',t:'lookup',src:'clientes',sf:'Nome'},
      {k:'ServiÃ§o',t:'lookup',src:'precario_publico',sf:'ServiÃ§o'},
      {k:'TÃ©cnico ResponsÃ¡vel',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'Venda de',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'NÃ­vel',t:'select',opts:['N1 - Avaliar','N2 - Confirmar','N3 - Validar','Sem nÃ­vel']},
      {k:'Data da MarcaÃ§Ã£o/InÃ­cio',t:'date'},
      {k:'Hora',t:'time'},
      {k:'Sinal',t:'number'},
      {k:'CobranÃ§a',t:'select',opts:['Entrada + Mensalidade','SÃ³ Entrada','SÃ³ Mensalidade','Pack','InscriÃ§Ã£o','Gratuito','NÃ£o aplicÃ¡vel']},
      {k:'Email',t:'text'},
      {k:'TelemÃ³vel',t:'text'},
      {k:'Extra ServiÃ§o',t:'text'}
    ]},
  avaliacoes: {title:'AvaliaÃ§Ãµes',icon:'&#x1f4cb;',group:'Operacional',
    cols:['Nome','ServiÃ§o','TÃ©cnico ResponsÃ¡vel','NÃ­vel','Data','Dias para AvaliaÃ§Ã£o','_Status_Aval','Origem'],
    fields:[
      {k:'Nome',t:'lookup',src:'clientes',sf:'Nome'},
      {k:'ServiÃ§o',t:'lookup',src:'precario_publico',sf:'ServiÃ§o'},
      {k:'TÃ©cnico ResponsÃ¡vel',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'NÃ­vel',t:'select',opts:['N1 - Avaliar','N2 - Confirmar','N3 - Validar']},
      {k:'Data',t:'date'},
      {k:'Hora',t:'time'},
      {k:'Origem',t:'select',opts:['InscriÃ§Ã£o','Parceiro','ReativaÃ§Ã£o','Campanha','Outro']}
    ]},
  servicos: {title:'ServiÃ§os',icon:'&#x1f3cb;',group:'Operacional',
    cols:['Cliente','ServiÃ§o','CÃ³digo','TÃ©cnico ResponsÃ¡vel','Data ConversÃ£o','Ciclo'],
    fields:[
      {k:'Cliente',t:'lookup',src:'clientes',sf:'Nome'},
      {k:'ServiÃ§o',t:'lookup',src:'precario_publico',sf:'ServiÃ§o'},
      {k:'TÃ©cnico ResponsÃ¡vel',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'Data ConversÃ£o',t:'date'},
      {k:'Ciclo',t:'text'}
    ]},
  log_operacional: {title:'Log Operacional',icon:'&#x1f4c5;',group:'Operacional',
    cols:['Cliente','CÃ³digo','ServiÃ§o','TÃ©cnico ResponsÃ¡vel','Operacional','Origem','Data Entrada','AÃ§Ã£o'],
    fields:[
      {k:'Cliente',t:'lookup',src:'clientes',sf:'Nome'},
      {k:'ServiÃ§o',t:'lookup',src:'precario_publico',sf:'ServiÃ§o'},
      {k:'TÃ©cnico ResponsÃ¡vel',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'Operacional',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'Origem',t:'select',opts:['ProspeÃ§Ã£o','ReativaÃ§Ã£o','Parceiro','InscriÃ§Ã£o','Outro']},
      {k:'Data Entrada',t:'date'},
      {k:'Data Prevista',t:'date'},
      {k:'AÃ§Ã£o',t:'select',opts:['Msg MarcaÃ§Ã£o','MarcaÃ§Ã£o','Realizado','Cancelado','Remarcado']}
    ]},
  log_contratos: {title:'Log Contratos',icon:'&#x1f4d1;',group:'Operacional',
    cols:['Cliente','Estado','Motivo','Data InÃ­cio','Data Fim','Registado por'],
    fields:[
      {k:'Cliente',t:'lookup',src:'clientes',sf:'Nome'},
      {k:'Estado',t:'select',opts:['SuspensÃ£o','Cancelamento','ReactivaÃ§Ã£o','Desconto','FÃ©rias','Troca']},
      {k:'Motivo',t:'text'},
      {k:'Data InÃ­cio',t:'date'},
      {k:'Data Fim',t:'date'},
      {k:'Registado por',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'Notas',t:'textarea'}
    ]},
  ciclos: {title:'Ciclos',icon:'&#x1f503;',group:'Operacional',
    cols:['Cliente','Tipo','Ciclo NÂº','Data InÃ­cio','Data Fim','Semana Actual']},
  falhas_sancoes: {title:'Falhas e SanÃ§Ãµes',icon:'&#x26a0;',group:'Operacional',
    cols:['Falta','Categoria','Pontos','Ã‚mbito','MÃ©trica?'],
    fields:[
      {k:'Profissional',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'Falta',t:'text'},
      {k:'Categoria',t:'select',opts:['NÃ£o Grave','Grave','Muito Grave']},
      {k:'Pontos',t:'number'},
      {k:'Ã‚mbito',t:'select',opts:['Treinador','Coordenador','Geral']},
      {k:'MÃ©trica?',t:'select',opts:['Sim','NÃ£o']},
      {k:'Data',t:'date'},
      {k:'Notas',t:'textarea'}
    ]},
  vendas_bonus: {title:'Vendas e BÃ³nus',icon:'&#x1f4b0;',group:'Financeiro',
    cols:['Professor','Q1 2026 (Jan-Mar)','Q2 2026 (Abr-Jun)','Q3 2026 (Jul-Set)','Q4 2026 (Out-Dez)']},
  pag_clientes_2026: {title:'Pagamentos 2026',icon:'&#x1f4b3;',group:'Financeiro',
    cols:['NÂº','Cliente','MÃªs','Modalidade','Valor a Pagar','Valor Pago','_Estado_Pag','Forma Pagamento','NÂº Doc'],
    fields:[
      {k:'Cliente',t:'lookup',src:'clientes',sf:'Nome'},
      {k:'MÃªs',t:'select',opts:['Janeiro','Fevereiro','MarÃ§o','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']},
      {k:'Modalidade',t:'text'},
      {k:'Valor a Pagar',t:'number'},
      {k:'Valor Pago',t:'number'},
      {k:'Forma Pagamento',t:'select',opts:['TransferÃªncia Multibanco','DÃ©bito Direto','Pagamento Mbway','NumerÃ¡rio']},
      {k:'NÂº Doc',t:'text'},
      {k:'Nota HopLab',t:'textarea'}
    ]},
  pag_clientes_2025: {title:'Pagamentos 2025',icon:'&#x1f4b3;',group:'Financeiro',
    cols:['NÂº','Cliente','MÃªs','Modalidade','Valor a Pagar','Valor Pago','_Estado_Pag','Forma Pagamento']},
  totais_pagamentos: {title:'Totais Pagamentos',icon:'&#x1f4b5;',group:'Financeiro',
    cols:['Professor','Role','Jan Pagamento','Jan CedÃªncia','Jan Saldo NET','Fev Pagamento','Fev CedÃªncia','Fev Saldo NET']},
  pagamentos_treinadores: {title:'Pag. Treinadores',icon:'&#x1f4b8;',group:'Financeiro',
    cols:['Cliente','Professor','Taxa de adesÃ£o','Valor mensal Professor (s/ alteraÃ§Ã£o)','Mensalidade Treino'],
    fields:[
      {k:'Cliente',t:'lookup',src:'clientes',sf:'Nome'},
      {k:'Professor',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'Taxa de adesÃ£o',t:'number'},
      {k:'Mensalidade Treino',t:'number'},
      {k:'Notas',t:'textarea'}
    ]},
  calculadora: {title:'Calculadora',icon:'&#x1f5a9;',group:'Financeiro'},
  precario_publico: {title:'PreÃ§Ã¡rio PÃºblico',icon:'&#x1f4c3;',group:'Financeiro',
    cols:['ServiÃ§o','CÃ³digo','PVP Base (c/IVA)','Desconto','PVP Promocional (c/IVA)','PoupanÃ§a'],
    fields:[
      {k:'ServiÃ§o',t:'text'},
      {k:'CÃ³digo',t:'text'},
      {k:'PVP Base (c/IVA)',t:'number'},
      {k:'Desconto',t:'number'},
      {k:'Sinal',t:'number'}
    ]},
  dados_colaboradores: {title:'Dados Colaboradores',icon:'&#x1f464;',group:'Equipa',
    cols:['Nome Oficial','Contacto TelefÃ³nico','Contacto Email','Cargo','Tipo de regime','Tipo de CedÃªncia','Valor da CedÃªncia'],
    fields:[
      {k:'Nome Oficial',t:'text'},
      {k:'Contacto TelefÃ³nico',t:'text'},
      {k:'Contacto Email',t:'text'},
      {k:'Cargo',t:'text'},
      {k:'Ãrea',t:'text'},
      {k:'Tipo de regime',t:'select',opts:['C/ IVA','S/ IVA']},
      {k:'Interno/Externo',t:'select',opts:['Interno','Externo']},
      {k:'CondiÃ§Ãµes',t:'text'},
      {k:'Tipo de recebimento',t:'text'},
      {k:'Tipo de CedÃªncia',t:'text'},
      {k:'Valor da CedÃªncia',t:'number'},
      {k:'Iban',t:'text'}
    ]},
  log_colaboradores: {title:'Log Colaboradores',icon:'&#x1f4dd;',group:'Equipa',
    cols:['Data','Colaborador','Evento','Cargo Novo','Motivo','Notas'],
    fields:[
      {k:'Data',t:'date'},
      {k:'Colaborador',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'},
      {k:'Evento',t:'select',opts:['AdmissÃ£o','SuspensÃ£o','DemissÃ£o','PromoÃ§Ã£o','TransferÃªncia']},
      {k:'Cargo Novo',t:'text'},
      {k:'Motivo',t:'text'},
      {k:'Notas',t:'textarea'},
      {k:'Registado por',t:'lookup',src:'dados_colaboradores',sf:'Nome Oficial'}
    ]},
  responsabilidades: {title:'Responsabilidades',icon:'&#x1f4cc;',group:'Equipa',
    cols:['#','Ãrea','ResponsÃ¡vel(eis)','O que faz','Sheets onde actua','Reporta a']},
  matriz_partilhas: {title:'Matriz Partilhas',icon:'&#x1f517;',group:'Equipa',
    cols:['CÃ³d. Origem','Tipo Info Partilhada','Destino: PT','Destino: Nutri','Destino: Fisiologista','Destino: MÃ©dico']},
  adesoes_validar: {title:'AdesÃµes a Validar',icon:'&#x1f527;',group:'Admin',
    cols:['NÂº','Cliente','Plano (mais recente)','Valor base','Data InÃ­cio (proposta)','Tipo','AcÃ§Ã£o sugerida'],
    fields:[
      {k:'Cliente',t:'lookup',src:'clientes',sf:'Nome'},
      {k:'Plano (mais recente)',t:'lookup',src:'precario_publico',sf:'ServiÃ§o'},
      {k:'Valor base',t:'number'},
      {k:'Data InÃ­cio (proposta)',t:'date'},
      {k:'Tipo',t:'select',opts:['Herdado','Novo','RenovaÃ§Ã£o']},
      {k:'AcÃ§Ã£o sugerida',t:'text'}
    ]},
  backoffice: {title:'Backoffice',icon:'&#x2699;',group:'Admin'}
};

let currentUser=null, currentPerms=[], currentSection='dashboard', sectionData={}, sectionPage={}, sectionFilters={};
let _activeFilterKey=null; // coluna de filtro activa â€” para restaurar foco apÃ³s re-render

async function api(url,opts={}){
  opts.headers={'Content-Type':'application/json',...(opts.headers||{})};
  if(opts.body&&typeof opts.body==='object') opts.body=JSON.stringify(opts.body);
  const r=await fetch(url,opts);
  return r.json();
}

function toast(msg,type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast show '+type;
  setTimeout(()=>t.classList.remove('show'),3000);
}

// LOGIN
async function doLogin(){
  const u=document.getElementById('loginUser').value, p=document.getElementById('loginPass').value;
  const r=await api('/api/login',{method:'POST',body:{username:u,password:p}});
  if(r.ok){currentUser=r.user;currentPerms=r.permissions;showApp();}
  else{const e=document.getElementById('loginError');e.textContent=r.error||'Erro';e.style.display='block';}
}
document.getElementById('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

async function doLogout(){
  await api('/api/logout',{method:'POST'});
  currentUser=null;currentPerms=[];
  document.getElementById('app').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
}

async function checkSession(){
  const r=await api('/api/me');
  if(r.ok){currentUser=r.user;currentPerms=r.permissions;showApp();}
}

function showApp(){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('userAvatar').textContent=currentUser.name[0];
  document.getElementById('userName').textContent=currentUser.name;
  document.getElementById('userRole').textContent=currentUser.role;
  buildSidebar();
  navigate('dashboard');
}

// SIDEBAR
function buildSidebar(){
  const nav=document.getElementById('sidebarNav');
  const groups={};
  for(const[k,s] of Object.entries(SECTIONS)){
    if(s.hidden) continue;
    if(k!=='dashboard'&&k!=='backoffice'&&!currentPerms.includes(k)) continue;
    if(k==='backoffice'&&currentUser.role!=='Admin') continue;
    const g=s.group||'Outros';
    if(!groups[g]) groups[g]=[];
    groups[g].push({key:k,...s});
  }
  let html='';
  for(const[g,items] of Object.entries(groups)){
    html+=`<div class="nav-group"><div class="nav-group-title">${g}</div>`;
    for(const it of items){
      html+=`<div class="nav-item" data-key="${it.key}" onclick="navigate('${it.key}')"><span class="icon">${it.icon}</span>${it.title}</div>`;
    }
    html+='</div>';
  }
  nav.innerHTML=html;
}

// NAVIGATION
async function navigate(section){
  currentSection=section;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.key===section));
  const main=document.getElementById('mainContent');
  if(section==='dashboard') return renderDashboard(main);
  if(section==='backoffice') return renderBackoffice(main);
  await renderDataPage(main,section);
}

// DASHBOARD
async function renderDashboard(el){
  const stats=await api('/api/stats');
  const important=[
    {key:'clientes',label:'Clientes',color:'purple'},
    {key:'pipeline',label:'Pipeline',color:'blue'},
    {key:'conversoes',label:'Conversoes',color:'green'},
    {key:'alertas',label:'Alertas',color:'amber'},
    {key:'pag_clientes_2026',label:'Pagamentos 2026',color:'blue'},
    {key:'log_operacional',label:'Registos Operacionais',color:'green'},
  ];
  let cards='';
  for(const c of important){
    if(stats[c.key]!==undefined) cards+=`<div class="stat-card"><div class="label">${c.label}</div><div class="value ${c.color}">${stats[c.key]}</div></div>`;
  }
  let recentHtml='';
  for(const[k,v] of Object.entries(stats)){
    const s=SECTIONS[k];
    if(s) recentHtml+=`<tr><td>${s.icon} ${s.title}</td><td>${v} registos</td><td><button class="btn btn-sm btn-ghost" onclick="navigate('${k}')">Abrir</button></td></tr>`;
  }
  el.innerHTML=`
    <div class="page-header"><div><h1>Dashboard</h1><div class="subtitle">Bem-vindo, ${currentUser.name}</div></div></div>
    <div class="stats-grid">${cards}</div>
    <div class="table-wrap"><div class="table-toolbar"><strong>Todas as Seccoes</strong></div>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Seccao</th><th>Registos</th><th></th></tr></thead><tbody>${recentHtml}</tbody></table></div></div>`;
}

// DATA PAGE
const PER_PAGE=50;
async function renderDataPage(el,section){
  const sec=SECTIONS[section]||{title:section};
  if(!sectionData[section]){
    const d=await api(`/api/data/${section}`);
    if(d.error){el.innerHTML=`<div class="page-header"><h1>${sec.title}</h1></div><p style="color:var(--danger)">${d.error}</p>`;return;}
    sectionData[section]=d;
  }
  const data=sectionData[section];
  if(!data.length){el.innerHTML=`<div class="page-header"><div><h1>${sec.icon} ${sec.title}</h1></div><div>${sec.fields?`<button class="btn btn-primary" onclick="openAdd('${section}')">+ Adicionar</button>`:''}</div></div><div class="table-wrap" style="padding:40px;text-align:center;color:var(--text-muted)">Sem dados</div>`;return;}
  const allCols=sec.cols||Object.keys(data[0]).filter(c=>c!=='_id').slice(0,8);
  sectionPage[section]=sectionPage[section]||0;
  renderTable(el,section,sec,data,allCols);
}

function cfId(section,col){return `cf_${section}_${col.replace(/[^a-zA-Z0-9]/g,'_')}`;}

function doColumnFilter(section,col,val){
  if(!sectionFilters[section]) sectionFilters[section]={};
  sectionFilters[section][col]=val;
  sectionPage[section]=0;
  const sec=SECTIONS[section]||{title:section};
  const data=sectionData[section]||[];
  const allCols=sec.cols||Object.keys(data[0]||{}).filter(c=>c!=='_id').slice(0,8);
  renderTable(document.getElementById('mainContent'),section,sec,data,allCols);
}

function clearColumnFilters(section){
  sectionFilters[section]={};
  _activeFilterKey=null;
  sectionPage[section]=0;
  const sec=SECTIONS[section]||{title:section};
  const data=sectionData[section]||[];
  const allCols=sec.cols||Object.keys(data[0]||{}).filter(c=>c!=='_id').slice(0,8);
  renderTable(document.getElementById('mainContent'),section,sec,data,allCols);
}

function renderTable(el,section,sec,data,allCols){
  const page=sectionPage[section]||0;
  const search=(document.getElementById('search_'+section)||{}).value||'';
  const colFilters=sectionFilters[section]||{};
  const hasColFilters=Object.values(colFilters).some(v=>v);

  let filtered=data;
  if(search){
    const q=search.toLowerCase();
    filtered=data.filter(r=>Object.values(r).some(v=>v&&String(v).toLowerCase().includes(q)));
  }
  // Aplicar filtros por coluna â€” match exacto (valores vÃªm de dropdown)
  if(hasColFilters){
    filtered=filtered.filter(r=>Object.entries(colFilters).every(([col,val])=>{
      if(!val) return true;
      return String(r[col]??'') === val;
    }));
  }

  const totalPages=Math.ceil(filtered.length/PER_PAGE);
  const pageData=filtered.slice(page*PER_PAGE,(page+1)*PER_PAGE);

  // Linha de cabeÃ§alho
  let thHtml=allCols.map(c=>`<th>${c}</th>`).join('')+'<th>AÃ§Ãµes</th>';

  // Linha de filtros por coluna como dropdowns (se activado na secÃ§Ã£o)
  if(sec.columnFilters){
    const filterSels=allCols.map(c=>{
      const id=cfId(section,c);
      const cur=colFilters[c]||'';

      // Valores Ãºnicos desta coluna (de todos os dados, nÃ£o sÃ³ filtrados)
      const raw=[...new Set(data.map(r=>String(r[c]??'')).filter(v=>v&&v!=='None'&&v!=='null'))];

      // Detectar tipo de ordenaÃ§Ã£o
      const allNum  = raw.every(v=>v!==''&&!isNaN(Number(v)));
      const allDate = raw.every(v=>/^\d{4}-\d{2}-\d{2}/.test(v));
      if(allNum)       raw.sort((a,b)=>Number(a)-Number(b));
      else if(allDate) raw.sort();
      else             raw.sort((a,b)=>a.localeCompare(b,'pt',{sensitivity:'base'}));

      const opts=raw.map(v=>`<option value="${v.replace(/"/g,'&quot;')}"${v===cur?' selected':''}>${v}</option>`).join('');
      return `<th><select id="${id}" class="col-filter-sel${cur?' active':''}" onchange="doColumnFilter('${section}','${c.replace(/'/g,"\\'")}',this.value)">
        <option value="">â€” ${c} â€”</option>${opts}
      </select></th>`;
    }).join('')+'<th></th>';
    thHtml+=`</tr><tr class="filter-row">${filterSels}`;
  }
  let tbHtml='';
  for(let i=0;i<pageData.length;i++){
    const r=pageData[i];
    const realIdx=data.indexOf(r);
    let cells=allCols.map(c=>{
      let v=r[c];
      if(v===null||v===undefined){
        const lc=c.toLowerCase();
        for(const k of Object.keys(r)){if(k.toLowerCase()===lc||k.toLowerCase().includes(lc)){v=r[k];break;}}
      }
      if(v===null||v===undefined) v='';
      // Coluna Status: separar estado base do aviso (clientes) ou badge ON (pipeline)
      if(c==='Status' && section==='clientes'){
        return `<td title="${String(v).replace(/"/g,'&quot;')}">${renderStatusBadges(v)}</td>`;
      }
      if(c==='Status' && section==='pipeline'){
        return `<td>${onStatusBadge(String(v))}</td>`;
      }
      return `<td title="${String(v).replace(/"/g,'&quot;')}">${v}</td>`;
    }).join('');
    if(section==='clientes'){
      const nome=r['Nome']||'';
      cells+=`<td class="actions">
        <button onclick="event.stopPropagation();openClienteDetalhe('${nome.replace(/'/g,"\\'")}');" title="Ver Ficha">&#x1f464;</button>
        <button onclick="event.stopPropagation();openEdit('${section}',${realIdx})" title="Editar">&#x270F;</button>
        <button class="del" onclick="event.stopPropagation();deleteRec('${section}',${realIdx})" title="Eliminar">&#x1f5d1;</button>
      </td>`;
      tbHtml+=`<tr style="cursor:pointer" onclick="openClienteDetalhe('${nome.replace(/'/g,"\\'")}');">${cells}</tr>`;
    } else if(section==='pipeline'){
      const nON = r['NÂº ON']||'';
      cells+=`<td class="actions">
        <button onclick="event.stopPropagation();openONDetalhe(${nON});" title="Ver ON">&#x1f4cb;</button>
        <button onclick="event.stopPropagation();openEdit('${section}',${realIdx})" title="Editar">&#x270F;</button>
        <button class="del" onclick="event.stopPropagation();deleteRec('${section}',${realIdx})" title="Eliminar">&#x1f5d1;</button>
      </td>`;
      tbHtml+=`<tr style="cursor:pointer" onclick="openONDetalhe(${nON});">${cells}</tr>`;
    } else {
      cells+=`<td class="actions">
        <button onclick="openEdit('${section}',${realIdx})" title="Editar">&#x270F;</button>
        <button class="del" onclick="deleteRec('${section}',${realIdx})" title="Eliminar">&#x1f5d1;</button>
      </td>`;
      tbHtml+=`<tr>${cells}</tr>`;
    }
  }
  let pagHtml='';
  if(totalPages>1){
    pagHtml+=`<button ${page===0?'disabled':''} onclick="changePage('${section}',${page-1})">&laquo;</button>`;
    for(let p=0;p<totalPages&&p<10;p++) pagHtml+=`<button class="${p===page?'active':''}" onclick="changePage('${section}',${p})">${p+1}</button>`;
    if(totalPages>10) pagHtml+=`<span style="color:var(--text-muted)">...${totalPages}</span>`;
    pagHtml+=`<button ${page>=totalPages-1?'disabled':''} onclick="changePage('${section}',${page+1})">&raquo;</button>`;
  }
  const filterBadge = hasColFilters
    ? `<span class="filter-active-badge">Filtros activos <button onclick="clearColumnFilters('${section}')" style="background:none;border:none;color:inherit;cursor:pointer;font-size:13px;line-height:1;padding:0 0 0 2px" title="Limpar filtros">âœ•</button></span>`
    : '';

  el.innerHTML=`
    <div class="page-header"><div><h1>${sec.icon} ${sec.title}</h1><div class="subtitle">${filtered.length} registos</div></div>
    <div>${sec.fields?`<button class="btn btn-primary" onclick="openAdd('${section}')">+ Adicionar</button>`:''}</div></div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <input type="text" id="search_${section}" placeholder="Pesquisar em tudo..." value="${search}" oninput="doSearch('${section}')">
        ${filterBadge}
        <span class="table-count">${filtered.length} de ${data.length}</span>
      </div>
      <div class="tbl-scroll"><table class="tbl"><thead><tr>${thHtml}</tr></thead><tbody>${tbHtml}</tbody></table></div>
      ${totalPages>1?`<div class="pagination">${pagHtml}</div>`:''}
    </div>`;
}

function doSearch(section){
  sectionPage[section]=0;
  const sec=SECTIONS[section]||{title:section};
  const data=sectionData[section]||[];
  const allCols=sec.cols||Object.keys(data[0]||{}).filter(c=>c!=='_id').slice(0,8);
  renderTable(document.getElementById('mainContent'),section,sec,data,allCols);
  // Re-focar o input apÃ³s re-renderizaÃ§Ã£o para nÃ£o perder foco
  const inp=document.getElementById('search_'+section);
  if(inp){const l=inp.value.length;inp.focus();inp.setSelectionRange(l,l);}
}
function changePage(section,p){
  sectionPage[section]=p;
  const sec=SECTIONS[section]||{title:section};
  const data=sectionData[section]||[];
  const allCols=sec.cols||Object.keys(data[0]||{}).filter(c=>c!=='_id').slice(0,8);
  renderTable(document.getElementById('mainContent'),section,sec,data,allCols);
}

// MODAL CRUD
function closeModal(){document.getElementById('modal').classList.remove('show');}

// Cache de lookups para nÃ£o pedir ao servidor repetidamente
const _lookupCache={};
async function getLookup(src,sf){
  const key=`${src}.${sf}`;
  if(!_lookupCache[key]){
    const vals=await api(`/api/lookup/${src}/${encodeURIComponent(sf)}`);
    _lookupCache[key]=Array.isArray(vals)?vals:[];
  }
  return _lookupCache[key];
}

// buildFieldHtml devolve {html, setup} â€” setup() deve ser chamado DEPOIS de innerHTML ser escrito
async function buildFieldHtml(f, val=''){
  const safeId=`field_${f.k.replace(/[^a-zA-Z0-9]/g,'_')}`;
  let inner='';
  if(f.t==='textarea'){
    inner=`<textarea id="${safeId}">${val}</textarea>`;
  } else if(f.t==='select'){
    inner=`<select id="${safeId}">${(f.opts||[]).map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select>`;
  } else if(f.t==='lookup'){
    const opts=await getLookup(f.src,f.sf);
    const dlId=`dl_${safeId}`;
    const optsHtml=opts.map(o=>`<option value="${o.replace(/"/g,'&quot;')}">`).join('');
    inner=`<input type="text" id="${safeId}" value="${String(val).replace(/"/g,'&quot;')}" list="${dlId}" autocomplete="off" placeholder="Escrever para pesquisar...">
           <datalist id="${dlId}">${optsHtml}</datalist>`;
  } else {
    inner=`<input type="${f.t||'text'}" id="${safeId}" value="${String(val).replace(/"/g,'&quot;')}">`;
  }

  let html='', setup=null;

  // showIf: campo condicional (ex: Tipo ConversÃ£o sÃ³ aparece quando Resultado=Ganho)
  if(f.showIf){
    const depId  = `field_${f.showIf.k.replace(/[^a-zA-Z0-9]/g,'_')}`;
    const wrapId = `wrap_${safeId}`;
    const showVal= f.showIf.v;
    const isVisible = !!(val && val!=='');
    html = `<div class="form-group" id="${wrapId}" style="${isVisible?'':'display:none'}"><label>${f.k}</label>${inner}</div>`;
    setup = ()=>{
      const dep =document.getElementById(depId);
      const wrap=document.getElementById(wrapId);
      if(!dep||!wrap) return;
      const upd=()=>{ wrap.style.display = dep.value===showVal ? '' : 'none'; };
      dep.addEventListener('change', upd);
      upd(); // avaliar estado actual
    };
    return {html, setup};
  }

  // fills: auto-preenchimento de outro campo ao mudar este
  if(f.fills && f.fills.length){
    setup = ()=>{
      const inp=document.getElementById(safeId);
      if(!inp) return;
      inp.addEventListener('change', ()=>{
        f.fills.forEach(fl=>{
          const tgtId=`field_${fl.tf.replace(/[^a-zA-Z0-9]/g,'_')}`;
          fetch(`/api/autofill?src=${encodeURIComponent(fl.src)}&match_field=${encodeURIComponent(fl.mf)}&return_field=${encodeURIComponent(fl.rf)}&match_val=${encodeURIComponent(inp.value)}`)
            .then(r=>r.json()).then(r=>{
              const tgt=document.getElementById(tgtId);
              if(tgt && r.value!=null && !tgt.value) tgt.value=r.value;
            });
        });
      });
    };
  }

  html = `<div class="form-group"><label>${f.k}</label>${inner}</div>`;
  return {html, setup};
}

// Aplica todos os setups apÃ³s render do modal
function runFieldSetups(setups){ setups.forEach(fn=>fn&&fn()); }

function getFieldValue(f){
  const safeId=`field_${f.k.replace(/[^a-zA-Z0-9]/g,'_')}`;
  const el=document.getElementById(safeId);
  return el?el.value:'';
}

async function openAdd(section){
  const sec=SECTIONS[section];
  if(!sec||!sec.fields) return toast('SecÃ§Ã£o sem campos definidos','error');
  document.getElementById('modalTitle').textContent='Adicionar â€” '+sec.title;
  document.getElementById('modalBody').innerHTML='<div style="color:var(--text-muted);padding:20px 0">A carregar campos...</div>';
  document.getElementById('modal').classList.add('show');

  let html=''; const setups=[];
  for(const f of sec.fields){const r=await buildFieldHtml(f,'');html+=r.html;if(r.setup)setups.push(r.setup);}
  document.getElementById('modalBody').innerHTML=html;
  runFieldSetups(setups);

  document.getElementById('modalSave').onclick=async()=>{
    const rec={};
    for(const f of sec.fields) rec[f.k]=getFieldValue(f);
    const res=await api(`/api/data/${section}`,{method:'POST',body:rec});
    _lookupCache[`${section}.`+'x']=null;
    sectionData[section]=null;
    closeModal();
    await renderDataPage(document.getElementById('mainContent'),section);
    if(res.extra){
      const e=res.extra;
      if(e.criado==='parceiro')      toast(`âœ… Registo adicionado Â· Parceiro "${e.nome}" criado`);
      else if(e.criado==='cliente')  toast(`âœ… Registo adicionado Â· Cliente "${e.nome}" criado`);
      else if(e.criado==='existia')  toast(`âœ… Registo adicionado Â· ${e.tipo} "${e.nome}" jÃ¡ existia`);
      else toast('Registo adicionado');
    } else { toast('Registo adicionado'); }
  };
}

async function openEdit(section,idx){
  const sec=SECTIONS[section];
  const data=sectionData[section];
  if(!data||!data[idx]) return;
  const rec=data[idx];
  const fields=sec?.fields||Object.keys(rec).filter(k=>k!=='_id').map(k=>({k,t:'text'}));

  document.getElementById('modalTitle').textContent='Editar â€” '+(sec?.title||section);
  document.getElementById('modalBody').innerHTML='<div style="color:var(--text-muted);padding:20px 0">A carregar campos...</div>';
  document.getElementById('modal').classList.add('show');

  let html=''; const setups=[];
  for(const f of fields){const r=await buildFieldHtml(f,rec[f.k]??'');html+=r.html;if(r.setup)setups.push(r.setup);}
  document.getElementById('modalBody').innerHTML=html;
  runFieldSetups(setups);

  document.getElementById('modalSave').onclick=async()=>{
    const updates={};
    for(const f of fields) updates[f.k]=getFieldValue(f);
    await api(`/api/data/${section}/${idx}`,{method:'PUT',body:updates});
    sectionData[section]=null;
    closeModal();
    await renderDataPage(document.getElementById('mainContent'),section);
    toast('Registo atualizado');
  };
}

async function deleteRec(section,idx){
  if(!confirm('Eliminar este registo?')) return;
  await api(`/api/data/${section}/${idx}`,{method:'DELETE'});
  sectionData[section]=null;
  await renderDataPage(document.getElementById('mainContent'),section);
  toast('Registo eliminado');
}

// BACKOFFICE
async function renderBackoffice(el){
  const users=await api('/api/users');
  const perms=await api('/api/permissions');
  if(users.error){el.innerHTML='<p style="color:var(--danger)">Sem acesso</p>';return;}
  let usersHtml='';
  for(const u of users){
    usersHtml+=`<tr>
      <td>${u.id}</td><td>${u.username}</td><td>${u.name}</td><td>${u.role}</td>
      <td><span style="color:${u.active?'var(--success)':'var(--danger)'}">${u.active?'Ativo':'Inativo'}</span></td>
      <td class="actions">
        <button onclick="editUser(${u.id})" title="Editar">&#x270F;</button>
        <button class="del" onclick="removeUser(${u.id})" title="Eliminar">&#x1f5d1;</button>
      </td></tr>`;
  }
  const roles=Object.keys(perms);
  const allCollections=Object.keys(SECTIONS).filter(k=>k!=='dashboard'&&k!=='backoffice');
  let rolesTabsHtml=roles.map((r,i)=>`<span class="role-tab ${i===0?'active':''}" onclick="switchPermTab('${r}',this)">${r}</span>`).join('');
  let permPanels='';
  for(const role of roles){
    const rp=perms[role]||[];
    permPanels+=`<div class="perm-panel" id="perm_${role}" style="${role!==roles[0]?'display:none':''}"><div class="perm-grid">`;
    for(const c of allCollections){
      const s=SECTIONS[c];
      permPanels+=`<label class="perm-item"><input type="checkbox" data-role="${role}" data-col="${c}" ${rp.includes(c)?'checked':''}> ${s?s.title:c}</label>`;
    }
    permPanels+='</div></div>';
  }
  el.innerHTML=`
    <div class="page-header"><div><h1>&#x2699; Backoffice</h1><div class="subtitle">Gestao de utilizadores e permissoes</div></div></div>
    <h3 style="margin-bottom:16px">Utilizadores</h3>
    <div class="table-wrap" style="margin-bottom:32px">
      <div class="table-toolbar"><strong>Utilizadores</strong><span style="margin-left:auto"><button class="btn btn-primary btn-sm" onclick="addUserModal()">+ Novo Utilizador</button></span></div>
      <table class="tbl"><thead><tr><th>ID</th><th>Username</th><th>Nome</th><th>Role</th><th>Estado</th><th>Acoes</th></tr></thead>
      <tbody>${usersHtml}</tbody></table>
    </div>
    <h3 style="margin-bottom:16px">Permissoes por Role</h3>
    <div style="margin-bottom:12px">${rolesTabsHtml}</div>
    ${permPanels}
    <button class="btn btn-primary" style="margin-top:16px" onclick="savePermissions()">Guardar Permissoes</button>`;
}

function switchPermTab(role,tabEl){
  document.querySelectorAll('.role-tab').forEach(t=>t.classList.remove('active'));
  tabEl.classList.add('active');
  document.querySelectorAll('.perm-panel').forEach(p=>p.style.display='none');
  document.getElementById('perm_'+role).style.display='';
}

async function savePermissions(){
  const perms={};
  document.querySelectorAll('.perm-item input[type=checkbox]').forEach(cb=>{
    const role=cb.dataset.role, col=cb.dataset.col;
    if(!perms[role]) perms[role]=[];
    if(cb.checked) perms[role].push(col);
  });
  if(perms['Admin']&&!perms['Admin'].includes('backoffice')) perms['Admin'].push('backoffice');
  await api('/api/permissions',{method:'PUT',body:perms});
  toast('Permissoes guardadas');
}

function addUserModal(){
  document.getElementById('modalTitle').textContent='Novo Utilizador';
  document.getElementById('modalBody').innerHTML=`
    <div class="form-group"><label>Username</label><input type="text" id="field_username"></div>
    <div class="form-group"><label>Nome</label><input type="text" id="field_name"></div>
    <div class="form-group"><label>Password</label><input type="password" id="field_password"></div>
    <div class="form-group"><label>Role</label><select id="field_role">
      <option>Admin</option><option>Comercial</option><option>Coordenador</option><option>Tecnico</option><option>Direccao</option>
    </select></div>`;
  document.getElementById('modalSave').onclick=async()=>{
    const u={username:document.getElementById('field_username').value,name:document.getElementById('field_name').value,
      password:document.getElementById('field_password').value,role:document.getElementById('field_role').value};
    await api('/api/users',{method:'POST',body:u});
    closeModal();renderBackoffice(document.getElementById('mainContent'));
    toast('Utilizador criado');
  };
  document.getElementById('modal').classList.add('show');
}

async function editUser(uid){
  const users=await api('/api/users');
  const u=users.find(x=>x.id===uid);
  if(!u) return;
  document.getElementById('modalTitle').textContent='Editar Utilizador';
  document.getElementById('modalBody').innerHTML=`
    <div class="form-group"><label>Username</label><input type="text" id="field_username" value="${u.username}"></div>
    <div class="form-group"><label>Nome</label><input type="text" id="field_name" value="${u.name}"></div>
    <div class="form-group"><label>Password</label><input type="password" id="field_password" value="${u.password}" placeholder="Manter atual"></div>
    <div class="form-group"><label>Role</label><select id="field_role">
      ${['Admin','Comercial','Coordenador','Tecnico','Direccao'].map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>Ativo</label><select id="field_active"><option value="true" ${u.active?'selected':''}>Sim</option><option value="false" ${!u.active?'selected':''}>Nao</option></select></div>`;
  document.getElementById('modalSave').onclick=async()=>{
    const updates={username:document.getElementById('field_username').value,name:document.getElementById('field_name').value,
      password:document.getElementById('field_password').value,role:document.getElementById('field_role').value,
      active:document.getElementById('field_active').value==='true'};
    await api(`/api/users/${uid}`,{method:'PUT',body:updates});
    closeModal();renderBackoffice(document.getElementById('mainContent'));
    toast('Utilizador atualizado');
  };
  document.getElementById('modal').classList.add('show');
}

async function removeUser(uid){
  if(!confirm('Eliminar este utilizador?')) return;
  await api(`/api/users/${uid}`,{method:'DELETE'});
  renderBackoffice(document.getElementById('mainContent'));
  toast('Utilizador eliminado');
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PÃGINA DE DETALHE DO CLIENTE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function statusClass(s){
  if(!s) return 'sem';
  const l=s.toLowerCase();
  if(l.includes('cancelado')) return 'cancelado';
  if(l.includes('suspenso')) return 'suspenso';
  if(l.startsWith('ativo')||l.startsWith('hÃ­brido ativo')) return 'ativo';
  if(l.includes('avaliaÃ§Ã£o')) return 'ativo'; // Ativo (AvaliaÃ§Ã£o)
  return 'sem';
}

// Renderiza o status como badge(s): estado base + aviso separado se existir
function renderStatusBadges(s){
  if(!s) return `<span class="cd-status sem">Sem estado</span>`;
  const parts = s.split(' Â· ');
  const base = parts[0];
  const aviso = parts[1]||null;
  const baseClass = statusClass(base);
  let html = `<span class="cd-status ${baseClass}">${base}</span>`;
  if(aviso){
    html += ` <span class="cd-status alerta" style="margin-left:6px">${aviso}</span>`;
  }
  return html;
}

function fmtDate(d){
  if(!d) return 'â€”';
  const s=String(d).replace('T',' ').substring(0,16);
  return s||'â€”';
}

function pagBadge(v){
  if(!v||v==='â€”') return `<span class="badge badge-info">â€”</span>`;
  if(v.includes('âœ…')) return `<span class="badge badge-ok">${v}</span>`;
  if(v.includes('âš ï¸')) return `<span class="badge badge-warn">${v}</span>`;
  if(v.includes('ðŸ”´')) return `<span class="badge badge-err">${v}</span>`;
  return `<span class="badge badge-info">${v}</span>`;
}

async function openClienteDetalhe(nome){
  const el=document.getElementById('mainContent');
  el.innerHTML=`<div style="padding:40px;color:var(--text-muted);text-align:center">A carregar ficha de ${nome}...</div>`;
  const d=await api(`/api/cliente/${encodeURIComponent(nome)}`);
  if(d.error){el.innerHTML=`<p style="color:var(--danger)">${d.error}</p>`;return;}
  renderClienteDetalhe(el, nome, d);
}

function renderClienteDetalhe(el, nome, d){
  const info=d.info||{};
  const sc=statusClass(info.Status);

  // ServiÃ§os activos (excluir ConcluÃ­dos)
  const servicosAtivos = (d.servicos||[]).filter(s=>{
    const e=(s['Estado do serviÃ§o']||'').trim();
    return e!=='ConcluÃ­do' && e!=='Concluido';
  });

  // KPIs rÃ¡pidos
  const mesAtualIdx=new Date().getMonth(); // 0-based (Jan=0)
  const MESES_S=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const temMotor = !!d.motor;
  const temPag26 = !!(d.pag_2026&&d.pag_2026.length);

  const totalPago    = (d.pag_2026||[]).reduce((s,p)=>s+(parseFloat(p['Valor Pago'])||0),0);
  const totalPendente= (d.pag_2026||[]).filter(p=>p['_Estado_Pag']&&p['_Estado_Pag'].includes('ðŸ”´')).length;
  const motorTotal   = temMotor ? MESES_S.reduce((s,m)=>s+(parseFloat(d.motor[m])||0),0) : 0;
  // Meses passados (incl. actual) sem registo manual â€” sÃ³ quando nÃ£o hÃ¡ pag_2026
  const motorPendentes = !temPag26 && temMotor
    ? MESES_S.slice(0,mesAtualIdx+1).filter(m=>d.motor[m]&&d.motor[m]>0).length : 0;

  // Contagens reais para os badges das tabs
  const nServicos = servicosAtivos.length + (temMotor ? 1 : 0);
  const nAvals    = (d.avaliacoes||[]).length;
  const nPag26    = temPag26 ? d.pag_2026.length
                  : temMotor ? MESES_S.filter(m=>d.motor[m]&&d.motor[m]>0).length : 0;
  const nPag25    = (d.pag_2025||[]).length;
  const nContratos= (d.log_contratos||[]).length;
  const nHistorico= (d.historico||[]).length;

  // Sidebar info
  const infoRows = [
    ['Email',           info['Email']||'â€”'],
    ['TelemÃ³vel',       info['TelemÃ³vel']||'â€”'],
    ['NIF',             info['NIF']||'â€”'],
    ['Localidade',      info['Localidade']||'â€”'],
    ['Segmento',        info['Segmento']||'â€”'],
    ['PT',              info['PT']||'â€”'],
    ['Nutricionista',   info['Nutricionista']||'â€”'],
    ['MÃ©todo Pag.',     info['MÃ©todo Pagamento']||'â€”'],
    ['Ãšltimo Contacto', info['Ãšltimo Contacto'] ? `${info['Ãšltimo Contacto'].substring(0,10)} (${info['Dias s/ Contacto']} dias)` : 'â€”'],
    ['Data CriaÃ§Ã£o',    info['Data CriaÃ§Ã£o'] ? info['Data CriaÃ§Ã£o'].substring(0,10) : 'â€”'],
    ['ComentÃ¡rios',     info['ComentÃ¡rios']||'â€”'],
  ].map(([l,v])=>`<div class="cd-info-row"><span class="lbl">${l}</span><span class="val">${v}</span></div>`).join('');

  // Helper: cabeÃ§alho de tab com botÃ£o de acÃ§Ã£o
  const nomeEsc=nome.replace(/'/g,"\\'");
  function tabHeader(label, section){
    return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <span style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">${label}</span>
      <button class="btn btn-primary btn-sm" onclick="openAddParaCliente('${section}','${nomeEsc}')">+ Adicionar</button>
    </div>`;
  }

  // Tab: ServiÃ§os (sÃ³ activos / pendentes + plano motor)
  function estadoServBadge(e){
    if(!e||e==='â€”') return `<span class="badge" style="background:rgba(148,163,184,.1);color:var(--text-muted)">â€”</span>`;
    if(e==='Em curso') return `<span class="badge badge-ok">Em curso</span>`;
    if(e==='Pendente') return `<span class="badge badge-warn">Pendente</span>`;
    if(e==='Suspenso') return `<span class="badge badge-err">Suspenso</span>`;
    return `<span class="badge badge-info">${e}</span>`;
  }
  function estadoMotorBadge(e){
    if(e==='Ativo') return `<span class="badge badge-ok">Ativo</span>`;
    if(e==='Suspenso') return `<span class="badge badge-err">Suspenso</span>`;
    if(e==='Cancelado') return `<span class="badge" style="background:rgba(148,163,184,.1);color:var(--text-muted)">Cancelado</span>`;
    return `<span class="badge badge-info">${e||'â€”'}</span>`;
  }
  // Plano Motor (linha extra no topo se existir)
  const motorRow = d.motor
    ? `<tr style="background:rgba(99,102,241,.05)">
        <td>${estadoMotorBadge(d.motor['Estado Hoje'])}</td>
        <td><strong>${d.motor['Plano Actual']||'â€”'}</strong> <span style="font-size:10px;color:var(--text-muted)">(Motor)</span></td>
        <td>â€”</td>
        <td>${info['PT']||'â€”'}</td>
        <td>${fmtDate(d.motor['Data InÃ­cio'])}</td>
        <td>${d.motor['Total 2026']?d.motor['Total 2026']+'â‚¬/ano':'â€”'}</td>
      </tr>` : '';
  const servsRows = servicosAtivos.map(s=>{
    const btnDel = s['_idx']!=null
      ? `<button onclick="deleteDetalhe('servicos',${s['_idx']},'${nomeEsc}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:13px" title="Eliminar" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'">ðŸ—‘ï¸</button>` : '';
    return `<tr>
      <td>${estadoServBadge(s['Estado do serviÃ§o'])}</td>
      <td>${s['ServiÃ§o']||'â€”'}</td>
      <td>${s['CÃ³digo']||'â€”'}</td>
      <td>${s['TÃ©cnico ResponsÃ¡vel']||'â€”'}</td>
      <td>${fmtDate(s['Data ConversÃ£o'])}</td>
      <td>${s['Ciclo']||'â€”'}</td>
      <td>${btnDel}</td>
    </tr>`;
  }).join('');
  const servsTable = (motorRow||servsRows)
    ? `<table class="mini-table"><thead><tr><th>Estado</th><th>ServiÃ§o / Plano</th><th>CÃ³digo</th><th>TÃ©cnico</th><th>InÃ­cio</th><th>Ciclo / Total</th><th></th></tr></thead><tbody>
       ${motorRow}${servsRows}
       </tbody></table>`
    : `<div class="tl-empty">Sem serviÃ§os activos</div>`;
  const servsHtml=tabHeader('ServiÃ§os activos','servicos')+servsTable;

  // Tab: AvaliaÃ§Ãµes
  function avalBadge(status){
    if(!status||status==='â€”') return 'â€”';
    if(status.includes('VÃ¡lida'))   return `<span class="badge badge-ok">${status}</span>`;
    if(status.includes('Expirada')) return `<span class="badge badge-err">${status}</span>`;
    if(status.includes('Em falta')) return `<span class="badge badge-warn">${status}</span>`;
    if(status.includes('Hoje'))     return `<span class="badge badge-info">${status}</span>`;
    if(status.includes('Em breve')) return `<span class="badge badge-warn">${status}</span>`;
    if(status.includes('Agendada')) return `<span class="badge badge-info">${status}</span>`;
    return `<span class="badge badge-info">${status}</span>`;
  }
  // Ordenar avaliaÃ§Ãµes: mais recente primeiro
  const avalsOrdenadas = [...(d.avaliacoes||[])].sort((a,b)=>{
    const da = a['Data']||'', db = b['Data']||'';
    return db.localeCompare(da);
  });
  const avalsTable = avalsOrdenadas.length
    ? `<table class="mini-table"><thead><tr><th>Estado</th><th>ServiÃ§o</th><th>Data</th><th>Dias desde</th><th>TÃ©cnico</th><th>NÃ­vel</th><th></th></tr></thead><tbody>
       ${avalsOrdenadas.map(a=>{
         const status = a['_Status_Aval']||'';
         const expirada = status.includes('Expirada');
         const valida   = status.includes('VÃ¡lida');
         const rowStyle = expirada ? 'background:rgba(239,68,68,.05)' : valida ? 'background:rgba(34,197,94,.04)' : '';
         const diasDesde = a['_AvalDiasDesde']!=null ? `${a['_AvalDiasDesde']} dias` : (a['Dias para AvaliaÃ§Ã£o']!=null&&a['Dias para AvaliaÃ§Ã£o']<0 ? `em ${Math.abs(a['Dias para AvaliaÃ§Ã£o'])} dias` : 'â€”');
         const fonteTag = a['_fonte'] ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px">(${a['_fonte']})</span>` : '';
         const col = a['_colecao']||'avaliacoes';
         const btnDel = a['_idx']!=null
           ? `<button onclick="deleteDetalhe('${col}',${a['_idx']},'${nomeEsc}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:13px" title="Eliminar" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'">ðŸ—‘ï¸</button>` : '';
         return `<tr style="${rowStyle}">
           <td>${avalBadge(status)}</td>
           <td>${a['ServiÃ§o']||'â€”'}${fonteTag}</td>
           <td>${fmtDate(a['Data'])}</td>
           <td>${diasDesde}</td>
           <td>${a['TÃ©cnico ResponsÃ¡vel']||'â€”'}</td>
           <td>${a['NÃ­vel']||'â€”'}</td>
           <td>${btnDel}</td>
         </tr>`;
       }).join('')}
       </tbody></table>`
    : `<div class="tl-empty">Sem avaliaÃ§Ãµes registadas</div>`;
  const avalsHtml=tabHeader('AvaliaÃ§Ãµes','avaliacoes')+avalsTable;

  // Tab: Pagamentos 2026
  const MESES_PT=['Janeiro','Fevereiro','MarÃ§o','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MESES_SHORT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  let pag26Table='';
  if(d.pag_2026&&d.pag_2026.length){
    // Registos reais em pag_clientes_2026
    pag26Table=`<table class="mini-table"><thead><tr><th>MÃªs</th><th>Modalidade</th><th>A Pagar</th><th>Pago</th><th>Estado</th><th>Forma</th><th>Doc</th></tr></thead><tbody>
      ${d.pag_2026.map(p=>`<tr>
        <td>${p['MÃªs']||'â€”'}</td><td>${p['Modalidade']||'â€”'}</td>
        <td>${p['Valor a Pagar']??'â€”'}â‚¬</td><td>${p['Valor Pago']??'â€”'}â‚¬</td>
        <td>${pagBadge(p['_Estado_Pag'])}</td>
        <td>${p['Forma Pagamento']||'â€”'}</td><td>${p['NÂº Doc']||'â€”'}</td>
      </tr>`).join('')}
      </tbody></table>`;
  } else if(d.motor){
    // Sem registos manuais â€” mostrar plano motor como referÃªncia
    const hoje=new Date(); const mesAtual=hoje.getMonth(); // 0-based
    const motorRows=MESES_SHORT.map((ms,i)=>{
      const val=d.motor[ms];
      if(!val&&val!==0) return '';
      const passado=i<mesAtual, atual=i===mesAtual;
      const rowStyle=atual?'background:rgba(99,102,241,.08)':'';
      const badge=passado
        ? `<span class="badge badge-warn">âš ï¸ Sem registo</span>`
        : atual
          ? `<span class="badge badge-info">MÃªs actual</span>`
          : `<span class="badge" style="background:rgba(148,163,184,.1);color:var(--text-muted)">Futuro</span>`;
      return `<tr style="${rowStyle}">
        <td>${MESES_PT[i]}</td>
        <td>${d.motor['Plano Actual']||'â€”'}</td>
        <td>${val}â‚¬</td>
        <td>â€”</td>
        <td>${badge}</td>
        <td>â€”</td><td>â€”</td>
      </tr>`;
    }).filter(Boolean).join('');
    pag26Table=`<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;padding:8px 10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:6px">
      âš ï¸ Sem registos manuais em Pagamentos 2026. A mostrar plano do Motor como referÃªncia.
    </div>
    <table class="mini-table"><thead><tr><th>MÃªs</th><th>Plano</th><th>Esperado</th><th>Pago</th><th>Estado</th><th>Forma</th><th>Doc</th></tr></thead><tbody>
      ${motorRows}
    </tbody></table>`;
  } else {
    pag26Table=`<div class="tl-empty">Sem pagamentos em 2026</div>`;
  }
  const pag26Html=tabHeader('Pagamentos 2026','pag_clientes_2026')+pag26Table;

  // Tab: Pagamentos 2025
  const pag25Table = d.pag_2025&&d.pag_2025.length
    ? `<table class="mini-table"><thead><tr><th>MÃªs</th><th>Modalidade</th><th>A Pagar</th><th>Pago</th><th>Estado</th><th>Forma</th></tr></thead><tbody>
       ${d.pag_2025.map(p=>`<tr>
         <td>${p['MÃªs']||'â€”'}</td><td>${p['Modalidade']||'â€”'}</td>
         <td>${p['Valor a Pagar']??'â€”'}â‚¬</td><td>${p['Valor Pago']??'â€”'}â‚¬</td>
         <td>${pagBadge(p['_Estado_Pag'])}</td>
         <td>${p['Forma Pagamento']||'â€”'}</td>
       </tr>`).join('')}
       </tbody></table>`
    : `<div class="tl-empty">Sem pagamentos em 2025</div>`;
  const pag25Html=tabHeader('Pagamentos 2025','pag_clientes_2025')+pag25Table;

  // Tab: Contratos
  const contratoTable = d.log_contratos&&d.log_contratos.length
    ? `<table class="mini-table"><thead><tr><th>Data</th><th>Estado</th><th>Motivo</th><th>Data Fim</th><th>Por</th><th>Notas</th><th></th></tr></thead><tbody>
       ${d.log_contratos.map(c=>{
         const btnDel = c['_idx']!=null
           ? `<button onclick="deleteDetalhe('log_contratos',${c['_idx']},'${nomeEsc}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:13px" title="Eliminar" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'">ðŸ—‘ï¸</button>` : '';
         return `<tr><td>${fmtDate(c['Data InÃ­cio'])}</td><td><span class="badge badge-warn">${c['Estado']||'â€”'}</span></td><td>${c['Motivo']||'â€”'}</td><td>${fmtDate(c['Data Fim'])}</td><td>${c['Registado por']||'â€”'}</td><td>${c['Notas']||'â€”'}</td><td>${btnDel}</td></tr>`;
       }).join('')}
       </tbody></table>`
    : `<div class="tl-empty">Sem alteraÃ§Ãµes de contrato</div>`;
  const contratoHtml=tabHeader('AlteraÃ§Ãµes de Contrato','log_contratos')+contratoTable;

  // Tab: HistÃ³rico timeline
  const histHeader=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <span style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">HistÃ³rico de atividade</span>
    <button class="btn btn-ghost btn-sm" onclick="openAddParaCliente('log_comercial','${nomeEsc}')">ðŸ“ž Registar contacto</button>
  </div>`;
  const histHtml = histHeader+(d.historico&&d.historico.length
    ? `<div class="timeline">${d.historico.map(h=>`
        <div class="tl-item">
          <div class="tl-icon">${h.icon||'ðŸ“Œ'}</div>
          <div class="tl-body">
            <div class="tl-top">
              <span class="tl-tipo">${h.tipo}</span>
              <span class="tl-meta">${fmtDate(h.timestamp)} Â· ${h.utilizador}</span>
            </div>
            <div class="tl-desc">${h.descricao||''}</div>
          </div>
        </div>`).join('')}
      </div>`
    : `<div class="tl-empty">Sem histÃ³rico registado ainda.<br><small>As alteraÃ§Ãµes futuras aparecerÃ£o aqui automaticamente.</small></div>`);

  el.innerHTML=`
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="navigate('clientes')" style="font-size:18px;padding:6px 10px">â†</button>
        <div>
          <h1 class="cd-name">${nome}</h1>
          <div style="margin-top:6px">${renderStatusBadges(info.Status)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="openClienteEdit('${nome.replace(/'/g,"\\'")}')">âœï¸ Editar ficha</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <div class="stat-card"><div class="label">ServiÃ§os activos</div><div class="value blue">${nServicos}</div></div>
      <div class="stat-card"><div class="label">AvaliaÃ§Ãµes</div><div class="value green">${nAvals}</div></div>
      <div class="stat-card"><div class="label">Total pago 2026</div><div class="value purple">${totalPago>0?totalPago.toFixed(0)+'â‚¬':motorTotal>0?motorTotal.toFixed(0)+'â‚¬ (plano)':'0â‚¬'}</div></div>
      <div class="stat-card"><div class="label">Pagamentos s/ registo</div><div class="value amber">${totalPendente||motorPendentes}</div></div>
    </div>

    <div class="cd-wrap">
      <div class="cd-sidebar">
        <div class="cd-card"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px;font-weight:700">InformaÃ§Ã£o</div>${infoRows}</div>
      </div>
      <div class="cd-main">
        <div class="tabs">
          <div class="tab active" onclick="switchTab(this,'tab-servicos')">ðŸ’ª ServiÃ§os (${nServicos})</div>
          <div class="tab" onclick="switchTab(this,'tab-avaliacoes')">ðŸ“‹ AvaliaÃ§Ãµes (${nAvals})</div>
          <div class="tab" onclick="switchTab(this,'tab-pag26')">ðŸ’³ Pagamentos 2026 (${nPag26})</div>
          <div class="tab" onclick="switchTab(this,'tab-pag25')">ðŸ’³ Pagamentos 2025 (${nPag25})</div>
          <div class="tab" onclick="switchTab(this,'tab-contratos')">ðŸ“ Contratos (${nContratos})</div>
          <div class="tab" onclick="switchTab(this,'tab-historico')">ðŸ• HistÃ³rico (${nHistorico})</div>
        </div>
        <div id="tab-servicos"   class="tab-panel active">${servsHtml}</div>
        <div id="tab-avaliacoes" class="tab-panel">${avalsHtml}</div>
        <div id="tab-pag26"      class="tab-panel">${pag26Html}</div>
        <div id="tab-pag25"      class="tab-panel">${pag25Html}</div>
        <div id="tab-contratos"  class="tab-panel">${contratoHtml}</div>
        <div id="tab-historico"  class="tab-panel">${histHtml}</div>
      </div>
    </div>`;
}

function switchTab(el, panelId){
  el.closest('.cd-main').querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.closest('.cd-main').querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(panelId).classList.add('active');
}

async function openClienteEdit(nome){
  const clientes=sectionData['clientes']||await api('/api/data/clientes');
  const idx=clientes.findIndex(c=>c['Nome']===nome);
  if(idx===-1) return toast('Cliente nÃ£o encontrado','error');
  sectionData['clientes']=clientes;
  await openEdit('clientes',idx);
  // ApÃ³s guardar, recarregar a pÃ¡gina do cliente
  const origSave=document.getElementById('modalSave').onclick;
  document.getElementById('modalSave').onclick=async()=>{
    await origSave();
    await openClienteDetalhe(nome);
  };
}

// Campo de cliente por secÃ§Ã£o
const CLIENT_FIELD_JS={
  conversoes:'Cliente', servicos:'Cliente', avaliacoes:'Nome',
  pag_clientes_2026:'Cliente', pag_clientes_2025:'Cliente',
  log_contratos:'Cliente', log_comercial:'Contacto',
};

async function deleteDetalhe(colecao, idx, clienteNome){
  if(!confirm('Eliminar este registo?')) return;
  await api(`/api/data/${colecao}/${idx}`,{method:'DELETE'});
  sectionData[colecao]=null;
  toast('Registo eliminado');
  await openClienteDetalhe(clienteNome);
}

async function openAddParaCliente(section, clienteNome){
  const sec=SECTIONS[section];
  if(!sec||!sec.fields) return toast('SecÃ§Ã£o sem campos definidos','error');
  const clientField=CLIENT_FIELD_JS[section];
  const safeNome=clienteNome.replace(/'/g,"\\'").replace(/"/g,'&quot;');

  document.getElementById('modalTitle').textContent='Adicionar â€” '+sec.title;
  document.getElementById('modalBody').innerHTML='<div style="color:var(--text-muted);padding:20px 0">A carregar campos...</div>';
  document.getElementById('modal').classList.add('show');

  let html=''; const setups=[];
  for(const f of sec.fields){
    if(f.k===clientField){
      // Campo cliente: prÃ©-preenchido e bloqueado
      const safeId='field_'+f.k.replace(/[^a-zA-Z0-9]/g,'_');
      html+=`<div class="form-group">
        <label>${f.k}</label>
        <input type="text" id="${safeId}" value="${clienteNome}" readonly style="opacity:.65;cursor:not-allowed;border-style:dashed">
      </div>`;
    } else {
      const r=await buildFieldHtml(f,''); html+=r.html; if(r.setup) setups.push(r.setup);
    }
  }
  document.getElementById('modalBody').innerHTML=html;
  runFieldSetups(setups);

  document.getElementById('modalSave').onclick=async()=>{
    const rec={};
    for(const f of sec.fields) rec[f.k]=getFieldValue(f);
    await api(`/api/data/${section}`,{method:'POST',body:rec});
    sectionData[section]=null;
    closeModal();
    toast('Registo adicionado');
    await openClienteDetalhe(clienteNome);
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PÃGINA DE DETALHE DO ON (Pipeline)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function onStatusBadge(s){
  if(!s||s==='â€”') return `<span class="badge" style="background:rgba(148,163,184,.1);color:var(--text-muted)">â€”</span>`;
  const l=s.toLowerCase();
  if(l.includes('ganho')||l.includes('convertido')) return `<span class="badge badge-ok">${s}</span>`;
  if(l.includes('perdido')||l.includes('nÃ£o avanÃ§ou')) return `<span class="badge badge-err">${s}</span>`;
  if(l.includes('agendado')) return `<span class="badge badge-info">${s}</span>`;
  if(l.includes('em anÃ¡lise')||l.includes('pendente')) return `<span class="badge badge-warn">${s}</span>`;
  return `<span class="badge badge-info">${s}</span>`;
}

function resultadoBadge(r){
  if(!r) return 'â€”';
  const l=r.toLowerCase();
  if(l.includes('ganho')||l.includes('convertido')) return `<span class="badge badge-ok">${r}</span>`;
  if(l.includes('perdido')||l.includes('nÃ£o avanÃ§ou')) return `<span class="badge badge-err">${r}</span>`;
  if(l.includes('agendado')) return `<span class="badge badge-info">${r}</span>`;
  if(l.includes('sem resposta')) return `<span class="badge" style="background:rgba(148,163,184,.1);color:var(--text-muted)">${r}</span>`;
  return `<span class="badge badge-warn">${r}</span>`;
}

async function openONDetalhe(nON){
  const el=document.getElementById('mainContent');
  el.innerHTML=`<div style="padding:40px;color:var(--text-muted);text-align:center">A carregar ON ${nON}...</div>`;
  const d=await api(`/api/on/${nON}`);
  if(d.error){el.innerHTML=`<p style="color:var(--danger)">${d.error}</p>`;return;}
  renderONDetalhe(el, nON, d);
}

function renderONDetalhe(el, nON, d){
  const info=d.info||{};
  const log=d.log_comercial||[];
  const hist=d.historico||[];
  const contacto=info['Contacto']||'';
  const nONEsc=String(nON);
  const contactoEsc=contacto.replace(/'/g,"\\'");

  // Status do ON (da Ãºltima entrada do log ou Em AnÃ¡lise)
  const ultimoResultado=log.length ? (log[0]['Resultado']||'Em AnÃ¡lise') : (info['Status']||'Em AnÃ¡lise');
  const fechado=info['Aberta/Fechada']==='Fechada';

  // KPIs
  const nContactos=log.length;
  const ultimaData=log.length ? (log[0]['Data AÃ§Ã£o']||'').substring(0,10) : 'â€”';
  const diasAberto = info['Data InÃ­cio']
    ? Math.floor((new Date()-new Date(info['Data InÃ­cio']))/86400000) : 'â€”';

  // Info lateral
  const infoRows=[
    ['Tipo',          info['Tipo']||'â€”'],
    ['Comercial',     info['Comercial']||'â€”'],
    ['Fonte',         info['Fonte AquisiÃ§Ã£o']||'â€”'],
    ['Canal',         info['Canal Contacto']||'â€”'],
    ['Parceiro',      info['Parceiro']||'â€”'],
    ['Segmento',      info['Segmento Mercado']||'â€”'],
    ['Aberta/Fechada',info['Aberta/Fechada']||'â€”'],
  ].map(([l,v])=>`<div class="cd-info-row"><span class="lbl">${l}</span><span class="val">${v}</span></div>`).join('');

  // Tab: Contactos (log_comercial)
  const logRows = log.map(l=>{
    const btnDel = l['_idx']!=null
      ? `<button onclick="deleteONLog('log_comercial',${l['_idx']},${nONEsc})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:13px" title="Eliminar" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'">ðŸ—‘ï¸</button>` : '';
    return `<tr>
      <td>${fmtDate(l['Data AÃ§Ã£o'])}</td>
      <td>${l['Canal']||'â€”'}</td>
      <td>${l['Tipo AÃ§Ã£o']||'â€”'}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(l['Resumo']||'').replace(/"/g,'&quot;')}">${l['Resumo']||'â€”'}</td>
      <td>${resultadoBadge(l['Resultado'])}</td>
      <td style="color:var(--text-muted);font-size:11px">${l['Dias AtrÃ¡s']!=null?l['Dias AtrÃ¡s']+'d atrÃ¡s':'â€”'}</td>
      <td>${btnDel}</td>
    </tr>`;
  }).join('');

  const logTable = log.length
    ? `<table class="mini-table"><thead><tr><th>Data</th><th>Canal</th><th>Tipo</th><th>Resumo</th><th>Resultado</th><th>HÃ¡</th><th></th></tr></thead><tbody>${logRows}</tbody></table>`
    : `<div class="tl-empty">Sem contactos registados. Clica em "+ Registar contacto" para comeÃ§ar.</div>`;

  const logHtml=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <span style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">HistÃ³rico de contactos</span>
    <button class="btn btn-primary btn-sm" onclick="openAddParaON(${nONEsc},'${contactoEsc}')">+ Registar contacto</button>
  </div>${logTable}`;

  // Tab: HistÃ³rico timeline
  const histHtml = hist.length
    ? `<div class="timeline">${hist.map(h=>`
        <div class="tl-item">
          <div class="tl-icon">${h.icon||'ðŸ“Œ'}</div>
          <div class="tl-body">
            <div class="tl-top">
              <span class="tl-tipo">${h.tipo}</span>
              <span class="tl-meta">${fmtDate(h.timestamp)} Â· ${h.utilizador}</span>
            </div>
            <div class="tl-desc">${h.descricao||''}</div>
          </div>
        </div>`).join('')}
      </div>`
    : `<div class="tl-empty">Sem histÃ³rico de sistema.</div>`;

  el.innerHTML=`
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="navigate('pipeline')" style="font-size:18px;padding:6px 10px">â†</button>
        <div>
          <h1 style="font-size:20px;font-weight:700">ON ${nON} â€” ${contacto||'(sem contacto)'}</h1>
          <div style="margin-top:6px">${onStatusBadge(ultimoResultado)}
            ${fechado?'<span class="badge badge-err" style="margin-left:6px">Fechada</span>':'<span class="badge badge-ok" style="margin-left:6px">Aberta</span>'}
          </div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openAddParaON(${nONEsc},'${contactoEsc}')">ðŸ“ž Registar contacto</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <div class="stat-card"><div class="label">Estado</div><div class="value blue" style="font-size:18px">${ultimoResultado}</div></div>
      <div class="stat-card"><div class="label">Contactos</div><div class="value green">${nContactos}</div></div>
      <div class="stat-card"><div class="label">Ãšltimo contacto</div><div class="value purple" style="font-size:16px">${ultimaData}</div></div>
      <div class="stat-card"><div class="label">Dias em aberto</div><div class="value amber">${diasAberto}</div></div>
    </div>

    <div class="cd-wrap">
      <div class="cd-sidebar">
        <div class="cd-card">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px;font-weight:700">Oportunidade</div>
          ${infoRows}
        </div>
      </div>
      <div class="cd-main">
        <div class="tabs">
          <div class="tab active" onclick="switchTab(this,'tab-on-log')">ðŸ“ž Contactos (${nContactos})</div>
          <div class="tab" onclick="switchTab(this,'tab-on-hist')">ðŸ• HistÃ³rico (${hist.length})</div>
        </div>
        <div id="tab-on-log"  class="tab-panel active">${logHtml}</div>
        <div id="tab-on-hist" class="tab-panel">${histHtml}</div>
      </div>
    </div>`;
}

async function openAddParaON(nON, contacto){
  const sec=SECTIONS['log_comercial'];
  if(!sec||!sec.fields) return toast('Campos nÃ£o definidos','error');

  document.getElementById('modalTitle').textContent=`ðŸ“ž Registar contacto â€” ON ${nON}`;
  document.getElementById('modalBody').innerHTML='<div style="color:var(--text-muted);padding:20px 0">A carregar...</div>';
  document.getElementById('modal').classList.add('show');

  let html=''; const setups=[];
  for(const f of sec.fields){
    if(f.k==='NÂº ON'){
      html+=`<div class="form-group"><label>NÂº ON</label>
        <input type="text" id="field_N__ON" value="${nON}" readonly style="opacity:.65;cursor:not-allowed;border-style:dashed">
      </div>`;
    } else if(f.k==='Contacto'){
      html+=`<div class="form-group"><label>Contacto</label>
        <input type="text" id="field_Contacto" value="${contacto}" readonly style="opacity:.65;cursor:not-allowed;border-style:dashed">
      </div>`;
    } else {
      const r=await buildFieldHtml(f,''); html+=r.html; if(r.setup) setups.push(r.setup);
    }
  }
  document.getElementById('modalBody').innerHTML=html;
  runFieldSetups(setups);

  document.getElementById('modalSave').onclick=async()=>{
    const rec={};
    for(const f of sec.fields) rec[f.k]=getFieldValue(f);
    rec['NÂº ON']=Number(nON)||nON;
    rec['Contacto']=contacto;
    const res=await api('/api/data/log_comercial',{method:'POST',body:rec});
    sectionData['log_comercial']=null;
    closeModal();
    // Feedback de conversÃ£o automÃ¡tica
    if(res.extra){
      const e=res.extra;
      if(e.criado==='parceiro')     toast(`âœ… Contacto registado Â· Parceiro "${e.nome}" criado`);
      else if(e.criado==='cliente') toast(`âœ… Contacto registado Â· Cliente "${e.nome}" criado`);
      else toast('Contacto registado');
    } else { toast('Contacto registado'); }
    await openONDetalhe(nON);
  };
}

async function deleteONLog(colecao, idx, nON){
  if(!confirm('Eliminar este contacto?')) return;
  await api(`/api/data/${colecao}/${idx}`,{method:'DELETE'});
  sectionData[colecao]=null;
  toast('Eliminado');
  await openONDetalhe(nON);
}

// INIT
checkSession();

