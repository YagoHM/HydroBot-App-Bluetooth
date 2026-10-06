# Relatório técnico — alterações de IHC no HydroBot (pré-build Android)

## Identificação

| Item | Valor |
| --- | --- |
| Repositório | `https://github.com/YagoHM/HydroBot-App-Bluetooth` (o `origin` local aponta para `YagoHM/HydroBotBluetooth.git`, que o GitHub redireciona) |
| Base analisada | `master` @ `a806ef9` (“Cadastro & Login”) |
| Branch | `ihc-v3-ajustes` |
| Versões anteriores revisadas | `3662cce` (código `56b1ce2`, seção A) e `e34fe74` (código `f103d1a`, histórico) |
| **Versão verificada neste relatório** | Código de **`51ac9a6`** (teclado, fonte ampliada e acessibilidade; seção B). A seção A descreve a versão anterior, `56b1ce2`. O commit seguinte só atualiza este relatório |
| Escopo | Interface mobile, usabilidade, comunicabilidade e acessibilidade. O Modo de Simulação é um recurso para testar a interface; não valida o robô físico |

### Como ler as verificações

| Rótulo | Significado |
| --- | --- |
| **Lógica** | Testes automatizados executados (`npm test`, 33 testes nesta versão) sobre o simulador, a validação, a descrição da emergência, os cálculos de layout/teclado e a compatibilidade BLE. |
| **Web** | Roteiro com **asserções** (`scripts/verificacao-web/verify.mjs`) executado no **build web de produção**, em Chrome headless, viewport 390×844 (e 320×640 onde indicado), Modo de Simulação. Cada critério tem resultado esperado; uma divergência marca FALHOU e o processo termina com código 1. |
| **Código** | Apenas análise do código-fonte, sem execução. |
| **Pendente (Android)** | Depende do aplicativo instalado; nada foi executado em Android nesta etapa. |

Nada aqui é reteste com participantes nem validação do robô físico. A execução web não comprova teclado virtual, TalkBack, fontes ampliadas nem as barras de navegação do Android.

---

## B. Ajustes desta versão (`51ac9a6`): teclado, fonte ampliada e acessibilidade

Base: `3662cce` (código `56b1ce2`). Nenhum vídeo foi recebido; os problemas vêm da descrição do pedido. Ordem de execução: C1–C3, depois M1–M4 e por fim os itens condicionais.

### Status por item

| Item | Causa encontrada | Alteração | Arquivos | Verificação executada | Status |
| --- | --- | --- | --- | --- | --- |
| **C1** Teclado encobre campos em Ajustes | **Código:** com `edgeToEdgeEnabled`, o Android não redimensiona a janela; o `ScrollView` de Configurações não reservava a área do teclado nem rolava até o campo | `useKeyboardHeight` + `keyboardOverlap` (teclado menos a barra de abas) viram `paddingBottom` do conteúdo, só com o teclado aberto. Ao focar, ou quando o cartão cresce com erro ou resultado, a tela rola até o cartão inteiro (título, campo, Aplicar, mensagem). `keyboardShouldPersistTaps="handled"`, validações e aplicação no primeiro toque mantidos | `app/(tabs)/settings.tsx`, `components/ParamField.tsx`, `hooks/useKeyboardHeight.ts`, `utils/layoutMetrics.ts` | **Lógica** (6 testes): sobreposição zera ao fechar; item encoberto sobe com título visível; item maior que a área livre alinha o topo. **Web** C1a/C1b/C1c: foco em “Intensidade de Perigo” sem rolagem do navegador traz o cartão inteiro para a área visível; após “700” + Aplicar, erro e Aplicar visíveis; sem teclado, nenhum espaço extra. C1a/C1b falham na versão anterior. A web não tem teclado virtual: a compensação da altura do teclado não foi exercitada | **Corrigido**; teclado real **pendente (Android)** |
| **C2** Cartão de Conexão cortado com fonte ampliada | **Código:** `View` com `flex: 1` e `justifyContent: 'center'`, sem rolagem: o conteúdo maior que a área transbordava para cima (sob o cabeçalho) e para baixo (sob as abas) | `ScrollView` com `flexGrow: 1` + centralização: centraliza quando cabe e rola quando não cabe. Botão Desconectar com texto que se ajusta à largura. Textos de simulação/BLE mantidos | `app/(tabs)/index.tsx` | **Web** C2a (altura útil reduzida, 390×460): o cartão rola; Desconectar inteiro acima das abas; título abaixo do cabeçalho. Falha na versão anterior (`rola: false`). C2b (fonte ×1,8, aproximação): passa, mas também passava antes | **Corrigido**; fonte máxima **pendente (Android)** |
| **C3** Fonte alterada com o app aberto causa cortes | **Código do RN 0.81 (`node_modules/react-native`):** o `SurfaceHandler` do Fabric só remede os textos quando `layoutContext.fontSizeMultiplier` muda, e esse valor só acompanha o sistema com a feature flag `enableFontScaleChangesUpdatingLayout`, **desligada por padrão** (`ReactNativeFeatureFlagsDefaults`). Sem `fontScale` em `configChanges`, a Activity é recriada e o `MainActivity` do Expo chama `super.onCreate(null)`: a árvore React é montada de novo | Config plugin `plugins/withFontScaleRelayout.js`: (1) liga a flag com `ReactNativeFeatureFlags.dangerouslyForceOverride` após `loadReactNative`; (2) acrescenta `fontScale` a `configChanges` (preserva sessão, rota, edição e conexão); (3) no `onConfigurationChanged`, força nova medição da raiz. No JS, a barra de abas usa `useWindowDimensions().fontScale`. Sem reinício automático e sem desligar `allowFontScaling` | `plugins/withFontScaleRelayout.js`, `app.json`, `app/(tabs)/_layout.tsx` | **Executado:** `npx expo prebuild --platform android --clean` gerou o manifesto e o Kotlin esperados. **Não executado:** compilação nativa (não há Android SDK nesta máquina: `ANDROID_HOME` aponta para `D:\dev\android-sdk`, que não existe) e o comportamento no aparelho | **Implementado, não verificado** (compilação e efeito **pendentes no Android**). Se o build falhar ou o efeito não aparecer, basta remover a entrada do plugin no `app.json` para voltar ao comportamento anterior |
| **M1** Ícone da emergência cortado | **Código:** ícone e texto em linha sem `flexShrink` no texto; com o texto mais largo que o botão, o conteúdo centralizado transbordava pelos dois lados | Ícone com `flexShrink: 0`; texto com `flexShrink: 1`, centralizado e quebrando em linhas; padding interno. Envio imediato, nome acessível e posição mantidos | `components/EmergencyStopBar.tsx` | **Web** M1 (fonte ×1,8, 360 px): ícone e texto dentro do botão. A aproximação **não reproduz** o defeito (também passa na versão anterior) | **Corrigido no código**; **pendente (Android)** |
| **M2** Nomes das abas abreviados | **Código:** rótulo de uma palavra com largura fixa (¼ da tela) e altura fixa da barra | Altura da barra por `tabBarHeight(fontScale, inset)`; rótulo em uma linha com `adjustsFontSizeToFit` (`minimumFontScale` 0,5), reduzindo só o necessário para caber inteiro. Nomes, aba ativa e nomes acessíveis mantidos | `app/(tabs)/_layout.tsx`, `utils/layoutMetrics.ts` | **Lógica**: altura 68 dp na escala 1, 84 na escala 2, + inset. **Web** TAB: rótulos inteiros na escala 1. **Regressão encontrada e corrigida durante o teste**: o rótulo personalizado perdeu `minHeight`/`flexShrink` e voltou a ser comprimido (13 px para 16); o check TAB falhou e passou após a correção. A web não implementa `adjustsFontSizeToFit`: com fonte ×1,8 aparecem reticências na web (captura 24) | **Corrigido no código**; **pendente (Android)** |
| **M3** TalkBack parava em ícones decorativos | Ícones (`Ionicons` são `Text`) fora de controles recebiam foco próprio | Componente `components/Icon.tsx`: o mesmo `Ionicons` com `accessible={false}`, `importantForAccessibility="no-hide-descendants"`, `accessibilityElementsHidden` e `aria-hidden`. Usado em todas as telas e componentes; botões só com ícone mantêm o nome no próprio botão | `components/Icon.tsx` + imports em 15 arquivos | **Web** M3: 0 glifos expostos (a versão anterior tinha 30). Seleção dos rádios, mensagens e foco dos modais (M1/M2/M4 do roteiro) continuam aprovados | **Corrigido**; leitura no TalkBack **pendente (Android)** |
| **M4** Palavras fragmentadas no Monitor | **Código:** `infoItem` com `flex: 1` + `minWidth: '45%'` (e sensores com `flex: 1`) fixava a largura em ½ ou ⅓ da linha | Itens com largura pelo conteúdo (`flexBasis: 'auto'`, `flexShrink: 0`, `minWidth`, `maxWidth: '100%'`) e quebra para a linha seguinte: menos colunas quando a fonte cresce. Ordem, unidades e rótulo-valor mantidos | `app/(tabs)/monitor.tsx` | **Web** M4/M4b (fonte ×1,8): nenhuma palavra partida e valores completos. A aproximação **não reproduz** o defeito (também passa antes) | **Corrigido no código**; **pendente (Android)** |
| Condicional: demora até “Não conectado” ao sair da simulação | **Código:** `toggleMockMode` encerra a sessão e muda o modo antes de gravar a preferência; não há operação pendente que justifique um indicador | Nenhuma | — | Na web não é possível sair da simulação | **Não reproduzido**; observar no APK |
| Condicional: busca BLE sem demonstrar compatibilidade | Todos os dispositivos com nome eram listados da mesma forma | `classifyDiscovery` usa só os identificadores existentes (nome “HydroBot” e UUID de serviço): “Anuncia o serviço de dados usado pelo HydroBot (compatibilidade confirmada só ao conectar)”, “Nome indica HydroBot, mas o serviço não foi anunciado” ou “Compatibilidade com o HydroBot não verificada”; ordenação por indícios. Ao conectar, o app confere se o serviço existe e, se não, encerra com mensagem clara. O UUID é o Nordic UART padrão, por isso nenhum rótulo diz “validado” | `services/hydroBotProtocol.ts`, `services/bleTransport.ts`, `context/BluetoothContext.tsx`, `app/(tabs)/index.tsx` | **Lógica** (4 testes), incluindo que nenhum rótulo afirma validação. Busca e conexão BLE reais **não executadas** | **Corrigido no código**; **pendente (Android + robô)** |
| Condicional: emergência sem conexão repetia a causa | Cada ação mostrava “falhou — Não conectado…” | Quando todas as ações falham pela mesma causa, a causa aparece uma vez (“Nenhum comando de parada foi enviado: …”) e as ações são listadas como “Não enviados”. Falhas com causas diferentes e falha parcial mantêm o resultado por ação | `services/emergency.ts` | **Lógica** (2 testes novos). **Web** EM12/EM13: causa dita uma vez, sem sucesso; falham na versão anterior (3 repetições) | **Corrigido** |
| Direcionais com TalkBack | Sem defeito confirmado | Nenhuma | — | — | **Pendente (Android)**: toque duplo em uma direção para iniciar e em “Parar movimento” para encerrar; sem TalkBack, pressionar e soltar |

