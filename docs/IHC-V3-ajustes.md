# HydroBot — ajustes de IHC (3ª entrega)

> Detalhamento por arquivo. O resultado consolidado e mais recente das verificações está em [`RELATORIO_ALTERACOES_IHC_HYDROBOT.md`](../RELATORIO_ALTERACOES_IHC_HYDROBOT.md).
>
> Este detalhamento corresponde à versão `f103d1a`. Os ajustes posteriores (`56b1ce2`: indicador compacto no cabeçalho, aba “Ajustes”, modal de emergência, seleção de água, teclado no login e em Aplicar, limpeza de mensagens por sessão) estão na seção A do relatório. As capturas citadas aqui (`docs/evidencias/web/`) foram substituídas por `docs/evidencias/verificacao/` e continuam disponíveis no commit `e34fe74`.

Branch: `ihc-v3-ajustes`, criada a partir de `master` em `a806ef9` (a mesma versão usada na análise).
Os 11 problemas dos testes em sala não foram reexecutados aqui. Os itens abaixo são ajustes adicionais vindos da inspeção do código e da interface, e **não** são resultados de novos testes com participantes.

Tipos de verificação usados na tabela:

- **Lógica**: testes automatizados (`npm test`, 15 testes) sobre o simulador e a validação.
- **Web**: roteiro automatizado no build web de produção (`expo export`) em Chrome headless, viewport 390×844, Modo de Simulação. Log em `docs/evidencias/web/roteiro-web.log.json`.
- **Código**: só inspeção do código, sem execução.
- **Android**: nada foi executado em Android nesta entrega (**não verificado**).

## Arquivos alterados

