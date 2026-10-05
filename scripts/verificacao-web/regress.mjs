// Regressão dos 11 problemas anteriores + checagens de temporizadores, na versão web (simulação).
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';

const OUT = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:8090';
const SCRATCH = process.env.TEMP ?? path.resolve('.');
const b = await launch({ port: 9340, profile: path.join(SCRATCH, 'chrome-profile-regress') });
// Instrumentação só do navegador de teste: conta intervalos ativos de 600 ms (ciclo da simulação).
await b.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => { const si = window.setInterval, ci = window.clearInterval; window.__simTimers = new Set();
    window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); if (ms === 600) window.__simTimers.add(id); return id; };
    window.clearInterval = (id) => { window.__simTimers.delete(id); return ci(id); }; })();`,
});
const ev = b.evaluate;
const results = [];
const check = async (id, desc, expr) => {
  let observed;
  try { observed = await ev(expr); } catch (e) { observed = 'ERRO: ' + e.message; }
  results.push({ id, desc, observed });
  console.log(`${id} | ${desc} | ${JSON.stringify(observed).slice(0, 300)}`);
};
const sec = (start, len = 160) => `const v = __vis(); const i = v.indexOf(${JSON.stringify(start)}); return i < 0 ? 'NÃO ENCONTRADO: ' + ${JSON.stringify(start)} : v.slice(i, i + ${len});`;

try {
  await b.navigate(BASE + '/control');
  await ev(`for (let i = 0; i < 120 && !document.querySelector('input'); i++) await __sleep(500); await __sleep(500); return 1;`);
  await check('I5', 'Abrir /control sem autenticação', `return location.pathname + ' :: ' + __vis().slice(0, 80);`);

  await ev(`__click('Não possui conta? Cadastre-se'); await __sleep(600); __set('Nome Completo','Pessoa Teste'); __set('E-mail','teste@exemplo.com'); __set('Senha','senhaTeste1'); __set('Confirmar Senha','senhaTeste1'); await __sleep(200); __click('Cadastrar'); await __sleep(600); __click('OK'); await __sleep(800); __set('E-mail','teste@exemplo.com'); __set('Senha','senhaTeste1'); await __sleep(200); __click('Entrar'); await __sleep(300); return 1;`);
  await check('I3', 'Monitor logo após login com simulação ativa (sem tocar em Conexão)', `__click('Monitor'); await __sleep(1800); ${sec('Leituras', 120)}`);
  await b.shot(path.join(OUT, 'R-I3-monitor-apos-login.png'));
  await check('E5', 'Faixa de estado com simulação ativa', `const v = __vis(); return [v.slice(v.indexOf('MODO DE SIMULAÇÃO'), v.indexOf('MODO DE SIMULAÇÃO') + 90), 'contém "Desconectado": ' + /\\bDesconectado\\b/.test(v)].join(' :: ');`);
  await check('T1', 'Intervalos de 600 ms ativos após conexão automática', `return __simTimers.size;`);

  await check('I4', 'Texto explicativo de Conexão sem corte (scrollHeight ≤ clientHeight)', `__click('Conexão'); await __sleep(300); __click('Desconectar'); await __sleep(400);
    const el = __find('Busque o HydroBot simulado para testar a interface sem o robô.'); return el ? (el.innerText + ' :: ' + el.scrollHeight + '/' + el.clientHeight + ' :: cortado=' + (el.scrollHeight > el.clientHeight + 1)) : 'não encontrado';`);
  await b.shot(path.join(OUT, 'R-I4-conexao-texto.png'));
  await check('T2', 'Intervalos de 600 ms após Desconectar', `return __simTimers.size;`);
  await check('T3', 'Monitor após Desconectar (sem dados antigos)', `__click('Monitor'); await __sleep(300); return 'para ver os dados: ' + __vis().includes('para ver os dados') + ' / leituras visíveis: ' + __vis().includes('Leituras SIMULADAS');`);
  await check('T4', '5 ciclos de buscar/conectar/desconectar: máximo de intervalos ativos', `let max = 0; for (let k = 0; k < 5; k++) { __click('Conexão'); await __sleep(200); __click('Buscar Dispositivos'); await __sleep(1700); __click('HydroBot simulado'); await __sleep(1000); max = Math.max(max, __simTimers.size); __click('Desconectar'); await __sleep(300); } return 'máx=' + max + ' final=' + __simTimers.size;`);
  await ev(`__click('Buscar Dispositivos'); await __sleep(1700); __click('HydroBot simulado'); await __sleep(1500); return 1;`);

  await check('I1', '"Configurar sensores" navega para Configurações', `__click('Controle'); await __sleep(400); __click('Configurar sensores'); await __sleep(600); return location.pathname + ' :: ' + __vis().includes('SENSORES DE FOGO (AVANÇADO)');`);
  await check('I2', '"Sobre o HydroBot" abre modal', `__scrollTo('Sobre o HydroBot', 'center'); __click('Sobre o HydroBot'); await __sleep(500); ${sec('Versão 1.0.0 —', 60)}`);
  await check('I6', 'Fundo do modal (padrão claro)', `const t = __find('Sobre o HydroBot'); let p = t; let bg = ''; const all = [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).borderTopLeftRadius === '16px' && d.innerText.includes('Versão 1.0.0 —')); return all.map(d => getComputedStyle(d).backgroundColor).join(',');`);
  await b.shot(path.join(OUT, 'R-I2-I6-modal-sobre.png'));
  await ev(`__click('OK'); await __sleep(300); return 1;`);

  await check('E1', 'Ativar e cancelar fogo simulado', `__scrollTo('Cenário de fogo simulado'); __click('Elevada'); await __sleep(1300); const a = __vis().includes('FOGO SIMULADO DETECTADO'); __click('Sem fogo'); await __sleep(2000); const v = __vis(); return 'ativo=' + a + ' / após cancelar: detectado=' + v.includes('FOGO SIMULADO DETECTADO') + ', nenhum=' + v.includes('Nenhum fogo detectado');`);
  await check('E2', 'Apagar todo o valor do campo', `__scrollTo('Limiar de Detecção', 'center'); __set('Limiar de Detecção', ''); await __sleep(200); const v = __input('Limiar de Detecção').value; __set('Limiar de Detecção', '75'); await __sleep(100); return 'vazio aceito: ' + (v === '') + ' / redigitado: ' + __input('Limiar de Detecção').value;`);
  await check('F1', 'Falha injetada (todos os comandos): aplicar limiar 120', `__scrollTo('Falha de envio simulada'); __click('Todos os comandos'); await __sleep(200); __scrollTo('Limiar de Detecção', 'center'); __set('Limiar de Detecção', '120'); await __sleep(100); __clickLabel('Aplicar Limiar de Detecção'); await __sleep(400); const v = __vis(); const k = v.indexOf('Limiar de Detecção = 120'); return v.slice(k, k + 110) + ' :: em vigor 120? ' + v.includes('Em vigor: 120');`);
  await check('F2', 'Falha injetada: trocar modo no Controle', `__click('Controle'); await __sleep(400); __click('MANUAL'); await __sleep(400); const v = __vis(); const k = v.indexOf('Modo automático:'); return v.slice(k, k + 100) + ' :: modo exibido: ' + (v.includes('Modo Manual') ? 'Manual' : 'Automático');`);
  await check('F3', 'Falha injetada: ligar bomba', `__click('Ligar'); await __sleep(400); const v = __vis(); const k = v.indexOf('Ligar bomba:'); return v.slice(k, k + 100) + ' :: ' + v.slice(v.indexOf('Bomba de Água |'), v.indexOf('Bomba de Água |') + 40);`);
  await b.shot(path.join(OUT, 'R-F-falha-sem-sucesso-falso.png'));
  await ev(`__click('Configurações'); await __sleep(300); __scrollTo('Falha de envio simulada'); __click('Nenhuma'); await __sleep(100); return 1;`);
  await check('E3', 'Rótulos das abas dentro da viewport (web; insets do Android não se aplicam)', `return ['Conexão','Controle','Monitor','Configurações'].map(t => { const els = [...document.querySelectorAll('div')].filter(e => e.children.length === 0 && e.innerText === t && __vis1(e)); const r = els[els.length - 1].getBoundingClientRect(); return t + ': base ' + Math.round(r.bottom) + ', altura ' + Math.round(r.height) + ', scroll ' + els[els.length - 1].scrollHeight; }).join(' | ') + ' | viewport ' + innerHeight;`);
  await check('E4', 'Emojis no texto visível das 4 abas', `const v = __vis(); const m = v.match(/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/gu); return m ? m.join('') : 'nenhum';`);
} catch (e) {
  console.error('FALHA:', e.message);
  results.push({ error: e.message });
  process.exitCode = 1;
} finally {
  results.push({ console: b.console });
  console.log('console:', b.console.length, b.console.slice(0, 3));
  fs.writeFileSync(path.join(OUT, 'regressao-web.log.json'), JSON.stringify(results, null, 2));
  b.close();
}