### Verificações executadas

| Comando | Resultado |
| --- | --- |
| `npx tsc --noEmit` | Saída 0 |
| `npm run lint` | Saída 0, sem avisos |
| `npm test` | 33 testes, 33 aprovados (12 novos: layout/teclado, compatibilidade BLE, emergência sem conexão) |
| `npx expo export --platform web --clear` | Saída 0; bundle sem `react-native-ble-plx` |
| `node scripts/verificacao-web/verify.mjs docs/evidencias/verificacao http://localhost:8090` | **66 critérios, 66 aprovados**, console sem erros (`saida-verificacao.txt`, `verificacao-web.json`) |
| Controle negativo: mesmo roteiro contra o build de `56b1ce2` | 59 aprovados, 7 falhas (EM12, EM13, M3, C1a, C1b, C1c, C2a): os critérios novos discriminam. M1, M4, C2b e TAB passam nas duas versões, logo não servem de prova para esses defeitos (`controle-negativo-56b1ce2.txt`) |
| `npx expo prebuild --platform android --clean --no-install` | Saída 0; `configChanges` com `fontScale`, flag no `MainApplication.kt` e `onConfigurationChanged` no `MainActivity.kt` gerados |
| Compilação Android / APK | **Não executada** (sem Android SDK nesta máquina) |

**Ajustes no ambiente de teste (não no app):** o Chrome headless só dispara `focus`/`blur` com `Emulation.setFocusEmulationEnabled`, agora ligado em `cdp.mjs`. O primeiro resultado negativo do C1 era desse ambiente: depois de ligar a emulação, a rolagem medida (1425) bateu com a calculada pela função testada. O build da versão anterior para o controle negativo precisou de `--clear`, porque o cache do Metro guardava o caminho de uma cópia temporária antiga.

**Limites da aproximação web de fonte ampliada:** o roteiro multiplica o tamanho dos textos na página. A web não aplica `maxFontSizeMultiplier` (limite de 1,4× no cabeçalho) nem `adjustsFontSizeToFit` (rótulos das abas). Por isso, na captura 24, o indicador sobrepõe “Reiniciar” e as abas aparecem com reticências. Isso não representa o Android e precisa ser conferido no aparelho.

### Capturas desta versão (`docs/evidencias/verificacao/`)

`21-c1-campo-perigo-visivel`, `22-c2-conexao-area-reduzida`, `23-m1-emergencia-fonte-ampliada`, `24-m4-monitor-fonte-ampliada`, `25-c2-conexao-fonte-ampliada`, `20-emergencia-sem-conexao` (causa resumida), além das capturas 01–19 e 26 da seção A, regeradas nesta versão. O GIF `docs/evidencias/roteiro-verificacao-web.gif` é uma sequência das capturas, não uma gravação de vídeo.

### Roteiro curto para o próximo APK

Gere com `eas build --platform android --profile preview`. O EAS executa o prebuild e aplica o plugin; se a compilação falhar no passo do `MainApplication`/`MainActivity`, registre o erro.