| Arquivo | Mudança | Problema resolvido |
| --- | --- | --- |
| `context/BluetoothContext.tsx` | Reescrito. `sendCommand` passou a retornar `CommandOutcome` (`applied-sim`, `sent` ou `failed`) e não abre mais `Alert`. Cada sessão tem uma geração: na troca de modo, desconexão ou perda de conexão, a busca, os temporizadores, a assinatura BLE e a conexão física são encerrados, e callbacks de sessões antigas são descartados. Inclui `emergencyStop` centralizado, `waitForConfirmation` (confirmação por telemetria ou resposta `*_SET:`), avisos via `notice` e anúncios para leitor de tela só em mudanças de conexão, modo, fogo e água baixa. | §4, §5 e §6: sucesso falso, mistura de modos, conexão real mantida ao passar para a simulação, dados antigos tratados como atuais |
| `services/simulator.ts` (novo) | Dispositivo simulado puro e determinístico (semente). Tem cenários de fogo (`none`, `detected`, `reference`, `high`) presos à faixa escolhida, parâmetros em campos próprios, movimento simulado, bomba com estado e PWM, água simulada e AUTO sem deslocamento. | §4 e §5: intensidade aleatória, `FIRE_STOP` desfeito pela atualização periódica, parâmetros gravados nos sensores, `STOP` sem efeito |
| `services/fireLevels.ts` (novo) | Faixas, rótulos, cores e ícones de intensidade compartilhados pela simulação, pelo Monitor e pela validação. | §4: regra fixa no Monitor diferente da configuração |
| `services/telemetry.ts` (novo) | Tipo `Telemetry` com campos opcionais (ausente = “sem leitura”) e origem (`sim`/`ble`). | §4: ausência de dado exibida como 0 |
| `services/bleTransport.ts` / `.web.ts` (novos) | Transporte BLE separado por plataforma. O `BleManager` só é criado no primeiro uso; a versão web não importa `react-native-ble-plx`. | §9: o app não abria na web |
| `services/bleService.ts` (removido) | Não era importado por nenhuma tela e duplicava o transporte com outra lógica. | §2: duas implementações divergentes |
| `services/hydroBotProtocol.ts` | Passou a ser a fonte única de UUIDs, codificação e parsing (inclui campos dos sensores e `ACK_PREFIX_BY_COMMAND`). O `DEFAULT_TELEMETRY` sem uso, que preenchia com 0, foi substituído por uma nota. | §2 e §5 |
| `utils/validation.ts` | `parseDecimalInteger` (aceita só o texto inteiro, só dígitos) e `validateFireParam` (faixa e ordem limiar < referência < perigo). | §7 |
| `app/(tabs)/index.tsx` | Texto “Busque pelo HydroBot compatível com Bluetooth Low Energy (BLE)”, distinção “Conectado ao dispositivo simulado” × “Conectado via Bluetooth BLE”, botão Parar busca e rótulos acessíveis. | §3 e §4 |
| `app/(tabs)/control.tsx` | Reescrito. Feedback por comando (enviado, aguardando, confirmado, falha), movimento simulado visível, segurar/soltar com alternativa por toque quando há leitor de tela, bomba com Ligar/Desligar separados (desligar nunca bloqueado), “Configurar sensores” e parada de emergência fixa. | §5, §6 e §8 |
| `app/(tabs)/monitor.tsx` | Reescrito. Estados “Não conectado”, “Preparando simulação…”/“Aguardando dados” e “Dados desatualizados”. Usa “sem leitura” no lugar de 0, faixas com os parâmetros aplicados, “Intensidade simulada — unidade relativa”, rótulo de texto em cada sensor, “Calibração simulada” e parada de emergência fixa. | §4, §5 e §8 |
| `app/(tabs)/settings.tsx` | Painel de simulação com cenários de fogo, água simulada e falha de envio simulada. Campos validados com `onBlur` em todos, sliders protegidos durante o arraste, PWM mín ≤ máx, “Intensidade de Referência”, Ajuda reescrita e rodapé “Bluetooth Low Energy (BLE)”. | §3, §4, §6 e §7 |
| `app/(tabs)/_layout.tsx` | Aba inativa `#6B7280`, reinício com `AppModal`, `NoticeHost` e barra de abas sem corte dos rótulos. | §6 e §8 |
| Conexão automática da simulação | Com a simulação ativa, o dispositivo simulado conecta sozinho ao abrir o app e ao ativar o modo; o usuário ainda pode desconectar e reconectar em Conexão. Evita a regressão do problema I3 (Monitor “Não conectado” com a simulação ativa). | I3 |
| `components/ModeBanner.tsx` (novo) | Indicador de origem igual nas quatro abas, com ícone, texto e cor. | §4 |
| `components/EmergencyStopBar.tsx` (novo) | Parada de emergência fixa no rodapé de Controle e Monitor, sem confirmação prévia, com resultado por comando. | §5 |
| `components/ParamField.tsx`, `SliderSetting.tsx`, `FeedbackLine.tsx`, `NotConnectedCard.tsx`, `NoticeHost.tsx` (novos) | Campo validado, slider com − / +, linha de estado, cartão “não conectado” e host de avisos. | §6, §7 e §8 |
| `hooks/useCommandFeedback.ts`, `hooks/useScreenReader.ts` (novos) | Descreve o resultado sem exagerar. Detecta TalkBack; na web sempre `false`, porque o react-native-web responde `true` fixo. | §5 e §8 |
| `components/AppModal.tsx` | Foco no título ao abrir e devolução do foco ao controle que abriu o modal (`returnFocusRef`), `accessibilityViewIsModal`, papel de cabeçalho, mensagem rolável e botões de 48 dp. | §6 e §8 |
| `app/login.tsx`, `app/register.tsx` | Papéis de botão/link, área de toque do link e cor do placeholder. Fluxo inalterado. | §8 |
| `app.json` | `web.output: "single"` (SPA; o modo `static` executa o app no Node durante a exportação), `userInterfaceStyle: "light"` (as telas usam paleta clara fixa) e textos de permissão iOS sem “Arduino”. | §8 e §9 |
| `package.json` | Scripts `test` e `build:web`. | §10 |
| `tests/*` (novos) | Testes de lógica com o test runner do Node, sem dependências novas. | §10 |

