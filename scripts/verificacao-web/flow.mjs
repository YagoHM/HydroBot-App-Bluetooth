// Percorre o roteiro em Modo de Simulação na versão web e salva capturas + log.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';

const OUT = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:8081';
const SCRATCH = process.env.TEMP ?? path.resolve('.');
const log = [];
const b = await launch({ profile: path.join(SCRATCH, 'chrome-profile') });
const ev = b.evaluate;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const shot = async (name) => {
  n += 1;
  const file = path.join(OUT, `${String(n).padStart(2, '0')}-${name}.png`);
  await b.shot(file);
  log.push({ shot: path.basename(file) });
};
const note = async (step, expr) => {
  const value = await ev(expr);
  log.push({ step, observed: value });
  console.log(`- ${step}: ${String(value).slice(0, 400)}`);
  return value;
};
const sec = (start, len = 200) => `const v = __vis(); const i = v.indexOf(${JSON.stringify(start)}); return i < 0 ? 'NÃO ENCONTRADO: ' + ${JSON.stringify(start)} : v.slice(i, i + ${len});`;

try {
  await b.navigate(BASE);
  await ev(`for (let i = 0; i < 120 && !document.querySelector('input'); i++) await __sleep(500); await __sleep(500); return true;`);
  await shot('login');

  // Cadastro e login com dados fictícios
  await ev(`__click('Não possui conta? Cadastre-se'); await __sleep(600); return true;`);
  await ev(`__set('Nome Completo', 'Pessoa Teste'); __set('E-mail', 'teste@exemplo.com'); __set('Senha', 'senhaTeste1'); __set('Confirmar Senha', 'senhaTeste1'); await __sleep(200); __click('Cadastrar'); await __sleep(600); return true;`);
  await note('Cadastro com dados fictícios', sec('Cadastro Realizado', 60));
  await ev(`__click('OK'); await __sleep(800); __set('E-mail', 'teste@exemplo.com'); __set('Senha', 'senhaTeste1'); await __sleep(200); __click('Entrar'); await __sleep(1500); return true;`);
  await note('Após login (conexão simulada automática)', sec('MODO DE SIMULAÇÃO', 260));
  await shot('conexao-simulado-conectado-automaticamente');
  await ev(`__click('Desconectar'); await __sleep(500); return true;`);
  await note('Após Desconectar', sec('MODO DE SIMULAÇÃO', 200));
  await shot('conexao-simulacao-desconectado');

  await ev(`__click('Monitor'); await __sleep(600); return true;`);
  await note('Monitor sem conexão', sec('Não conectado', 120));
  await shot('monitor-nao-conectado');

  // Busca e conexão simulada
  await ev(`__click('Conexão'); await __sleep(400); __click('Buscar Dispositivos'); await __sleep(1800); return true;`);
  await shot('conexao-dispositivo-simulado-encontrado');
  await ev(`__click('HydroBot simulado'); await __sleep(900); __click('Monitor'); await __sleep(150); return true;`);
  await note('Monitor antes da 1ª leitura', sec('Preparando', 120));
  await shot('monitor-preparando-simulacao');
  await sleep(1200);
  await note('Monitor com leitura (sem fogo)', sec('Leituras SIMULADAS', 400));
  await shot('monitor-leituras-simuladas');
  await ev(`__click('Conexão'); await __sleep(500); return true;`);
  await note('Conexão conectada', sec('Conectado ao dispositivo simulado', 220));
  await shot('conexao-conectado-simulado');

  // Cenários de fogo
  await ev(`__click('Configurações'); await __sleep(600); return true;`);
  await shot('configuracoes-simulacao');
  await ev(`__click('Elevada'); await __sleep(200); __click('Monitor'); await __sleep(400); __scrollTo('Detecção de Fogo'); return true;`);
  const high = [];
  for (let k = 0; k < 4; k++) {
    await sleep(650);
    high.push(await ev(sec('Detecção de Fogo', 140)));
  }
  log.push({ step: 'Fogo elevado, 4 atualizações', observed: high });
  console.log('- fogo elevado:', high.map((h) => h.split('|').slice(2, 6).join('|')));
  await shot('monitor-fogo-elevado');
  await ev(`__click('Configurações'); await __sleep(400); __click('Sem fogo'); await __sleep(200); __click('Monitor'); await __sleep(300); __scrollTo('Detecção de Fogo'); return true;`);
  const stop = [];
  for (let k = 0; k < 5; k++) {
    await sleep(650);
    stop.push(await ev(sec('Detecção de Fogo', 140)));
  }
  log.push({ step: 'FIRE_STOP, 5 atualizações', observed: stop });
  console.log('- após cancelar:', stop.map((h) => h.split('|').slice(2, 6).join('|')));
  await shot('monitor-fogo-cancelado');

  // Parâmetros: inválidos e válidos
  await ev(`__click('Configurações'); await __sleep(500); __scrollTo('Limiar de Detecção', 'center'); return true;`);
  for (const bad of ['', '20abc', '50.5', '1e2', '19', '200']) {
    await ev(`__set('Limiar de Detecção', ${JSON.stringify(bad)}); __blur('Limiar de Detecção'); await __sleep(200); return true;`);
    await note(`Limiar = "${bad}"`, `const v = __vis(); const i = v.indexOf('Limiar de Detecção | Aplicar'); return v.slice(i + 29, i + 120);`);
    if (bad === '20abc') await shot('parametro-invalido');
  }
  await ev(`__clickLabel('Aplicar Limiar de Detecção'); await __sleep(300); return true;`);
  await note('Aplicar com valor inválido (foco/erro)', `return document.activeElement?.getAttribute('aria-label');`);
  await ev(`__set('Limiar de Detecção', '100'); await __sleep(100); __clickLabel('Aplicar Limiar de Detecção'); await __sleep(400); return true;`);
  await note('Limiar = 100 aplicado', `const v = __vis(); const i = v.indexOf('Limiar de Detecção | Aplicar'); return v.slice(i + 29, i + 200);`);
  await shot('parametro-aplicado');
  await ev(`__click('Configurações'); await __sleep(300); __click('Detecção'); await __sleep(200); __click('Monitor'); await __sleep(1500); __scrollTo('Detecção de Fogo'); return true;`);
  await note('Monitor usa limiar aplicado', sec('Detecção de Fogo', 260));
  await shot('monitor-faixas-com-parametros-aplicados');

  // Movimento simulado
  await ev(`__click('Controle'); await __sleep(600); window.__release = await __hold('Mover para frente', 500); return true;`);
  await note('Segurando "frente"', sec('Movimento (simulação)', 45));
  await shot('controle-movimento-frente');
  await ev(`window.__release(); await __sleep(400); return true;`);
  await note('Após soltar', sec('Movimento (simulação)', 45));

  // Bomba, AUTO e emergência
  await ev(`__click('Ligar'); await __sleep(300); __click('MANUAL'); await __sleep(400); return true;`);
  await note('AUTO + bomba ligada', sec('Modo Automático', 300));
  await shot('controle-auto-bomba-ligada');
  await ev(`__clickLabel('Parada de emergência'); await __sleep(500); return true;`);
  await note('Emergência no Controle', sec('Parada aplicada', 360));
  await shot('controle-apos-emergencia');
  await ev(`__click('Ligar'); await __sleep(200); __click('MANUAL'); await __sleep(200); __click('Configurações'); await __sleep(300); __click('Elevada'); await __sleep(200); __click('Monitor'); await __sleep(600); __clickLabel('Parada de emergência'); return true;`);
  await sleep(2000);
  await note('Emergência no Monitor após 2 s', `const v = __vis(); return ['Bomba de Água', 'Status do Sistema', 'Detecção de Fogo', 'Parada'].map(s => { const i = v.indexOf(s); return v.slice(i, i + 110); }).join(' ### ');`);
  await ev(`__scrollTo('Bomba de Água'); return true;`);
  await shot('monitor-apos-emergencia');

  // Falha parcial
  await ev(`__click('Controle'); await __sleep(400); __click('Ligar'); await __sleep(200); __click('Configurações'); await __sleep(300); __scrollTo('Falha de envio simulada'); __click('Comandos da bomba'); await __sleep(200); __click('Controle'); await __sleep(400); __clickLabel('Parada de emergência'); await __sleep(500); return true;`);
  await note('Emergência com falha injetada na bomba', sec('Parada com falha parcial', 420));
  await note('Estado da bomba após falha', sec('Bomba de Água |', 80));
  await shot('emergencia-falha-parcial');
  await ev(`__click('Configurações'); await __sleep(300); __click('Nenhuma'); await __sleep(100); return true;`);

  // Água baixa com bomba ligada
  await ev(`__click('Água baixa (8%)'); await __sleep(200); __click('Controle'); await __sleep(400); __scrollTo('Bomba de Água'); return true;`);
  await note('Água baixa com bomba ligada', sec('Bomba de Água |', 200));
  await shot('agua-baixa-bomba-ligada');
  await ev(`__click('Desligar'); await __sleep(300); return true;`);
  await note('Após desligar com água baixa', sec('Bomba de Água |', 240));
  await shot('agua-baixa-bomba-desligada');

  // Ajuda
  await ev(`__click('Configurações'); await __sleep(300); __scrollTo('Ajuda', 'center'); __click('Ajuda'); await __sleep(500); return true;`);
  await shot('ajuda');
  await ev(`__click('OK'); await __sleep(300); return true;`);

  // Desconexão
  await ev(`__click('Conexão'); await __sleep(300); __click('Desconectar'); await __sleep(400); __click('Monitor'); await __sleep(400); return true;`);
  await note('Monitor após desconectar', `return [__vis().includes('para ver os dados'), __vis().includes('Leituras SIMULADAS')].join(' / ');`);
  await shot('monitor-apos-desconectar');

  log.push({ console: b.console });
  console.log('console errors/warnings:', b.console.length, b.console.slice(0, 5));
} catch (e) {
  console.error('FALHA NO ROTEIRO:', e.message);
  log.push({ error: e.message });
  await b.shot(path.join(OUT, 'erro.png')).catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(OUT, 'roteiro-web.log.json'), JSON.stringify(log, null, 2));
  b.close();
}