1. **Teclado (C1):** em Ajustes, toque em Limiar de Detecção e em Intensidade de Perigo, com fonte normal e máxima: título, campo, Aplicar e erro acima do teclado ou alcançáveis por rolagem. Digite 40 e toque uma vez em Aplicar (“Em vigor: 40”). Digite 700 (erro; o valor anterior continua em vigor). Feche o teclado: nenhum espaço vazio no fim.
2. **Conexão (C2):** com fonte máxima e simulação conectada, role o cartão; Desconectar inteiro e acionável acima das abas; título fora do cabeçalho.
3. **Mudança de fonte com o app aberto (C3):** com o app em Ajustes e um valor digitado, mude a fonte normal → máxima → normal nas configurações do Android e volte. Os textos não devem cortar; sessão, aba, valor digitado e conexão simulada devem permanecer.
4. **Emergência (M1):** com fonte máxima, ícone e “PARADA DE EMERGÊNCIA” inteiros; o toque abre o modal; confira também “ENVIANDO PARADA…”. Sem conexão: causa dita uma vez.
5. **Abas (M2):** com fonte máxima, “Conexão”, “Controle”, “Monitor” e “Ajustes” completos (podem aparecer menores), acima da barra do Android em navegação por gestos e por três botões.
6. **TalkBack (M3):** percorrer as quatro abas: sem paradas em ícones soltos; rádios com “selecionado”; modais com foco no título e retorno ao botão de origem; direcionais com toque duplo e “Parar movimento”.
7. **Monitor (M4):** com fonte máxima, “Velocidade”, “PWM Mín/Máx” e os nomes dos sensores sem palavras partidas; valores completos.
8. **BLE (condicional):** busca mostra os indícios de compatibilidade; conectar a um dispositivo sem o serviço do HydroBot deve falhar com mensagem clara; sair da simulação para BLE e observar o tempo até “Não conectado”.
9. **Regressão:** login, conexão automática da simulação, seleção de água, validações, cancelamento do fogo, limpeza de mensagens entre sessões e modal único de emergência.

---

## A. Ajustes da versão anterior (`56b1ce2`)

| # | Problema | Alteração | Arquivos | Verificação e resultado | Pendência no APK |
| --- | --- | --- | --- | --- | --- |
| 1 | Opções de água simulada sem indicação de seleção | Chips “Água baixa (8%)” e “Reabastecer (75%)” como grupo de rádio (`radiogroup`/`radio`), com fundo vermelho, texto branco e marca de seleção. O destaque vem da telemetria confirmada (`telemetry.water`), não do último toque. Linha “Nível atual na simulação: N%”. Em falha, a seleção não muda e a falha aparece abaixo; o sucesso é anunciado ao leitor de tela | `app/(tabs)/settings.tsx` | **Web** W0–W4: no início, só 75% selecionado; 8% passa a ser a única opção selecionada e o Monitor mostra 8%; 75% volta e o Monitor mostra 75%; com falha injetada, 75% continua selecionado e aparece “Água simulada em 8%: falhou” | Anúncio e estado “selecionado” no TalkBack |
| 2 | Faixas grandes de estado ocupavam espaço em todas as telas | Indicador compacto no cabeçalho, abaixo do título: ícone + texto curto (“Simulação · conectado”, “Simulação · conectando…”, “Simulação · desconectado”, “BLE · conectado/conectando…/desconectado”), com cores próprias e texto. A descrição acessível traz a explicação completa (“Os dados são gerados pelo aplicativo, sem controlar um robô físico.”), repetida em Configurações e na aba Conexão. O aviso local “Leituras SIMULADAS · geradas pelo app” do Monitor foi mantido | `components/HeaderTitle.tsx` (novo), `app/(tabs)/_layout.tsx`, `app/(tabs)/*.tsx`; removido `components/ModeBanner.tsx` | **Web** P-*: indicador correto nas quatro abas; descrição acessível completa; título e indicador sem truncamento e sem sobrepor “Reiniciar” nas quatro abas (390 px) e em Ajustes a 320 px; faixa antiga ausente; após Desconectar, “Simulação · desconectado” | Leitura no TalkBack; fontes ampliadas no cabeçalho; estados BLE (só Código) |
| 3 | Resultado da emergência pouco perceptível (caixa pequena) | Modal central único (`EmergencyModal`, montado uma vez no layout das abas). O toque chama `emergencyStop` sem confirmação prévia; o modal abre com “Executando parada de emergência…” e é atualizado com o resultado. Textos: simulação → “Parada de emergência aplicada na simulação” com “Movimento parado”, “Bomba desligada”, “Modo manual”; BLE → “Comandos de parada enviados”, só com estados que a telemetria posterior informar; falha parcial/total destacada, com resultado por ação e “Tentar novamente”. Fica aberto até “Fechar”/Voltar; Voltar é ignorado enquanto a parada está em andamento. Toques repetidos durante o envio reaproveitam a mesma operação, e só o acionamento mais recente atualiza o modal. Foco no título ao abrir e de volta ao botão de origem ao fechar. Conteúdo rolável e botões de 56 dp | `services/emergency.ts` (novo), `components/EmergencyModal.tsx` (novo), `components/EmergencyStopBar.tsx`, `context/BluetoothContext.tsx` | **Lógica** (6 testes): ordem dos comandos, textos de sucesso na simulação, envio BLE sem afirmar parada, estados informados só pela telemetria posterior, falha parcial e total. **Web** EM1–EM13: movimento e bomba ativos → modal com os três estados e estado real parado/desligada/manual; modal aberto após 2 s; Fechar devolve o foco ao botão e nada é retomado em 2 s; a partir de AUTO no Monitor, um único modal e modo Manual, com o fogo mantido; Esc (equivalente web do Voltar) fecha e devolve o foco; dois toques rápidos geram uma só apresentação; falha parcial com “Tentar novamente”, que atualiza o mesmo modal para sucesso; falha total; sem conexão | Botão Voltar físico; foco do TalkBack; fontes ampliadas no modal; caminho BLE. Na simulação os três comandos terminam no mesmo ciclo, então o estado “Executando…” não chega a aparecer na web (só Código) |
| 4 | Teclado encobria senha e “Entrar” no Login (00:05–00:11) | **Causa provável (Código):** `edgeToEdgeEnabled: true` no Android impede o redimensionamento da janela, e o `KeyboardAvoidingView` usava `behavior={undefined}` no Android, sem rolagem. Agora: `behavior="padding"`, `ScrollView` com `keyboardShouldPersistTaps="handled"`, e “próximo” no teclado (e-mail → senha → enviar). Cadastro recebeu o mesmo tratamento, por prevenção; nenhum problema foi observado nele | `app/login.tsx`, `app/register.tsx` | **Web** K1/K3: com altura útil de 400 px (proxy do teclado), o `ScrollView` do app rola e “Entrar”/“Cadastrar” ficam alcançáveis. Na versão anterior esses checks falham. K2: Enter na senha envia o login. M1: retorno do foco do modal de erro preservado | **Teclado real no Android** |
| 5 | “Configurações” truncado na aba | Rótulo da aba “Ajustes”; título da tela continua “Configurações”; nome acessível “Ajustes, tela de Configurações” | `app/(tabs)/_layout.tsx` | **Web** TAB: quatro rótulos inteiros, dentro da tela; TAB-a11y: nome acessível e título corretos | Barra de gestos e de 3 botões |
| 6 | Título dos sensores quebrava ao dividir a linha com o selo (00:49) | Título em linha própria; selo “Calibração simulada” em linha separada, abaixo | `app/(tabs)/monitor.tsx` | **Web** S1 (390 px) e S2 (320 px): nenhuma palavra partida e selo abaixo do título. Na versão anterior, S1 falha (selo ao lado) | Fontes ampliadas; quebra de texto nativa |
| 7 | Primeiro toque em Aplicar com teclado aberto não aplicava (01:45–01:47) | **Causa confirmada no código:** o `ScrollView` de Configurações não definia `keyboardShouldPersistTaps`; o padrão (`"never"`) faz o primeiro toque fora do campo só fechar o teclado. Agora `"handled"` em Configurações, Controle, Monitor, Login e Cadastro; Aplicar fecha o teclado só para valor válido e mantém o foco no campo em caso de erro | `app/(tabs)/settings.tsx`, `control.tsx`, `monitor.tsx`, `components/ParamField.tsx` | **Web** AP1: com o campo em foco, digitar 40 e um clique em Aplicar → “aplicado na simulação” e “Em vigor: 40”. AP2: 250 → erro, nenhum comando, foco no campo. AP3: vazio e relação inválida com as mensagens anteriores. AP4: apagar tudo continua possível. AP5: o Monitor segue em “detecção ≥ 40” depois dos erros. A web não tem teclado virtual: a causa não foi reproduzida em execução | **Primeiro toque com teclado aberto no Android** |
| 8 | “aplicado na simulação” continuava visível após voltar para BLE (02:08) | O contexto expõe `sessionId`, que muda sempre que a sessão é encerrada (troca de modo, desconexão, perda de conexão). Os feedbacks de comando são limpos, e respostas pendentes da sessão anterior são descartadas. Os sliders voltam ao valor informado pelo dispositivo ou ao padrão do app, sinalizado como “Sem leitura do dispositivo: o valor mostrado é o padrão do app”, e os campos descartam edição e erros antigos | `context/BluetoothContext.tsx`, `hooks/useCommandFeedback.ts`, `components/SliderSetting.tsx`, `components/ParamField.tsx` | **Web** SS1/SS2: velocidade “aplicado na simulação” some ao encerrar a sessão (Desconectar), e aparece o aviso de valor padrão. A troca para BLE não existe na web; ela usa o mesmo mecanismo (`teardown` → `sessionId`), verificado só por Código | **Voltar para BLE no APK** |
| — | Achado durante a verificação: o react-native-web ignora `accessibilityState` | Props `aria-checked`/`aria-busy`/`aria-disabled` adicionadas junto de `accessibilityState` nos rádios, switches e botões com estado (no Android, o RN 0.81 aceita as duas formas) | `settings.tsx`, `control.tsx`, `index.tsx`, `EmergencyStopBar.tsx` | **Web**: `aria-checked` presente nos rádios de água (W0–W4) | TalkBack |