UUIDs, comandos do protocolo e o formato da telemetria real não foram alterados. Os comandos `FIRE_SIM[:NÍVEL]`, `FIRE_STOP` e `SIM_WATER:n` existem só na simulação.

## Comandos executados

| Comando | Resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 erros (antes: 0) |
| `npx eslint .` | 0 erros e 0 avisos (antes: 2 avisos `array-type` em `hydroBotProtocol.ts`, corrigidos) |
| `npm test` | 15 testes, 15 aprovados |
| `npx expo export --platform web` | Bundle gerado (`dist/`, 1,6 MB de JS). O bundle não contém `react-native-ble-plx` |
| Roteiro web (Chrome headless) | Todas as etapas concluídas, sem erros nem avisos no console |
| Build Android (`expo run:android` / EAS) | **Não executado** |

## Verificação por problema

| Problema | Alteração | Cenário executado | Resultado observado | Tipo | Pendência |
| --- | --- | --- | --- | --- | --- |
| Textos HC-05/HC-06 incompatíveis com BLE | Textos de Conexão, Configurações, Ajuda e permissões | Busca de “HC-0” e “Arduino” no projeto | Nenhuma ocorrência fora de `node_modules` | Código + Web | — |
| Origem simulada pouco clara | `ModeBanner` nas 4 abas e “Leituras SIMULADAS” | Percorrer as 4 abas (capturas 03–09) | Faixa “MODO DE SIMULAÇÃO” com ícone e texto em todas | Web | Android não verificado |
| Conexão simulada parecia física | Textos distintos em Conexão | Buscar e conectar (05, 08) | “Conectado ao dispositivo simulado… Nenhum robô físico está sendo controlado” | Web | — |
| Ausência de dados exibida como 0% e crítico | Telemetria opcional e estados de espera | Monitor sem conexão e logo após conectar (04, 06) | “Não conectado” e “Preparando simulação…”, sem números | Web | BLE sem telemetria: só código |
| Dados antigos após desconectar | Sessão invalidada limpa a telemetria; aviso de dados desatualizados após 5 s | Desconectar e abrir o Monitor (23) | “Não conectado”, nenhuma leitura antiga | Web | Perda de conexão BLE real: só código |
| Mistura de modos e conexão física mantida ao trocar | `toggleMockMode` → `teardown()` encerra busca, conexão e temporizadores; callbacks antigos descartados | — | — | Código | **Não verificado em execução**: na web não há BLE; requer Android |
| `FIRE_STOP` desfeito / intensidade incoerente | Cenários persistentes na faixa | Elevada por 4 ciclos e Sem fogo por 5 ciclos (10, 11); testes de lógica com 200–300 ciclos | Elevada: 399–423 “Acima da intensidade de perigo”. Cancelado: 10–14 “Abaixo do limiar”, sem retorno | Lógica + Web | — |
| Parâmetros gravados nos sensores | `params` próprios; base dos sensores intacta | `SET_FIRE_*` nos testes; limiar 100 aplicado e Monitor (13, 14) | Monitor: “detecção ≥ 100”, intensidade 161 “Acima do limiar” | Lógica + Web | — |
| Rótulos “Muito Perto/Aproximando/Combatendo” | Rótulos de faixa de intensidade em unidade relativa | Monitor (10) | “Acima da intensidade de perigo”, “Intensidade simulada — unidade relativa” | Web | — |
| “Distância Ideal” | Rótulo “Intensidade de Referência”, comando `SET_FIRE_IDEAL` mantido | Configurações (12) | Rótulo e ajuda novos | Web | Confirmar o significado no firmware |
| Validação com `parseInt` | Texto inteiro só com dígitos, `onBlur` em todos os campos, erro junto ao campo | `""`, `20abc`, `50.5`, `1e2`, `19`, `200` e Aplicar inválido (12) | Mensagem específica para cada caso; Aplicar inválido mantém o foco no campo e não envia comando | Lógica + Web | — |
| Ordem dos parâmetros | Regra limiar < referência < perigo, explicada na tela | Limiar 200 com referência 200 | “Deve ser menor que a intensidade de referência em vigor (200).” | Lógica + Web | — |
| Telemetria sobrescrevendo slider | Sincroniza só fora do arraste e quando o valor muda | — | — | Código | Arraste com telemetria a 600 ms não reproduzido na web |
| PWM mín > máx | Limites dos sliders dependentes e recusa na simulação | Teste `SET_PWM_MIN:210` com máx 200 | Recusado | Lógica | — |
| `STOP` sem efeito e sem movimento simulado | Estado `motion` | Segurar “frente” e soltar (15) | “Para frente” durante o toque e “Parado” ao soltar | Lógica + Web | TalkBack: não verificado |
| Bomba “LIGADA” com “0%” | PWM simulado = PWM máx | Ligar (16) | “Ligada · PWM 255 de 255 (100%)” | Lógica + Web | — |
| Água baixa bloqueava desligar | Bloqueio só para ligar; Ligar/Desligar separados | Água 8% com bomba ligada e Desligar (20, 21) | Desligou; Ligar ficou desabilitado com motivo visível | Lógica + Web | — |
| Emergência fora de alcance e com sucesso falso | Barra fixa em Controle e Monitor e resultado por comando | AUTO + fogo elevado + bomba; emergência nas duas abas (16–18) | Movimento parado, bomba desligada, modo Manual após 2 s; fogo mantido (392) | Lógica + Web | BLE: só código |
| Falha parcial da emergência | Cada comando é tentado e informado | Falha injetada na bomba (19) | “Parada com falha parcial”: bomba “falhou”, os outros aplicados, bomba segue “Ligada” | Web | Falha BLE real: só código |
| Mensagem de modo obsoleta após emergência | Feedbacks limpos ao receber o relatório | Emergência após trocar o modo | Encontrado e corrigido durante o teste web | Web | — |
| “Calibrar Sensores” não calibrava | Renomeado para “Configurar sensores” | Controle | Rótulo novo; badge “Calibração simulada” | Web | — |
| Ajuda com promessas | Ajuda reescrita (22) | Abrir Ajuda | Texto descreve o comportamento real; modal rolável | Web | — |
| Contraste | Novas cores | Cálculo WCAG (tabela abaixo) | Todos os pares de texto ≥ 4,5:1 | Cálculo | Conferir em aparelho |
| Nomes acessíveis e papéis | Rótulos, papéis e estados nos controles | Árvore de acessibilidade na web | Ex.: botão “Mover para frente”, “Aplicar Limiar de Detecção”, switch “Modo de Simulação” desabilitado | Web | TalkBack: **não verificado** |
| Rótulos da barra de abas cortados | Altura, `lineHeight` e `flexShrink: 0` | Captura da barra de abas | “Configurações” sem corte | Web | Barra de navegação Android: não verificado |
| App não abria na web | Transporte por plataforma | Build da versão inicial `a806ef9` × final | Inicial: página em branco, `TypeError: Cannot read properties of undefined (reading 'createClient')` (`web-versao-inicial-a806ef9.png`). Final: funciona | Web | — |
| Fontes ampliadas, teclado aberto, telas menores | Textos com quebra, botões de 48 dp, modal rolável | — | — | Código | **Não verificado** em Android |

