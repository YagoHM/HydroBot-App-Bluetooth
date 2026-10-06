// Verificação web com asserções (Modo de Simulação, build de produção).
// Cada critério tem um resultado esperado; qualquer divergência marca FALHOU
// e o processo termina com código 1. Uso:
//   node scripts/verificacao-web/verify.mjs <pasta-saida> [url]
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';

const OUT = path.resolve(process.argv[2] ?? 'verificacao-web');
const BASE = process.argv[3] ?? 'http://localhost:8090';
const PROFILE = path.join(process.env.TEMP ?? path.resolve('.'), 'hb-verify-profile');
const W = 390;
const H = 844;

const EXTRA = `
window.__label = (l) => [...document.querySelectorAll('[aria-label="' + l + '"]')].filter(__vis1);
window.__count = (t) => [...document.querySelectorAll('div,span')].filter(e => e.children.length === 0 && e.innerText && e.innerText.trim() === t && __vis1(e)).length;
// As telas inativas continuam no DOM; a ativa é a que tem o indicador por cima.
window.__top = (el) => { const r = el.getBoundingClientRect(); const x = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!x && (el === x || el.contains(x)); };
window.__activePill = () => [...document.querySelectorAll('[data-testid="status-indicator"]')].find(e => __vis1(e) && __top(e));
window.__inActive = (sel) => { let e = __activePill(); while (e && !e.querySelector(sel)) e = e.parentElement; return e ? e.querySelector(sel) : null; };
window.__pill = () => { const p = __activePill(); return p ? p.lastElementChild.textContent.trim() : null; };
window.__headerTitle = () => __activePill().parentElement.firstElementChild;
window.__checked = (l) => { const e = __label(l)[0]; return e ? e.getAttribute('aria-checked') : 'ausente'; };
window.__tab = (t) => { const tabs = [...document.querySelectorAll('[role="tab"]')]; // o texto da aba inclui o glifo do ícone (fonte de ícones): compara pelo final
  const el = tabs.find(e => e.textContent.trim().endsWith(t));
  if (!el) throw new Error('aba não encontrada: ' + t + ' em ' + location.pathname + ' [' + tabs.map(x => JSON.stringify(x.textContent)).join(',') + ']'); el.click(); };
window.__emergencyBtn = () => (window.__emBtn = __inActive('[aria-label="Parada de emergência"]'));
window.__restartBtn = () => __inActive('[aria-label="Reiniciar aplicativo"]');
// Aproximação web de fonte ampliada: multiplica o tamanho de todos os textos visíveis.
window.__bigFont = (f) => { for (const el of document.querySelectorAll('div,span')) { if (el.children.length || !el.textContent.trim() || el.dataset.big) continue;
  const cs = getComputedStyle(el); el.dataset.big = '1'; el.style.fontSize = (parseFloat(cs.fontSize) * f) + 'px'; if (cs.lineHeight !== 'normal') el.style.lineHeight = (parseFloat(cs.lineHeight) * f) + 'px'; } };
window.__scroller = (el) => { let sc = el.parentElement; while (sc && sc.id !== 'root' && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement; return sc && sc.id !== 'root' ? sc : null; };
window.__brokenWords = (el) => { const tn = [...el.childNodes].find(n => n.nodeType === 3); if (!tn) return 0; let broken = 0, pos = 0;
  for (const w of tn.textContent.split(' ')) { if (w) { const r = document.createRange(); r.setStart(tn, pos); r.setEnd(tn, pos + w.length); if (new Set([...r.getClientRects()].map(x => Math.round(x.top))).size > 1) broken++; } pos += w.length + 1; } return broken; };
window.__inside = (a, b, tol = 1) => { const r = a.getBoundingClientRect(), o = b.getBoundingClientRect(); return r.left >= o.left - tol && r.right <= o.right + tol && r.top >= o.top - tol && r.bottom <= o.bottom + tol; };
window.__esc = () => document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
window.__modals = () => ['Parada de emergência aplicada na simulação', 'Parada com falha parcial', 'Parada de emergência não aplicada', 'Executando parada de emergência…'].reduce((n, t) => n + __count(t), 0);
`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9350, profile: PROFILE, width: W, height: H });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: EXTRA });
// Instrumentação do navegador de teste: intervalos ativos de 600 ms (ciclo da simulação).
await b.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => { const si = window.setInterval, ci = window.clearInterval; window.__simTimers = new Set();
    window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); if (ms === 600) window.__simTimers.add(id); return id; };
    window.clearInterval = (id) => { window.__simTimers.delete(id); return ci(id); }; })();`,
});

const ev = b.evaluate;
const results = [];
let shotN = 0;
const shot = async (name) => {
  shotN += 1;
  const file = `${String(shotN).padStart(2, '0')}-${name}.png`;
  await b.shot(path.join(OUT, file));
  return file;
};
/** Executa expr no app e compara com o esperado. `expected` pode ser valor ou função (observado) => boolean. */
const check = async (id, desc, expr, expected) => {
  let observed;
  let pass;
  try {
    observed = await ev(expr);
    pass = typeof expected === 'function' ? !!expected(observed) : JSON.stringify(observed) === JSON.stringify(expected);
  } catch (e) {
    observed = 'ERRO: ' + e.message.split('\n')[0];
    pass = false;
  }
  const expectedText = typeof expected === 'function' ? expected.toString().replace(/\s+/g, ' ') : JSON.stringify(expected);
  results.push({ id, desc, expected: expectedText, observed, result: pass ? 'APROVADO' : 'FALHOU' });
  console.log(`${pass ? 'OK   ' : 'FALHA'} ${id} | ${desc} | ${JSON.stringify(observed).slice(0, 220)}`);
  return observed;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (expr) => ev(expr);
const setViewport = (width, height) =>
  b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });

const EMERG_SIM_OK = 'Parada de emergência aplicada na simulação';
const emergencyTitles = [EMERG_SIM_OK, 'Parada com falha parcial', 'Parada de emergência não aplicada', 'Executando parada de emergência…'];
const countEmergencyModals = `return __modals();`;

try {
  // ── Autenticação (I5) e login com área reduzida pelo teclado (item 4) ──
  await b.navigate(BASE + '/control');
  await run(`for (let i = 0; i < 120 && !document.querySelector('input'); i++) await __sleep(500); await __sleep(500); return 1;`);
  await check('I5', 'Rota protegida sem login mostra a tela de login', `return __vis().includes('Digite o e-mail e a senha para continuar');`, true);
  await shot('login');
  await check('M1', 'Erro de login: foco sai do botão Entrar e volta ao fechar', `__set('E-mail', 'invalido'); await __sleep(100);
    const el = __clickable(__find('Entrar')); el.focus(); el.click(); await __sleep(600); const inModal = document.activeElement !== el;
    __click('OK'); await __sleep(700); return [inModal, document.activeElement === el];`, [true, true]);

  // Proxy do teclado aberto: altura útil reduzida para 400 px (o teclado ocupa o resto).
  await setViewport(W, 400);
  await sleep(400);
  await check('K1', 'Login com altura reduzida: o ScrollView do app (não a página) rola e "Entrar" fica alcançável', `const btn = __clickable(__find('Entrar'));
    let sc = btn.parentElement; while (sc && sc.id !== 'root' && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement; if (sc && sc.id === 'root') sc = null;
    btn.scrollIntoView({ block: 'nearest' }); await __sleep(200); const r = btn.getBoundingClientRect();
    return { rola: !!sc, entrarVisivel: r.top >= 0 && r.bottom <= innerHeight };`, { rola: true, entrarVisivel: true });
  await shot('login-altura-reduzida');
  await check('K2', 'Senha → Enter envia o login (fluxo pelo teclado)', `__set('E-mail', 'nao-existe@exemplo.com'); __set('Senha', 'x');
    const pw = __input('Senha'); pw.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await __sleep(500);
    const shown = __vis().includes('E-mail ou senha incorretos.'); if (shown) __click('OK'); await __sleep(400); return shown;`, true);
  await run(`__click('Não possui conta? Cadastre-se'); await __sleep(600); return 1;`);
  await check('K3', 'Cadastro com altura reduzida: o ScrollView do app rola e "Cadastrar" fica alcançável', `const btn = __clickable(__find('Cadastrar'));
    let sc = btn.parentElement; while (sc && sc.id !== 'root' && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement; if (sc && sc.id === 'root') sc = null;
    btn.scrollIntoView({ block: 'nearest' }); await __sleep(200); const r = btn.getBoundingClientRect();
    return { rola: !!sc, cadastrarVisivel: r.top >= 0 && r.bottom <= innerHeight };`, { rola: true, cadastrarVisivel: true });
  await setViewport(W, H);
  await sleep(300);
  await run(`__set('Nome Completo','Pessoa Teste'); __set('E-mail','teste@exemplo.com'); __set('Senha','senhaTeste1'); __set('Confirmar Senha','senhaTeste1'); await __sleep(200); __click('Cadastrar'); await __sleep(600); __click('OK'); await __sleep(800);
    __set('E-mail','teste@exemplo.com'); __set('Senha','senhaTeste1'); await __sleep(200); __click('Entrar'); await __sleep(300); return 1;`);

  // ── I3: simulação conecta sozinha; Monitor com leituras ──
  await check('I3', 'Monitor logo após login mostra leituras simuladas', `__tab('Monitor'); await __sleep(1800); return __vis().includes('Leituras SIMULADAS');`, true);
  await check('T1', 'Intervalos de 600 ms ativos após conexão automática', `return __simTimers.size;`, 1);

  // ── Item 2: indicador compacto nas quatro abas ──
  const tabs = ['Conexão', 'Controle', 'Monitor', 'Ajustes'];
  for (const t of tabs) {
    await check(`P-${t}`, `Indicador no cabeçalho de ${t}`, `__tab(${JSON.stringify(t)}); await __sleep(400); return __pill();`, 'Simulação · conectado');
    await shot(`indicador-${t.toLowerCase().replace('ã', 'a')}`);
  }
  await check('P-desc', 'Indicador tem descrição acessível completa', `return __activePill().getAttribute('aria-label');`,
    (o) => /Modo de Simulação, conectado\. Os dados são gerados pelo aplicativo, sem controlar um robô físico\./.test(o));
  await check('P-layout', 'Título e indicador sem truncamento e sem sobrepor "Reiniciar" (4 abas)', `const out = [];
    for (const t of ${JSON.stringify(tabs)}) { __tab(t); await __sleep(300);
      const pill = __activePill();
      const title = pill.parentElement.firstElementChild; const restart = __restartBtn();
      const p = pill.getBoundingClientRect(), r = restart.getBoundingClientRect(), ti = title.getBoundingClientRect();
      out.push({ aba: t, tituloInteiro: title.scrollWidth <= title.clientWidth + 1, indicadorInteiro: pill.lastElementChild.scrollWidth <= pill.lastElementChild.clientWidth + 1, semSobrepor: p.right <= r.left && ti.right <= r.left }); }
    return out.every(o => o.tituloInteiro && o.indicadorInteiro && o.semSobrepor) ? 'ok' : out;`, 'ok');
  await check('P-faixa', 'Faixa grande antiga removida', `return __vis().includes('MODO DE SIMULAÇÃO');`, false);
  await check('E5', 'Simulação ativa não mostra "Desconectado" no cabeçalho', `return /desconectado/i.test(__pill());`, false);

  // ── Item 5: rótulos das abas ──
  await check('TAB', 'Rótulos completos, sem reticências, dentro da tela', `return [...document.querySelectorAll('[role="tab"]')].map(t => { const l = [...t.querySelectorAll('div')].reverse().find(d => d.children.length === 0 && /[A-Za-zÀ-ú]{3}/.test(d.textContent)); const r = l.getBoundingClientRect();
      return l.textContent.trim() + ':' + (l.scrollWidth <= l.clientWidth + 1 && l.scrollHeight <= l.clientHeight + 1 && r.bottom <= innerHeight ? 'ok' : 'cortado'); });`,
    ['Conexão:ok', 'Controle:ok', 'Monitor:ok', 'Ajustes:ok']);
  await check('TAB-a11y', 'Aba Ajustes mantém nome acessível com "Configurações" e o título da tela', `const t = [...document.querySelectorAll('[role="tab"]')].find(e => e.textContent.trim().endsWith('Ajustes'));
    __tab('Ajustes'); await __sleep(300); const title = __headerTitle().textContent.trim();
    return [t.getAttribute('aria-label'), title];`, ['Ajustes, tela de Configurações', 'Configurações']);
  await shot('barra-de-abas-ajustes');

  // ── Item 1: nível de água simulado ──
  await check('W0', 'Início: "Reabastecer (75%)" selecionado e "Água baixa" não', `__scrollTo('Nível de água simulado'); await __sleep(200);
    return [__checked('Nível de água: Reabastecer (75%)'), __checked('Nível de água: Água baixa (8%)'), document.querySelector('[aria-label="Nível de água simulado"]')?.getAttribute('role')];`,
    ['true', 'false', 'radiogroup']);
  await check('W1', 'Selecionar 8%: destaque único e valor atual 8%', `__clickLabel('Nível de água: Água baixa (8%)'); await __sleep(400);
    return [__checked('Nível de água: Água baixa (8%)'), __checked('Nível de água: Reabastecer (75%)'), __vis().includes('Nível atual na simulação: 8%')];`, ['true', 'false', true]);
  await shot('agua-8-selecionada');
  await check('W2', 'Monitor mostra 8%', `__tab('Monitor'); await __sleep(800); return __vis().includes('Nível de Água (simulado) | 8%');`, true);
  await shot('monitor-agua-8');
  await check('W3', 'Selecionar 75%: destaque volta e Monitor mostra 75%', `__tab('Ajustes'); await __sleep(300); __clickLabel('Nível de água: Reabastecer (75%)'); await __sleep(400);
    const sel = [__checked('Nível de água: Reabastecer (75%)'), __checked('Nível de água: Água baixa (8%)')]; __tab('Monitor'); await __sleep(800);
    return [...sel, __vis().includes('Nível de Água (simulado) | 75%')];`, ['true', 'false', true]);
  await check('W4', 'Falha de envio: seleção anterior mantida e falha apresentada', `__tab('Ajustes'); await __sleep(300); __scrollTo('Falha de envio simulada'); __clickLabel('Falha simulada: Todos os comandos'); await __sleep(200);
    __clickLabel('Nível de água: Água baixa (8%)'); await __sleep(400);
    const r = [__checked('Nível de água: Reabastecer (75%)'), __checked('Nível de água: Água baixa (8%)'), __vis().includes('Água simulada em 8%: falhou')];
    __clickLabel('Falha simulada: Nenhuma'); await __sleep(200); return r;`, ['true', 'false', true]);
  await shot('agua-falha-selecao-mantida');

  // ── Item 7 / E2: Aplicar com o campo ainda em foco ──
  await check('AP1', 'Campo focado, digitar 40 e um toque em Aplicar → sucesso e "Em vigor: 40"', `__scrollTo('Limiar de Detecção', 'center'); await __sleep(200);
    const el = __set('Limiar de Detecção', '40'); el.focus(); await __sleep(100); __clickLabel('Aplicar Limiar de Detecção'); await __sleep(500);
    const v = __vis(); return [v.includes('Limiar de Detecção = 40: aplicado na simulação.'), v.includes('Em vigor: 40')];`, [true, true]);
  await shot('aplicar-40-primeiro-toque');
  await check('AP2', 'Valor inválido (250): erro, nenhum comando enviado, foco no campo', `const el = __set('Limiar de Detecção', '250'); el.focus(); __clickLabel('Aplicar Limiar de Detecção'); await __sleep(400);
    return [__vis().includes('O valor deve estar entre 20 e 200.'), __vis().includes('Limiar de Detecção = 250'), document.activeElement === __input('Limiar de Detecção')];`, [true, false, true]);
  await check('AP3', 'Campo vazio e relação inválida continuam com mensagens específicas', `__set('Limiar de Detecção', ''); __blur('Limiar de Detecção'); await __sleep(200); const a = __vis().includes('Digite um valor.');
    __set('Limiar de Detecção', '200'); __blur('Limiar de Detecção'); await __sleep(200); const b2 = __vis().includes('Deve ser menor que a intensidade de referência em vigor (200).');
    __set('Limiar de Detecção', '40'); __blur('Limiar de Detecção'); await __sleep(200); return [a, b2];`, [true, true]);
  await check('AP4', 'Apagar todo o valor continua possível (E2)', `__set('Limiar de Detecção', ''); await __sleep(100); const v = __input('Limiar de Detecção').value; __set('Limiar de Detecção', '40'); __blur('Limiar de Detecção'); return v;`, '');
  await check('AP5', 'Após os erros, o valor em vigor continua 40 (Monitor: detecção ≥ 40)', `__tab('Monitor'); await __sleep(900); return __vis().includes('detecção ≥ 40');`, true);

  // ── E1 / persistência do cancelamento de fogo ──
  await check('E1', 'Elevada ativa fogo; "Sem fogo" cancela e persiste por 5 ciclos', `__tab('Ajustes'); await __sleep(300); __scrollTo('Cenário de fogo simulado'); __clickLabel('Cenário Elevada'); await __sleep(900);
    const on = __vis().includes('FOGO SIMULADO DETECTADO'); __clickLabel('Cenário Sem fogo'); const seen = [];
    for (let i = 0; i < 5; i++) { await __sleep(650); seen.push(__vis().includes('FOGO SIMULADO DETECTADO')); } return [on, seen.some(Boolean)];`, [true, false]);

  // ── Item 6: título dos sensores ──
  await check('S1', 'Título dos sensores sem palavras partidas e selo em linha própria (390 px)', `__tab('Monitor'); await __sleep(700); __scrollTo('Sensores de Fogo (simulados)', 'center'); await __sleep(200);
    const title = __find('Sensores de Fogo (simulados)'); const badge = __find('Calibração simulada');
    const tn = [...title.childNodes].find(n => n.nodeType === 3) ?? title.firstChild; const text = tn.textContent; let broken = 0; let pos = 0;
    for (const w of text.split(' ')) { const r = document.createRange(); r.setStart(tn, pos); r.setEnd(tn, pos + w.length); const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))); if (lines.size > 1) broken++; pos += w.length + 1; }
    return { palavrasPartidas: broken, seloAbaixo: badge.getBoundingClientRect().top >= title.getBoundingClientRect().bottom - 1 };`, { palavrasPartidas: 0, seloAbaixo: true });
  await shot('monitor-sensores-titulo');
  await setViewport(320, 640);
  await sleep(500);
  await check('S2', 'Mesmo critério em tela estreita (320 px)', `__scrollTo('Sensores de Fogo (simulados)', 'center'); await __sleep(200);
    const title = __find('Sensores de Fogo (simulados)'); const badge = __find('Calibração simulada');
    const tn = [...title.childNodes].find(n => n.nodeType === 3) ?? title.firstChild; const text = tn.textContent; let broken = 0; let pos = 0;
    for (const w of text.split(' ')) { const r = document.createRange(); r.setStart(tn, pos); r.setEnd(tn, pos + w.length); const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))); if (lines.size > 1) broken++; pos += w.length + 1; }
    return { palavrasPartidas: broken, seloAbaixo: badge.getBoundingClientRect().top >= title.getBoundingClientRect().bottom - 1 };`, { palavrasPartidas: 0, seloAbaixo: true });
  await shot('monitor-sensores-320px');
  await check('P-320', 'Indicador e título inteiros em 320 px (aba Ajustes)', `__tab('Ajustes'); await __sleep(400); const pill = __activePill();
    const title = pill.parentElement.firstElementChild; const restart = __restartBtn();
    return [title.scrollWidth <= title.clientWidth + 1, pill.lastElementChild.scrollWidth <= pill.lastElementChild.clientWidth + 1, pill.getBoundingClientRect().right <= restart.getBoundingClientRect().left];`, [true, true, true]);
  await shot('indicador-320px');
  await setViewport(W, H);
  await sleep(400);

  // ── Item 3: emergência na simulação com movimento e bomba ativos ──
  await check('EM1', 'Pré-condição: movimento "Para frente" e bomba ligada', `__tab('Controle'); await __sleep(400); __click('Ligar'); await __sleep(300);
    window.__release = await __hold('Mover para frente', 300); return [__vis().includes('Movimento (simulação): Para frente'), __vis().includes('Ligada')];`, [true, true]);
  await check('EM2', 'Um toque: modal grande com título e três estados; foco saiu do botão', `const btn = __emergencyBtn(); btn.focus(); btn.click(); await __sleep(500);
    return { titulo: __count(${JSON.stringify(EMERG_SIM_OK)}), estados: ['Movimento parado', 'Bomba desligada', 'Modo manual'].map(l => __label(l).length), focoForaDoBotao: document.activeElement !== btn };`,
    { titulo: 1, estados: [1, 1, 1], focoForaDoBotao: true });
  await shot('emergencia-simulacao-modal');
  await check('EM3', 'Estado real da simulação: parado, bomba desligada, manual', `window.__release(); await __sleep(300); const v = __vis();
    return [v.includes('Movimento (simulação): Parado'), v.includes('Desligada'), v.includes('Modo Manual')];`, [true, true, true]);
  await check('EM4', 'Modal permanece aberto após 2 s sem ação do usuário', `await __sleep(2000); return __count(${JSON.stringify(EMERG_SIM_OK)});`, 1);
  await check('EM5', 'Fechar: modal some, foco volta ao botão e nada é retomado', `const btn = window.__emBtn; __click('Fechar'); await __sleep(800);
    const r = { modais: __modals(), focoNoBotao: document.activeElement === btn }; await __sleep(2000); const v = __vis();
    return { ...r, aindaParado: v.includes('Movimento (simulação): Parado'), bombaDesligada: v.includes('Desligada'), manual: v.includes('Modo Manual') };`,
    { modais: 0, focoNoBotao: true, aindaParado: true, bombaDesligada: true, manual: true });

  // Emergência a partir de AUTO, no Monitor, com fogo elevado
  await check('EM6', 'Monitor, AUTO + bomba + fogo elevado: um toque → um modal, Manual, fogo mantido', `__click('Ligar'); await __sleep(200); __click('MANUAL'); await __sleep(300);
    __tab('Ajustes'); await __sleep(300); __scrollTo('Cenário de fogo simulado'); __clickLabel('Cenário Elevada'); await __sleep(200);
    __tab('Monitor'); await __sleep(700); const autoAntes = __vis().includes('Automático');
    const btn = __emergencyBtn(); btn.focus(); btn.click(); await __sleep(600);
    const modais = __modals(); await __sleep(1500); const v = __vis();
    return { autoAntes, modais, manual: __label('Modo: Manual').length > 0, bombaDesligada: v.includes('DESLIGADA'), fogo: v.includes('FOGO SIMULADO DETECTADO') };`,
    { autoAntes: true, modais: 1, manual: true, bombaDesligada: true, fogo: true });
  await shot('emergencia-monitor-auto');
  await check('EM7', 'Botão Voltar/Esc fecha o resultado concluído e o foco volta ao botão do Monitor', `const btn = window.__emBtn; __esc(); await __sleep(800);
    return { modais: __modals(), focoNoBotao: document.activeElement === btn, manual: __label('Modo: Manual').length > 0 };`,
    { modais: 0, focoNoBotao: true, manual: true });
  await check('EM8', 'Dois toques rápidos geram uma única apresentação', `const btn = __emergencyBtn(); btn.click(); btn.click(); await __sleep(600);
    const n = __modals(); __click('Fechar'); await __sleep(500); return n;`, 1);

  // Falha parcial, nova tentativa, falha total e sem conexão
  await check('EM9', 'Falha parcial (bomba): destaque, resultado por ação e "Tentar novamente"', `__tab('Controle'); await __sleep(300); __click('Ligar'); await __sleep(200);
    __tab('Ajustes'); await __sleep(300); __scrollTo('Falha de envio simulada'); __clickLabel('Falha simulada: Comandos da bomba'); await __sleep(200);
    __tab('Controle'); await __sleep(300); __emergencyBtn().click(); await __sleep(500);
    return { titulo: __count('Parada com falha parcial'), movimento: __label('Movimento parado').length, bomba: __vis().includes('Desligar bomba: falhou — Falha de envio simulada (ativada em Configurações).'), modo: __label('Modo manual').length, retry: __label('Tentar parada de emergência novamente').length };`,
    { titulo: 1, movimento: 1, bomba: true, modo: 1, retry: 1 });
  await shot('emergencia-falha-parcial');
  await check('EM10', 'Bomba continua ligada após a falha (sem sucesso falso)', `return __vis().includes('Ligada');`, true);
  await check('EM11', 'Remover a falha e "Tentar novamente" atualiza o mesmo modal para sucesso', `__clickLabel('Falha simulada: Nenhuma'); await __sleep(200);
    __clickLabel('Tentar parada de emergência novamente'); await __sleep(600);
    return { sucesso: __count(${JSON.stringify(EMERG_SIM_OK)}), parcial: __count('Parada com falha parcial'), modais: __modals() };`,
    { sucesso: 1, parcial: 0, modais: 1 });
  await run(`__click('Fechar'); await __sleep(400); return 1;`);
  await check('EM12', 'Falha total (todos os comandos)', `__tab('Ajustes'); await __sleep(300); __scrollTo('Falha de envio simulada'); __clickLabel('Falha simulada: Todos os comandos'); await __sleep(200);
    __tab('Controle'); await __sleep(300); __emergencyBtn().click(); await __sleep(500);
    return { titulo: __count('Parada de emergência não aplicada'), causaUmaVez: __count('Nenhum comando de parada foi enviado: Falha de envio simulada (ativada em Configurações).'), naoEnviados: __count('Não enviados: parar movimento, desligar bomba, sair do modo automático.'), retry: __label('Tentar parada de emergência novamente').length };`,
    { titulo: 1, causaUmaVez: 1, naoEnviados: 1, retry: 1 });
  await shot('emergencia-falha-total');
  await run(`__click('Fechar'); await __sleep(300); __tab('Ajustes'); await __sleep(300); __scrollTo('Falha de envio simulada'); __clickLabel('Falha simulada: Nenhuma'); await __sleep(200); return 1;`);

  // ── Item 8: mensagens antigas somem quando a sessão é encerrada ──
  await check('SS1', 'Antes: velocidade aplicada na simulação aparece em Ajustes', `__scrollTo('Velocidade dos Motores'); __clickLabel('Diminuir Velocidade dos Motores'); await __sleep(400);
    return __vis().includes('aplicado na simulação.');`, true);
  await check('SS2', 'Após encerrar a sessão (Desconectar): nenhuma mensagem "aplicado na simulação"', `__tab('Conexão'); await __sleep(300); __click('Desconectar'); await __sleep(600);
    __tab('Ajustes'); await __sleep(400); return [__vis().includes('aplicado na simulação'), __vis().includes('Sem leitura do dispositivo')];`, [false, true]);
  await shot('ajustes-apos-desconectar');
  await check('T2', 'Intervalos de 600 ms após Desconectar', `return __simTimers.size;`, 0);
  await check('P-desc2', 'Indicador após desconectar', `return __pill();`, 'Simulação · desconectado');
  await check('EM13', 'Emergência sem conexão: causa dita uma vez, ações não enviadas, sem sucesso', `__tab('Controle'); await __sleep(300); __emergencyBtn().click(); await __sleep(500);
    return { titulo: __count('Parada de emergência não aplicada'), causa: __count('Nenhum comando de parada foi enviado: Não conectado ao dispositivo simulado. Conecte-se na aba Conexão.'), repeticoes: (__vis().match(/Não conectado ao dispositivo simulado/g) || []).length, sucesso: __count(${JSON.stringify(EMERG_SIM_OK)}) };`,
    { titulo: 1, causa: 1, repeticoes: 1, sucesso: 0 });
  await shot('emergencia-sem-conexao');
  await run(`__click('Fechar'); await __sleep(300); return 1;`);
  await check('T4', '5 ciclos de conectar/desconectar: no máximo 1 intervalo ativo', `let max = 0; for (let k = 0; k < 5; k++) { __tab('Conexão'); await __sleep(200); __click('Buscar Dispositivos'); await __sleep(1700); __click('HydroBot simulado'); await __sleep(1000); max = Math.max(max, __simTimers.size); __click('Desconectar'); await __sleep(300); } return [max, __simTimers.size];`, [1, 0]);
  await run(`__click('Buscar Dispositivos'); await __sleep(1700); __click('HydroBot simulado'); await __sleep(1500); return 1;`);

  // ── M3: ícones decorativos fora da árvore de acessibilidade ──
  await check('M3', 'Ícones (glifos) sem aria-hidden em todas as abas', `let total = 0, expostos = 0;
    for (const t of ['Conexão', 'Controle', 'Monitor', 'Ajustes']) { __tab(t); await __sleep(300); }
    for (const el of document.querySelectorAll('div,span')) { if (el.children.length || !/ionicons/i.test(getComputedStyle(el).fontFamily)) continue; total++; if (!el.closest('[aria-hidden="true"]')) expostos++; }
    return { haIcones: total > 10, expostos };`, { haIcones: true, expostos: 0 });

  // ── C1: campo focado rola para cima, com título, Aplicar e erro visíveis ──
  await check('C1a', 'Foco em "Intensidade de Perigo" (sem rolagem do navegador) traz o cartão inteiro para a área visível', `__tab('Ajustes'); await __sleep(400);
    const input = __input('Intensidade de Perigo'); const sc = __scroller(input); sc.scrollTop = 0; await __sleep(300);
    let card = input; while (card && !(card.textContent.includes('Intensidade de Perigo') && card.textContent.includes('Aplicar') && card.textContent.includes('Em vigor'))) card = card.parentElement;
    const antes = __inside(card, sc); input.focus({ preventScroll: true }); await __sleep(700); window.__c1 = { input, sc, card };
    return { antesVisivel: antes, depoisVisivel: __inside(card, sc) };`, { antesVisivel: false, depoisVisivel: true });
  await check('C1b', 'Valor inválido + Aplicar: mensagem de erro e Aplicar visíveis', `const { input, sc, card } = window.__c1; __set('Intensidade de Perigo', '700'); input.focus({ preventScroll: true });
    __clickLabel('Aplicar Intensidade de Perigo'); await __sleep(700); const err = __find('O valor deve estar entre 200 e 600.');
    return { erro: !!err && __inside(err, sc), aplicar: __inside(__label('Aplicar Intensidade de Perigo')[0], sc), cartao: __inside(card, sc) };`, { erro: true, aplicar: true, cartao: true });
  await check('C1c', 'Sem teclado não há espaço extra no fim da rolagem', `const { sc } = window.__c1; __set('Intensidade de Perigo', '350'); __blur('Intensidade de Perigo'); await __sleep(200);
    return getComputedStyle(sc.firstElementChild).paddingBottom;`, '0px');
  await shot('c1-campo-perigo-visivel');

  // ── C2: cartão de Conexão em área reduzida ──
  await setViewport(W, 460);
  await sleep(500);
  await check('C2a', 'Área reduzida: cartão rola; Desconectar inteiro acima das abas e título abaixo do cabeçalho', `__tab('Conexão'); await __sleep(500);
    const btn = __label('Desconectar do dispositivo simulado')[0]; const sc = __scroller(btn);
    if (!sc) return { rola: false };
    const tabTop0 = [...document.querySelectorAll('[role="tab"]')][0].getBoundingClientRect().top; const header = sc.getBoundingClientRect().top;
    btn.scrollIntoView({ block: 'nearest' }); await __sleep(300); const b = btn.getBoundingClientRect(); const tabTop = tabTop0;
    sc.scrollTop = 0; await __sleep(300); const title = __find('Conectado ao dispositivo simulado'); const tt = title.getBoundingClientRect();
    return { rola: true, desconectarInteiro: b.top >= 0 && b.bottom <= tabTop + 1, tituloVisivel: tt.top >= header - 1 };`, { rola: true, desconectarInteiro: true, tituloVisivel: true });
  await shot('c2-conexao-area-reduzida');
  await setViewport(W, H);
  await sleep(400);

  // ── Aproximação web de fonte ampliada (×1,8): não comprova o Android ──
  await setViewport(360, 740);
  await sleep(400);
  await check('M1', 'Fonte ×1,8: ícone e texto da emergência inteiros dentro do botão', `__tab('Controle'); await __sleep(400); __bigFont(1.8); await __sleep(300);
    const btn = __emergencyBtn(); const leaves = [...btn.querySelectorAll('div')].filter(d => !d.children.length && d.textContent.trim());
    const icon = leaves.find(d => /ionicons/i.test(getComputedStyle(d).fontFamily)); const text = leaves.find(d => d !== icon);
    return { icone: __inside(icon, btn), texto: __inside(text, btn), textoSemCorteHorizontal: text.scrollWidth <= text.clientWidth + 1 };`,
    { icone: true, texto: true, textoSemCorteHorizontal: true });
  await shot('m1-emergencia-fonte-ampliada');
  await check('M4', 'Fonte ×1,8: Status do Sistema e sensores sem palavras partidas', `__tab('Monitor'); await __sleep(600); __bigFont(1.8); await __sleep(300);
    const labels = ['Modo', 'Velocidade', 'PWM Mín', 'PWM Máx', 'Esquerdo', 'Centro', 'Direito'].map(t => __find(t)).filter(Boolean);
    return { encontrados: labels.length, partidas: labels.reduce((n, el) => n + __brokenWords(el), 0) };`, { encontrados: 7, partidas: 0 });
  await check('M4b', 'Fonte ×1,8: valores numéricos completos', `const vals = [...document.querySelectorAll('[aria-label^="Velocidade:"], [aria-label^="PWM Mín:"], [aria-label^="PWM Máx:"]')].filter(__vis1);
    return vals.every(v => { const t = [...v.querySelectorAll('div')].filter(d => !d.children.length).pop(); return t.scrollWidth <= t.clientWidth + 1 && __brokenWords(t) === 0; });`, true);
  await shot('m4-monitor-fonte-ampliada');
  await check('C2b', 'Fonte ×1,8: Desconectar alcançável e inteiro acima das abas', `__tab('Conexão'); await __sleep(500); __bigFont(1.8); await __sleep(300);
    const btn = __label('Desconectar do dispositivo simulado')[0]; btn.scrollIntoView({ block: 'nearest' }); await __sleep(300);
    const tabTop = [...document.querySelectorAll('[role="tab"]')][0].getBoundingClientRect().top; const b = btn.getBoundingClientRect();
    return b.top >= 0 && b.bottom <= tabTop + 1;`, true);
  await shot('c2-conexao-fonte-ampliada');
  await b.navigate(BASE + '/');
  await run(`for (let i = 0; i < 120 && !document.querySelector('input') && !document.querySelector('[role="tab"]'); i++) await __sleep(500); await __sleep(800); return 1;`);
  await setViewport(W, H);
  await sleep(300);
  // A navegação recarrega o app: entra de novo (dados fictícios) para a regressão final.
  await run(`if (document.querySelector('input')) { __set('E-mail','teste@exemplo.com'); __set('Senha','senhaTeste1'); await __sleep(200); __click('Entrar'); await __sleep(1500); } return 1;`);

  // ── Regressão de I1, I2, I4, I6, E4 e foco dos modais ──
  await check('I1', '"Configurar sensores" navega para Configurações', `__tab('Controle'); await __sleep(300); __click('Configurar sensores'); await __sleep(600); return [location.pathname, __vis().includes('SENSORES DE FOGO (AVANÇADO)')];`, ['/settings', true]);
  await check('I2', '"Sobre o HydroBot" abre o modal', `__scrollTo('Sobre o HydroBot', 'center'); __click('Sobre o HydroBot'); await __sleep(500); return __vis().includes('Versão 1.0.0 — HydroBot Controller.');`, true);
  await check('I6', 'Modal com fundo claro', `return [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).borderTopLeftRadius === '16px' && d.innerText.includes('Versão 1.0.0 —')).map(d => getComputedStyle(d).backgroundColor)[0];`, 'rgb(255, 255, 255)');
  await run(`__click('OK'); await __sleep(400); return 1;`);
  await check('M2', 'Sobre: foco sai e volta ao controle de origem', `const el = __label('Sobre o HydroBot, versão 1.0.0')[0]; el.focus(); el.click(); await __sleep(600); const out = document.activeElement !== el; __click('OK'); await __sleep(700); return [out, document.activeElement === el];`, [true, true]);
  await check('M4', 'Reiniciar: foco sai e volta ao botão', `const el = __restartBtn(); el.focus(); el.click(); await __sleep(600); const out = document.activeElement !== el; __click('Cancelar'); await __sleep(700); return [out, document.activeElement === el];`, [true, true]);
  await check('I4', 'Texto explicativo de Conexão sem corte', `__tab('Conexão'); await __sleep(300); __click('Desconectar'); await __sleep(500); const el = __find('Busque o HydroBot simulado para testar a interface sem o robô.'); return el.scrollHeight <= el.clientHeight + 1;`, true);
  await shot('conexao-desconectado');
  await check('E4', 'Sem emojis no texto visível', `const v = __vis(); return (v.match(/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/gu) || []).join('');`, '');
  await check('CON', 'Console sem erros nem avisos', `return 0;`, 0);
} catch (e) {
  results.push({ id: 'ROTEIRO', desc: 'Execução interrompida', observed: e.message, result: 'FALHOU' });
  console.error('ROTEIRO INTERROMPIDO:', e.message);
} finally {
  const consoleIssues = b.console;
  const conIdx = results.findIndex((r) => r.id === 'CON');
  if (conIdx >= 0) {
    results[conIdx].observed = consoleIssues.length;
    results[conIdx].result = consoleIssues.length === 0 ? 'APROVADO' : 'FALHOU';
  }
  const failed = results.filter((r) => r.result !== 'APROVADO');
  fs.writeFileSync(path.join(OUT, 'verificacao-web.json'), JSON.stringify({ base: BASE, viewport: `${W}x${H}`, total: results.length, falhas: failed.length, console: consoleIssues, results }, null, 2));
  console.log(`\nTOTAL ${results.length} | APROVADOS ${results.length - failed.length} | FALHAS ${failed.length}`);
  b.close();
  process.exitCode = failed.length ? 1 : 0;
}