### Verificações executadas

| Comando | Resultado |
| --- | --- |
| `npx tsc --noEmit` | Saída 0, sem erros |
| `npm run lint` | Saída 0, sem erros nem avisos |
| `npm test` | 21 testes, 21 aprovados (6 novos sobre a emergência) |
| `npm run build:web` | Saída 0 |
| `node scripts/verificacao-web/verify.mjs …` (na versão `56b1ce2`) | **57 critérios, 57 aprovados** naquela versão; os arquivos em `docs/evidencias/verificacao/` foram regerados na seção B |
| Controle negativo: mesmo roteiro contra o build de `f103d1a` | 34 falhas antes da interrupção (indicador, aba “Ajustes”, água, modal de emergência, selo dos sensores, rolagem do login e do cadastro), como esperado; os checks de preservação passaram nas duas versões (arquivo `controle-negativo-f103d1a.txt`, disponível no commit `3662cce`) |
| Android | **Não executado** |

As dependências não mudaram desde `f103d1a` (SDK 54; `expo-doctor` 18/18 naquela versão).

### Critérios do roteiro web (57)

- **Preservação:** I5 (rota protegida → login), M1 (foco do erro de login), I3 (Monitor com leituras logo após o login), T1/T2/T4 (temporizadores 1 → 0, máximo 1 em 5 ciclos), E5, E1 (fogo cancelado não volta em 5 ciclos), E2/AP4 (apagar valor), I1 (“Configurar sensores” → `/settings`), I2/I6 (Sobre com modal claro), M2/M4 (foco volta a Sobre e Reiniciar), I4 (texto de Conexão sem corte), E4 (sem emojis), console sem erros.
- **Ajustes desta versão:** K1–K3, P-Conexão/Controle/Monitor/Ajustes, P-desc, P-layout, P-faixa, P-320, P-desc2, TAB, TAB-a11y, W0–W4, AP1–AP5, S1–S2, EM1–EM13, SS1–SS2.

### Análise de código, sem execução

- Estado “Executando parada de emergência…” e envio BLE concorrente: `emergencyStop` define o estado `running` antes do primeiro comando; com BLE, a escrita é assíncrona e o estado fica visível. Na simulação, o resultado chega no mesmo ciclo.
- Voltar do Android durante a parada: `onRequestClose` só fecha quando `phase === "done"`.
- Troca para BLE e respostas pendentes: `invalidateSession` incrementa `sessionId`, e `useCommandFeedback` descarta atualizações de execuções anteriores (`runIdRef`).
- Teclado: `behavior="padding"` e `keyboardShouldPersistTaps="handled"` não foram exercitados com teclado virtual.

### Capturas executadas (`docs/evidencias/verificacao/`)

`01-login`, `02-login-altura-reduzida`, `03`–`06` indicador nas quatro abas, `07-barra-de-abas-ajustes`, `08-agua-8-selecionada`, `09-monitor-agua-8`, `10-agua-falha-selecao-mantida`, `11-aplicar-40-primeiro-toque`, `12-monitor-sensores-titulo`, `13-monitor-sensores-320px`, `14-indicador-320px`, `15-emergencia-simulacao-modal`, `16-emergencia-monitor-auto`, `17-emergencia-falha-parcial`, `18-emergencia-falha-total`, `19-ajustes-apos-desconectar`, `20-emergencia-sem-conexao`, `21-conexao-desconectado`. A sequência está em `docs/evidencias/roteiro-verificacao-web.gif` (capturas, não gravação de vídeo).

### Roteiro de reteste no novo APK

Gere o APK com `eas build --platform android --profile preview` a partir de `ihc-v3-ajustes` atualizada. No aparelho:

1. **Login com teclado:** toque em E-mail, use “próximo” até Senha; com o teclado aberto, os campos e “Entrar” devem continuar visíveis ou alcançáveis por rolagem; entre. Repita no Cadastro.
2. **Cabeçalho:** nas quatro abas, confira “Simulação · conectado” sob o título, sem cortes nem sobreposição com “Reiniciar”; repita com fonte do sistema no máximo.
3. **Abas:** “Conexão, Controle, Monitor, Ajustes” inteiras e acima da barra do Android, com navegação por gestos e por 3 botões.
4. **Água:** em Ajustes, toque em “Água baixa (8%)”: só ela selecionada; o Monitor mostra 8%. Volte para 75%. Com “Falha de envio simulada: Todos os comandos”, a seleção não deve mudar.
5. **Aplicar com teclado aberto:** digite 40 no Limiar e toque **uma vez** em Aplicar sem fechar o teclado → sucesso e “Em vigor: 40”. Teste 250 e campo vazio.
6. **Sensores:** no Monitor, título e “Calibração simulada” em linhas separadas, com fonte normal e ampliada.
7. **Emergência:** com movimento (segure uma seta) e bomba ligada, toque na parada → modal grande com os três estados; aguarde, feche e confirme que nada foi retomado. Repita no Monitor a partir de AUTO. Teste o botão Voltar com o resultado aberto. Teste falha parcial (“Comandos da bomba”) com “Tentar novamente”, falha total e sem conexão.
8. **Troca de modo:** aplique a velocidade na simulação e mude para BLE (desconectado): nenhuma mensagem “aplicado na simulação” deve continuar visível.
9. **TalkBack:** indicador do cabeçalho (descrição completa), rádios de água (estado selecionado), modal de emergência (foco no título ao abrir, de volta ao botão ao fechar), anúncios de resultado e direcionais por toque duplo.
10. **Regressão:** I1–I6 e E1–E5.