### Contraste recalculado

| Elemento | Antes | Depois |
| --- | --- | --- |
| Abas não selecionadas | `#9CA3AF`/`#FFF` 2,54:1 | `#6B7280`/`#FFF` 4,83:1 |
| Erros de parâmetros | `#EF4444`/`#FFF` 3,76:1 | `#B91C1C`/`#FFF` 6,47:1 |
| “Calibrado” | `#10B981`/`#ECFDF5` 2,41:1 | `#047857`/`#ECFDF5` 5,21:1 |
| Ausência de fogo | `#10B981`/`#FFF` 2,54:1 | `#047857`/`#FFF` 5,48:1 |
| Faixa de referência | `#F59E0B`/`#F3F4F6` 1,95:1 | `#9A3412`/`#F3F4F6` 6,64:1 |
| Detecção | `#FCD34D`/`#F3F4F6` 1,31:1 | `#92400E`/`#F3F4F6` 6,44:1 |
| Branco no botão azul da bomba | `#FFF`/`#3B82F6` 3,68:1 | `#FFF`/`#1D4ED8` 6,70:1 |
| Faixa “MODO DE SIMULAÇÃO” | — | `#78350F`/`#FEF3C7` 8,15:1 |
| Botão de emergência | — | `#FFF`/`#991B1B` 8,31:1 |