---

# Histórico — versão verificada anteriormente (`f103d1a`)

> As seções abaixo descrevem a versão anterior e continuam válidas onde não foram alteradas pela seção A. As capturas e logs citados (`docs/evidencias/web/`, `docs/evidencias/regressao/`, `roteiro-simulacao-web.gif`) foram substituídos por `docs/evidencias/verificacao/` e estão disponíveis no commit `e34fe74`. Os roteiros `flow.mjs` e `regress.mjs` foram incorporados ao `verify.mjs`. A faixa “MODO DE SIMULAÇÃO” citada abaixo foi substituída pelo indicador compacto, a aba “Configurações” passou a se chamar “Ajustes”, e o painel de resultado da emergência virou o modal da seção A.

## 0. Mudanças desta revisão (após `3cfd647`)

| Item | O que mudou | Verificação |
| --- | --- | --- |
| Dependências | `npx expo install --fix` atualizou 13 pacotes Expo **dentro do SDK 54** (`expo` 54.0.21 → 54.0.37, `expo-router` 6.0.14 → 6.0.24, `expo-dev-client` 6.0.16 → 6.0.21, `expo-constants`, `expo-font`, `expo-haptics`, `expo-image`, `expo-linking`, `expo-splash-screen`, `expo-status-bar`, `expo-symbols`, `expo-system-ui`, `expo-web-browser`). `react` 19.1.0, `react-native` 0.81.5 e `react-native-ble-plx` 3.5.0 não mudaram. O lockfile teve 239 entradas alteradas, todas ferramentas de build e dependências transitivas do Expo (Babel, Metro, `@expo/cli`, `lightningcss`…). A ferramenta também acrescentou os plugins `expo-font` e `expo-web-browser` ao `app.json` | Revisão manual de `package.json`, `app.json` e do diff do lockfile. `npx expo install --check`: “Dependencies are up to date”. `npx expo-doctor`: 18/18 checagens aprovadas. `npm audit`: de 64 vulnerabilidades (2 críticas) no lockfile anterior para 59 (1 crítica, `shell-quote`, transitiva). Não rodei `npm audit fix --force`, porque ele forçaria versões fora do SDK 54 |
| Retorno do foco nos modais | O `AppModal` aceita `returnFocusRef` e, ao fechar, devolve o foco ao controle que abriu o modal, depois de 300 ms (animação de saída). No Android, usa `AccessibilityInfo.setAccessibilityFocus` (foco do TalkBack); na web, `focus()`, e sem ref volta ao elemento que tinha o foco. Ligado em Sobre, Ajuda, switch do Modo de Simulação (confirmação e resultado), Reiniciar e nos erros de Login e Cadastro. Avisos de conexão (`NoticeHost`) não têm um controle de origem | **Web** (executado): com o modal aberto, o foco sai do controle (vai para um botão do modal) e volta a ele ao fechar, em Entrar (erro de login), Sobre, Ajuda e Reiniciar. **TalkBack: pendente** até haver app Android |

## 1. Alterações atuais

| Problema ou requisito | Alteração realizada | Arquivos | Verificação e resultado observado | Pendência no app instalado |
| --- | --- | --- | --- | --- |
| **BLE — textos incompatíveis** (HC-05/HC-06 com biblioteca BLE) | “Busque pelo HydroBot compatível com Bluetooth Low Energy (BLE)”, rodapé “Bluetooth Low Energy (BLE)”, Ajuda e texto de permissão iOS sem “Arduino”. UUIDs e comandos inalterados | `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx`, `app.json` | **Código**: busca por “HC-0” e “Arduino” fora de `node_modules` sem ocorrências. **Web**: textos novos exibidos | Conferir os textos com o modo BLE ativo |
| **BLE — transporte isolado por plataforma** | `BleManager` criado só no primeiro uso. A versão web (`bleTransport.web.ts`) não importa `react-native-ble-plx`. Removido `services/bleService.ts` (não usado e divergente) | `services/bleTransport.ts`, `services/bleTransport.web.ts`, `services/hydroBotProtocol.ts`, `context/BluetoothContext.tsx` | **Web**: o bundle de produção não contém `react-native-ble-plx` e o app abre. A versão inicial `a806ef9` abria em branco com `TypeError: Cannot read properties of undefined (reading 'createClient')` (`docs/evidencias/web-versao-inicial-a806ef9.png`) | Busca, conexão, notificações e escrita BLE com o robô; permissões Android 12+ |
| **Identificação da simulação** | Faixa “MODO DE SIMULAÇÃO” igual nas quatro abas, com ícone e texto além da cor. Conexão diferencia “Conectado ao dispositivo simulado” de “Conectado via Bluetooth BLE”. Monitor rotula “Leituras SIMULADAS”, “(simulado)” e “Calibração simulada” | `components/ModeBanner.tsx`, `app/(tabs)/*.tsx` | **Web**: faixa presente nas quatro abas; com a simulação ativa, nenhum “Desconectado” no texto visível (regressão E5) | Leitura da faixa pelo TalkBack; fontes ampliadas |
| **Conexão automática da simulação** | Com a simulação ativa, o dispositivo simulado conecta ao abrir o app e ao ativar o modo; ainda é possível desconectar e reconectar | `context/BluetoothContext.tsx` | **Web**: logo após o login, o Monitor mostra “Leituras SIMULADAS” sem passar por Conexão (regressão I3) | — |
| **Coerência dos dados — ausência** | A telemetria passou a ter campos opcionais, e o que falta aparece como “Sem leitura”, nunca como 0. Estados: “Não conectado”, “Preparando simulação…”/“Aguardando dados” e “Dados desatualizados” (> 5 s sem leitura) | `services/telemetry.ts`, `app/(tabs)/monitor.tsx` | **Web**: Monitor sem conexão mostra “Não conectado”; antes da 1ª leitura, “Preparando simulação…”; após Desconectar, nenhuma leitura antiga | BLE conectado sem telemetria; perda de conexão real (**Código**) |
| **Coerência dos dados — fogo** | Cenários da simulação (sem fogo, detecção, referência, elevada) presos à faixa escolhida; `FIRE_STOP` persiste até nova ação. Rótulos de faixa em unidade relativa (“Acima da intensidade de perigo”…), no lugar de “Muito Perto/Combatendo” | `services/simulator.ts`, `services/fireLevels.ts`, `app/(tabs)/monitor.tsx`, `app/(tabs)/settings.tsx` | **Lógica**: 200–300 ciclos por cenário, sempre na faixa; cancelamento persiste. **Web**: “Elevada” 407, 412, 399, 423; após cancelar, 11, 14, 12, 11, 10 com “Nenhum fogo detectado” | — |
| **Parâmetros aplicados** | Limiar, referência e perigo ficam em campos próprios (não sobrescrevem os sensores), e o Monitor classifica com os valores aplicados. “Distância Ideal” virou “Intensidade de Referência”, sem mudar o comando `SET_FIRE_IDEAL` | `services/simulator.ts`, `components/ParamField.tsx`, `app/(tabs)/monitor.tsx` | **Lógica**: base dos sensores intacta após `SET_FIRE_*`. **Web**: limiar 100 aplicado → Monitor “detecção ≥ 100”, intensidade 161 “Acima do limiar” | Confirmar no firmware o significado e a escala de `SET_FIRE_*` |
| **Validação** | Aceita só texto inteiro com dígitos (rejeita `20abc`, `50.5`, `1e2`, sinais). Mensagem por tipo de erro, `onBlur` em todos os campos, regra limiar < referência < perigo explicada na tela. “Aplicar” com valor inválido mantém o foco no campo e não envia comando | `utils/validation.ts`, `components/ParamField.tsx` | **Lógica**: 4 testes. **Web**: `""` → “Digite um valor.”; `20abc`/`1e2` → “Use apenas dígitos…”; `50.5` → “sem casas decimais”; `19` → “entre 20 e 200”; `200` → “Deve ser menor que a intensidade de referência em vigor (200).”; apagar tudo e redigitar continua possível (E2) | Teclado numérico Android e colagem de texto |
| **Resultado dos comandos** | `sendCommand` passou a retornar `applied-sim`, `sent` ou `failed`, sem `Alert` interno. As telas distinguem “aplicado na simulação”, “enviado, aguardando confirmação”, “confirmado pelo dispositivo”, “enviado, sem confirmação” e “falhou” | `context/BluetoothContext.tsx`, `hooks/useCommandFeedback.ts`, `components/FeedbackLine.tsx` | **Web** (falha injetada em todos os comandos): limiar 120 → “falhou”, valor em vigor inalterado; modo → “falhou”, segue Manual; bomba → “falhou”, segue Desligada | Falha real de escrita BLE (**Código**) |
| **Emergência — acesso** | Botão “PARADA DE EMERGÊNCIA” fixo no rodapé de Controle e Monitor, fora da rolagem, sem confirmação prévia; distinto do “PARAR” (apenas movimento) | `components/EmergencyStopBar.tsx`, `app/(tabs)/control.tsx`, `app/(tabs)/monitor.tsx` | **Web**: visível nas duas abas sem rolar, na viewport 390×844 | Área segura e barra do sistema; fontes ampliadas |
| **Emergência — comportamento** | Ação centralizada: `STOP`, `PUMP_OFF` e `MODE_MANUAL`, cada um tentado mesmo se o anterior falhar. Resultado por comando; a detecção de fogo não é alterada | `context/BluetoothContext.tsx`, `components/EmergencyStopBar.tsx` | **Lógica** e **Web**: em AUTO com fogo elevado e bomba ligada → movimento parado, bomba desligada, modo Manual 2 s depois, fogo mantido (392). Com falha injetada na bomba → “Parada com falha parcial”, bomba segue “Ligada” | Efeito físico; saída do AUTO pelo firmware |
| **Bomba — representação** | Simulação usa PWM coerente (ligada = PWM máximo). Tela: “Ligada · PWM 255 de 255 (100%)” | `services/simulator.ts`, `app/(tabs)/control.tsx`, `app/(tabs)/monitor.tsx` | **Lógica** e **Web**: sem “LIGADA” com “0%” | Formato de `pump` na telemetria real |
| **Bomba — água baixa** | Bloqueio só para ligar (água ≤ 10% ou modo AUTO), com motivo visível; desligar nunca é bloqueado | `app/(tabs)/control.tsx` | **Lógica** e **Web**: água 8% com bomba ligada → “Desligar” funcionou; “Ligar” desabilitado com “Reabasteça para ligar a bomba” | — |
| **Movimento simulado** | Estado de movimento para os direcionais e `STOP` | `services/simulator.ts`, `app/(tabs)/control.tsx` | **Web**: segurando “frente” → “Para frente”; ao soltar → “Parado” | Pressionar/soltar em tela de toque real |
| **Sliders e PWM** | A telemetria não sobrescreve o slider durante o arraste. PWM mín ≤ máx pelos limites dependentes. Botões − / + de 48 dp; em falha, o slider volta ao último valor | `components/SliderSetting.tsx`, `app/(tabs)/settings.tsx` | **Lógica**: `SET_PWM_MIN:210` com máx 200 recusado. Sem arraste e reversão: **Código** | Arraste no aparelho com telemetria chegando |
| **Isolamento entre modos** | Geração de sessão: trocar de modo, desconectar ou perder a conexão encerra busca, temporizadores, assinatura e conexão física; callbacks antigos são descartados | `context/BluetoothContext.tsx` (`invalidateSession` l. 206, `teardown` l. 227, `toggleMockMode` l. 610, descarte na conexão l. 565) | **Web** (temporizadores da simulação): 1 ativo após conectar, 0 após desconectar, máximo 1 em 5 ciclos. Troca BLE ↔ simulação: **Código** (na web não há BLE) | Alternar BLE ↔ simulação com o robô conectado |
| **Calibração** | “Calibrar Sensores” virou “Configurar sensores”, abrindo Configurações (sem calibração física) | `app/(tabs)/control.tsx` | **Web**: o toque leva a `/settings` (regressão I1) | — |
| **Ajuda e mensagens** | Ajuda reescrita conforme o comportamento implementado (simulação × robô, sem prometer parada garantida). Avisos de conexão e reinício passaram para o `AppModal` claro; feedback de comando fica inline, sem modal a cada leitura | `app/(tabs)/settings.tsx`, `components/NoticeHost.tsx`, `components/AppModal.tsx`, `app/(tabs)/_layout.tsx` | **Web**: Ajuda e Sobre abrem; modal com fundo `rgb(255,255,255)` (regressão I6); mensagem longa rolável | Diálogos de permissão nativos |
| **Acessibilidade — rótulos e papéis** | Nomes acessíveis (mover para frente/trás/esquerda/direita, parar movimento, parada de emergência, aplicar…), papéis (`button`, `switch`, `radio`, `progressbar`, `header`), estados e valores dos sliders; erros associados ao campo | Telas e componentes | **Web**: árvore de acessibilidade expôs, entre outros, botão “Mover para frente”, “Aplicar Limiar de Detecção” e switch “Modo de Simulação” desabilitado | **TalkBack** |
| **Acessibilidade — pressionar/soltar** | Com TalkBack ativo, toque duplo na seta inicia o movimento e “Parar movimento” encerra; o modo é detectado por `AccessibilityInfo` (na web sempre desativado) | `app/(tabs)/control.tsx`, `hooks/useScreenReader.ts` | **Código** | **TalkBack** |
| **Acessibilidade — foco e anúncios** | Ao abrir um modal, o foco vai para o título (`accessibilityViewIsModal`). Anúncios só em mudança de conexão, modo, fogo, água baixa e emergência, não a cada leitura | `components/AppModal.tsx`, `context/BluetoothContext.tsx` | Foco de abertura e anúncios: **Código** (na web os anúncios são inoperantes). Retorno do foco ao fechar: **Web**, em 4 modais (ver §0) | **TalkBack** (foco ao abrir e ao fechar, anúncios) |
| **Áreas de toque** | Mínimo de 48 dp em botões de modal, aplicar, bomba, modo, chips, −/+, fechar e links de login | Vários | **Código** | Medir no aparelho |
| **Contraste** | Novas cores de texto; amarelo, laranja e verde claros só em barras e ícones, sempre com texto | Telas, `services/fireLevels.ts` | **Cálculo WCAG** (script): abas inativas 4,83:1; erros 6,47:1; calibrado 5,21:1; sem fogo 5,48:1; referência 6,64:1; detecção 6,44:1; branco no botão Desligar 6,70:1; banner de simulação 8,15:1 (tabela em `docs/IHC-V3-ajustes.md`) | Conferência visual no aparelho |
| **Barra de abas** | Altura e padding com `insets.bottom` (correção E3 mantida); `lineHeight` e `flexShrink: 0` no rótulo para não cortar “ç/g” | `app/(tabs)/_layout.tsx` | **Web**: rótulos com 16 px de altura, sem corte, dentro da viewport | Navegação por gestos e por 3 botões |
| **Tema** | `userInterfaceStyle: "light"`, porque as telas usam paleta clara fixa | `app.json` | **Código** | Tema escuro do sistema ativado |