Os valores “antes” calculados pelo script coincidem com os da análise. Amarelo, laranja e verde claros continuam só em barras e ícones, sempre acompanhados de texto.

## Limitações que dependem de firmware, hardware ou teste nativo

- **Confirmação de comandos BLE**: o app só diz “confirmado” se a telemetria seguinte mostrar o novo valor (modo, bomba, parâmetros) ou se chegar a resposta `*_SET:valor` listada em `services/hydroBotProtocol.ts`. Não foi confirmado se o firmware atual envia essas respostas ou os campos `fire_thresh`/`fire_ideal`/`fire_danger`. Sem isso, a tela mostra “enviado, sem confirmação”.
- **Escala dos parâmetros de fogo**: o arquivo de protocolo registrava padrões 200/1400/800, fora das faixas da tela (20–200, 200–600, 100–400). As faixas da tela foram mantidas; a escala real precisa ser confirmada no firmware.
- **Emergência no BLE**: o app envia `STOP`, `PUMP_OFF` e `MODE_MANUAL` (todos do contrato). Não foi verificado se o firmware sai do AUTO com `MODE_MANUAL`, nem se o movimento para fisicamente.
- **Movimento no BLE**: o protocolo não confirma movimento; a tela mostra apenas o último comando enviado.
- **TalkBack**: na web, `announceForAccessibility` não faz nada e não há como detectar leitor de tela. Não foram verificados o modo de toque duplo dos direcionais, o foco nos modais, o retorno de foco ao fechar (implementado; verificado só na web) e os anúncios.
- **Troca BLE ↔ simulação**: o encerramento da conexão física foi conferido só por inspeção do código.
- **Build nativo**: `react-native-ble-plx` exige development build (`expo-dev-client`/EAS). O Expo Go comum não basta.
- **Tema escuro**: o app foi fixado no tema claro (`userInterfaceStyle: "light"`) para não misturar componentes nativos escuros com a paleta clara fixa. Validar em aparelho.

## Como executar

```bash
npm install
npm test
npx expo start --web
```

Para gerar e servir o build web de produção:

```bash
npm run build:web
npx expo serve --port 8095
```

Abra `http://localhost:8095/`. O `expo serve` não tem fallback de SPA: um recarregamento numa rota interna (ex.: `/monitor`) dá 404. Para hospedar, use um servidor estático que devolva `index.html` para qualquer rota.

Android, com o BLE real:

```bash
npx expo run:android
```

Na web, use dados fictícios em Cadastro/Login (ficam no `localStorage` do navegador). O Modo de Simulação fica sempre ativo e o switch aparece desabilitado com explicação.

## Evidências

- `docs/evidencias/web/01–23-*.png`: capturas do build final, 390×844 a 2×.
- `docs/evidencias/web/roteiro-web.log.json`: texto observado em cada etapa.
- `docs/evidencias/roteiro-simulacao-web.gif`: sequência das capturas (não é gravação de tela) com navegação, fogo/cancelamento, edição inválida, emergência em AUTO e falha parcial.
- `docs/evidencias/web-versao-inicial-a806ef9.png`: versão inicial na web (página em branco). Para gerá-la, o `web.output` da cópia temporária foi trocado para `single`, e o código não foi alterado.