---

## 2. Regressão dos 11 problemas anteriores

A equipe informou que os 11 problemas foram corrigidos antes das alterações atuais. A tabela confere se as correções continuam válidas. A verificação é técnica (roteiro web automatizado), **não** é um novo teste com participantes.

| ID | Problema anterior | Situação na versão atual | Verificação | Resultado observado |
| --- | --- | --- | --- | --- |
| I1 | “Calibrar Sensores” sem ação | Renomeado para “Configurar sensores”, navega para Configurações | Web | `/settings`, com a seção “Sensores de Fogo (Avançado)” visível |
| I2 | “Sobre o HydroBot” não respondia | Abre o `AppModal` | Web | Modal com “Versão 1.0.0 — HydroBot Controller…” |
| I3 | Simulação ativa, Monitor “Não Conectado” | **Regressão encontrada e corrigida nesta etapa.** No commit `2c41ee4`, a simulação exigia conexão manual, e o Monitor voltava a mostrar “Não conectado”. No `0880d3d`, o dispositivo simulado conecta automaticamente | Web | Logo após o login, Monitor com “Leituras SIMULADAS”, sem passar por Conexão. Se o usuário desconectar de propósito, o Monitor mostra “Não conectado” com orientação |
| I4 | Texto de Conexão cortado | Texto com quebra de linha | Web | `scrollHeight` 38 = `clientHeight` 38 (sem corte). Fontes ampliadas: pendente (Android) |
| I5 | Acesso sem autenticação | `Stack.Protected` inalterado | Web | `/control` sem login exibe a tela de login. Cadastro e login com dados fictícios funcionaram |
| I6 | Modais escuros | `AppModal` claro; reinício e avisos passaram para ele; emergência e parâmetros sem modal (feedback inline) | Web | Fundo do modal `rgb(255, 255, 255)` |
| E1 | “Simular Fogo/Parar” não funcionavam | Substituídos por cenários (Sem fogo, Detecção, Referência, Elevada) | Web + Lógica | Ativou “FOGO SIMULADO DETECTADO”; ao cancelar, “Nenhum fogo detectado” persistiu |
| E2 | Não era possível apagar o valor | Edição livre; erro só ao sair do campo ou ao aplicar | Web | Campo vazio aceito e valor redigitado |
| E3 | Abas sobre a barra do sistema | `height`/`paddingBottom` continuam somando `insets.bottom` | Código + Web | Na web os insets são 0, e os rótulos ficam na viewport. **Android pendente** |
| E4 | Emojis em Configurações | Nenhum emoji na interface | Código + Web | Texto visível das 4 abas sem emojis. Só restam em `console.log` e em `components/hello-wave.tsx` (template, não usado) |
| E5 | “Desconectado” com simulação ativa | `ModeBanner` mostra o estado da simulação | Web | “MODO DE SIMULAÇÃO · Conectado ao dispositivo simulado”; nenhum “Desconectado” |

Retorno de foco (novo nesta revisão, **Web**):

| ID | Checagem | Resultado observado |
| --- | --- | --- |
| M1 | Erro de login → OK | Foco saiu de “Entrar” durante o modal e voltou a “Entrar” |
| M2 | Sobre o HydroBot → OK | Voltou a “Sobre o HydroBot, versão 1.0.0” |
| M3 | Ajuda → OK | Voltou a “Ajuda” |
| M4 | Reiniciar → Cancelar | Voltou a “Reiniciar aplicativo” |

Log: `docs/evidencias/regressao/regressao-web.log.json`. Capturas: `docs/evidencias/regressao/`.

---

## 3. Verificações antes do build

### Comandos executados

| Comando | Resultado | Erros ou avisos remanescentes |
| --- | --- | --- |
| `npx expo install --fix` | 13 pacotes atualizados no SDK 54; plugins `expo-font` e `expo-web-browser` adicionados ao `app.json` | O npm informou 59 vulnerabilidades (antes, 64) |
| `npx expo install --check` | Saída 0, “Dependencies are up to date” | Nenhum |
| `npx expo-doctor` | Saída 0, 18/18 checagens aprovadas | Nenhum |
| `npx tsc --noEmit` | Saída 0 | Nenhum |
| `npm run lint` (`expo lint`) | Saída 0, sem mensagens | Nenhum |
| `npm test` | 15 testes, 15 aprovados | Nenhum |
| `npm run build:web` | Saída 0; `dist/` com bundle de 1,64 MB; nenhum arquivo contém `react-native-ble-plx` | Nenhum |
| `node scripts/verificacao-web/flow.mjs docs/evidencias/web http://localhost:8090` (roteiro principal) | Todas as etapas concluídas; 23 capturas | Console sem erros nem avisos |
| `node scripts/verificacao-web/regress.mjs docs/evidencias/regressao http://localhost:8090` (regressão, falhas, temporizadores e foco) | 22 checagens concluídas | Console sem erros nem avisos |
| Build Android | **Não executado** (comando preparado em §4) | — |

Nenhuma falha apareceu nesta rodada. Na revisão do teste de foco, verifiquei também que ele não passaria por acaso: medi o foco com o modal aberto para confirmar que ele realmente sai do controle antes de voltar.

O dev server também foi usado na web durante o desenvolvimento (em desenvolvimento, o Metro mostra avisos do react-native-web sobre `shadow*` e `pointerEvents`; o build de produção não registrou nenhum).

### Checagens específicas

| Checagem | Teste executado | Análise de código |
| --- | --- | --- |
| Persistência do cancelamento do fogo simulado | **Lógica**: 300 ciclos após `FIRE_STOP` sem fogo. **Web**: 5 leituras seguidas entre 10 e 14, “Nenhum fogo detectado” | A atualização periódica (`simTick`) altera só o ruído, nunca o cenário |
| Emergência interrompe movimento e bomba sem retomada automática | **Lógica**: STOP/PUMP_OFF/MODE_MANUAL seguidos de 50 ciclos → parado, bomba 0, Manual, fogo mantido. **Web**: nas duas abas, Manual e bomba desligada 2 s depois, fogo 392 mantido | No BLE, depende do firmware (§5) |
| Desligar a bomba com água baixa | **Lógica** e **Web**: água 8% com bomba ligada → desligou; ligar ficou bloqueado com motivo | — |
| Simulação usa os parâmetros aplicados | **Lógica**: limiar/referência/perigo 100/300/500 → intensidade em [100, 300) classificada “detecção”. **Web**: Monitor exibiu “detecção ≥ 100” após aplicar 100 | — |
| Entradas inválidas rejeitadas | **Lógica**: `""`, `"   "`, `20abc`, `50.5`, `50,5`, `1e2`, `-5`, `0x10`, `+20` e `2 0` rejeitados, além de limites e ordem. **Web**: `""`, `20abc`, `50.5`, `1e2`, `19` e `200` com mensagem específica; “Aplicar” com valor inválido não mostrou sucesso e manteve o foco no campo | — |
| Sem sucesso falso quando o envio falha | **Web** com falha injetada: limiar, modo e bomba mostram “falhou” e mantêm o estado anterior; emergência mostra falha parcial | BLE: em exceção de escrita, `sendCommand` retorna `failed` e trata perda de conexão (l. 361–405). Slider volta ao último valor em falha (`SliderSetting.tsx` l. 80) |
| Encerramento de conexões e temporizadores ao alternar os modos | **Web** (só simulação): intervalos de 600 ms ativos 1 → 0 ao desconectar; máximo 1 em 5 ciclos de conectar/desconectar; Monitor sem dados antigos | Troca BLE ↔ simulação: `toggleMockMode` chama `teardown` (para a busca, limpa temporizadores, fecha a conexão BLE e incrementa a geração); conexão BLE que termina depois da troca é fechada (l. 565). **Não executado: exige Android com BLE** |

### O que não pôde ser executado e por quê

- **BLE real, permissões e troca BLE ↔ simulação**: na web, o transporte BLE é intencionalmente indisponível, e não houve aparelho Android com o robô nesta etapa.
- **TalkBack, anúncios e foco do leitor de tela**: o react-native-web não implementa `announceForAccessibility` nem detecta leitor de tela. O retorno de foco foi verificado só para o foco de teclado na web; o caminho Android (`setAccessibilityFocus`) não foi executado.
- **Fontes ampliadas, teclado e barras do sistema**: dependem do Android.
- **Arraste do slider com telemetria chegando**: não foi possível simular o gesto de forma confiável no Chrome headless.

---

## 4. Preparação para o build Android

### Configuração conferida

- `app.json`: `android.package` `com.hydrobot.bluetooth`, `newArchEnabled: true`, plugin `react-native-ble-plx` e permissões BLE/localização. `extra.eas.projectId` definido.
- `eas.json`: perfis `development` (dev client, distribuição interna), `preview` (distribuição interna, **APK**) e `production` (`autoIncrement`, AAB padrão); `appVersionSource: "remote"`.
- `eas-cli` instalado: 23.0.0 (o `eas.json` exige ≥ 16.26.0).
- `react-native-ble-plx` 3.5.0 é módulo nativo: **o Expo Go comum não basta**.

### Perfil e comando recomendados

Comando preparado para a versão instalável de teste (APK), a partir de `ihc-v3-ajustes` atualizada e com sessão no EAS (`eas login`):

```bash
eas build --platform android --profile preview
```

Para depurar no aparelho com o Metro, use um development build:

```bash
eas build --platform android --profile development
```

O perfil `production` gera AAB, voltado à loja, e não é necessário para esta revisão. Uma alternativa local é `npx expo prebuild --clean` seguido de `npx expo run:android --variant release` (não executado). **Correção:** versões anteriores deste relatório diziam que o Android SDK estava presente em `D:\dev\android-sdk`. A variável `ANDROID_HOME` aponta para esse caminho, mas a pasta não existe nesta máquina.

### Possíveis impedimentos

1. ~~Versões de patch desalinhadas~~: **resolvido** em `f103d1a` (`expo-doctor` 18/18). Os pacotes nativos atualizados (`expo-dev-client`, `expo-modules-core`, `expo-image`…) só serão compilados no próximo build Android.
2. **Pasta `android/` local desatualizada**: é anterior às mudanças de `app.json` (ainda usa tema `DayNight`). Ela está no `.gitignore`, então o EAS gera os arquivos nativos a partir do `app.json`. Para build local, use `npx expo prebuild --clean`.
3. **Árvore local**: o EAS empacota a cópia local. Rode o build com a branch `ihc-v3-ajustes` em dia (`git pull`) e a árvore limpa (`git status`).
4. **Login no EAS**: `eas build` exige conta com acesso ao `projectId` configurado.
5. **`expo-updates` sem URL/canal configurado**: não verifiquei o efeito no build. O botão Reiniciar usa `Updates.reloadAsync()` e, se falhar, apenas reinicia a sessão do app.
6. **Nova arquitetura**: o `react-native-ble-plx` 3.5.0 não declara `codegenConfig` e roda pela camada de compatibilidade. Isso não foi verificado nesta etapa.

### Testes pendentes no Android

| Área | O que testar |
| --- | --- |
| BLE | Permissões (Android 12+ e anteriores), Bluetooth desligado, busca, conexão, telemetria, escrita de comandos, perda de conexão (aviso e dados descartados), “Dados desatualizados” |
| Troca de modo | BLE conectado → simulação → BLE, repetidas vezes: a conexão física deve cair, sem dados de um modo no outro |
| Confirmações | Se o firmware envia `*_SET:` ou campos `fire_*`/`mode`/`pump`: a tela deve alternar entre “confirmado” e “enviado, sem confirmação” |
| Emergência | Botão acessível em Controle e Monitor com e sem teclado aberto; efeito físico; saída do AUTO |
| **TalkBack** | Leitura da faixa de modo, rótulos dos direcionais, toque duplo para mover e “Parar movimento”, switches e chips com estado, sliders (valor e −/+), erros dos campos, foco no título ao abrir um modal e **retorno do foco ao controle de origem ao fechar** (Sobre, Ajuda, switch de simulação, Reiniciar, erros de Login e Cadastro), anúncios de conexão/modo/fogo/água sem narrar cada leitura |
| **Fontes ampliadas** | Escala máxima do sistema: faixa de modo, rótulos das abas, cards do Monitor (sensores lado a lado), botão de emergência e painel de resultado, modais |
| **Teclado** | Campos de parâmetro com o teclado aberto: campo e mensagem de erro visíveis; barra de emergência sem cobrir o campo |
| **Navegação inferior** | Navegação por gestos e por 3 botões: abas e barra de emergência sem sobreposição (E3) |
| **Pressionar/soltar** | Segurar e soltar cada direcional; arrastar o dedo para fora antes de soltar (deve enviar Parar); toques rápidos repetidos |
| Áreas de toque e contraste | Medir os alvos de 48 dp; conferir as cores no aparelho, sob luz forte |
| Tema escuro | Com o tema escuro do sistema ativado, a interface deve permanecer clara e legível |
| Regressão | Repetir I1–I6 e E1–E5 no aparelho |

---

## 5. Limitações dependentes de firmware ou hardware

- O app só mostra “confirmado” quando a telemetria traz o novo valor ou quando chega a resposta `*_SET:valor` prevista em `services/hydroBotProtocol.ts`. Não foi confirmado se o firmware atual envia essas respostas.
- O protocolo registrava padrões de fogo 200/1400/800, fora das faixas da tela (20–200, 200–600, 100–400). As faixas da tela foram mantidas; a escala deve ser confirmada no firmware.
- Movimento não tem confirmação no protocolo: no BLE, a tela mostra apenas o último comando enviado.
- A saída do modo AUTO na emergência (`MODE_MANUAL`) depende do firmware.

---

## 6. Evidências e reprodução

- Roteiro principal: `docs/evidencias/web/01–23-*.png` e `roteiro-web.log.json`.
- Regressão, falhas e temporizadores: `docs/evidencias/regressao/` (`regressao-web.log.json` e capturas).
- Sequência de capturas: `docs/evidencias/roteiro-simulacao-web.gif` (não é gravação de vídeo).
- Versão inicial na web: `docs/evidencias/web-versao-inicial-a806ef9.png`.
- Detalhamento por arquivo e tabela de contraste: `docs/IHC-V3-ajustes.md`.

Para reproduzir, gere o build web:

```bash
npm run build:web
```

Sirva o `dist/` com fallback de SPA, usando o servidor incluído nos scripts:

```bash
node scripts/verificacao-web/serve.mjs dist 8090
```

Com o servidor rodando, em outro terminal, execute a verificação com asserções. Ela usa o Chrome; outro caminho pode ser informado em `CHROME_PATH`:

```bash
node scripts/verificacao-web/verify.mjs saida-verificacao http://localhost:8090
```
