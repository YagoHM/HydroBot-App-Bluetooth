# Relatório técnico — estado atual do aplicativo HydroBot

Documento de referência para atualizar o Projeto Integrador I (FATEC Bauru). Descreve **somente** o que existe no código da versão analisada e o que foi efetivamente executado nesta análise. Afirmações de relatórios anteriores só foram mantidas quando confirmadas no código atual; divergências estão na seção 13.

### Convenções de evidência

| Rótulo | Significado |
| --- | --- |
| **[Código]** | Comportamento confirmado por leitura do código-fonte, sem execução. |
| **[Teste automatizado]** | Teste unitário executado com `npm test` (Node, sem React Native). Valida regras de lógica pura. |
| **[Teste web]** | Roteiro automatizado com asserções, executado no build web de produção em Chrome headless (viewport 390×844), sempre em Modo de Simulação. |
| **[Teste Android]** | Execução no aplicativo Android. **Nenhum teste Android foi executado nesta análise.** |
| **[Hardware]** | Depende do robô físico e de Bluetooth real. **Nenhum teste com hardware foi executado nesta análise.** |

---

## 1. Identificação da versão analisada

| Item | Valor |
| --- | --- |
| Repositório | Cópia local `HydroBotBluetooth`. Remoto `origin`: `https://github.com/YagoHM/HydroBotBluetooth.git`, que o GitHub redireciona para `https://github.com/YagoHM/HydroBot-App-Bluetooth` |
| Branch | `ihc-v3-ajustes` |
| Commit analisado | `eec281ba3ddd55c43c37a27223d77fd02eb9353e` (`eec281b`), de 2026-10-06 09:37 (-03:00). O código do app é o de `51ac9a6`; `eec281b` só altera o relatório de IHC |
| Situação no GitHub | `eec281b` e `51ac9a6` **ainda não foram enviados** (a branch local está 2 commits à frente de `origin/ihc-v3-ajustes`, cujo último commit é `3662cce`). A branch `master` do GitHub está em `a806ef9` |
| Data da análise | 2026-10-07 |
| Árvore de trabalho | Limpa (só a pasta local `.claude/`, não versionada) |
| Nome e versão do app | `HydroBotBluetooth`, versão 1.0.0 (`app.json`), pacote Android `com.hydrobot.bluetooth` |

### Versões principais (instaladas em `node_modules`)

| Componente | Versão |
| --- | --- |
| Expo SDK | 54 (`expo` 54.0.37) |
| React Native | 0.81.5 (nova arquitetura ligada: `newArchEnabled: true`) |
| React / React DOM | 19.1.0 |
| TypeScript | 5.9.3 (`strict: true` no `tsconfig.json`) |
| Expo Router | 6.0.24 (rotas tipadas: `experiments.typedRoutes: true`) |
| React Navigation | native 7.1.19, bottom-tabs 7.7.2 |
| react-native-ble-plx | 3.5.0 |
| react-native-web | 0.21.2 |
| AsyncStorage | 2.2.0 |
| ESLint | 9.38.0 (`eslint-config-expo` 10) |

---

## 2. Stack tecnológica realmente utilizada

**Linguagem e framework:** TypeScript + React Native com Expo (fluxo gerenciado, com prebuild para gerar o Android). **O aplicativo não usa Flutter nem Dart:** não existe nenhum arquivo `.dart` ou `pubspec.yaml` no projeto [Código].

### Bibliotecas usadas diretamente pelo código do app

| Biblioteca | Uso no código | Onde |
| --- | --- | --- |
| `expo-router` | Rotas por arquivos, `Stack` com `Stack.Protected`, `Tabs`, navegação (`router.navigate/replace`) | `app/**`, `components/NotConnectedCard.tsx` |
| `@react-navigation/bottom-tabs` | `useBottomTabBarHeight` (cálculo da área coberta pelo teclado) | `app/(tabs)/settings.tsx` |
| **`react-native-ble-plx`** | **Bluetooth Low Energy (BLE)**: busca, conexão, notificações e escrita | `services/bleTransport.ts` (somente) |
| `buffer` | Conversão base64 ↔ texto das mensagens BLE | `services/bleTransport.ts` |
| `@react-native-async-storage/async-storage` | Persistência local (usuários cadastrados e preferência do Modo de Simulação) | `context/AuthContext.tsx`, `context/BluetoothContext.tsx` |
| `@react-native-community/slider` | Sliders de velocidade e PWM | `components/SliderSetting.tsx` |
| `@expo/vector-icons` (Ionicons) | Ícones, por meio de um componente decorativo próprio | `components/Icon.tsx` |
| `react-native-safe-area-context` | Insets da barra do sistema na barra de abas | `app/(tabs)/_layout.tsx` |
| `expo-updates` | `Updates.reloadAsync()` no botão “Reiniciar” | `context/BluetoothContext.tsx` |
| `expo-status-bar` | Barra de status clara | `app/_layout.tsx` |

**Usadas indiretamente ou só na configuração:** `react-native-screens`, `@react-navigation/native` e `@react-navigation/elements` (por meio do Expo Router), `react-native-web` (versão web), `expo-dev-client` (build de desenvolvimento), `expo-splash-screen`, `expo-font` e `expo-web-browser` (plugins no `app.json`).

**Instaladas, mas usadas apenas por arquivos de template do Expo que nenhuma tela importa:** `expo-haptics`, `expo-symbols`, `react-native-reanimated` (em `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `ui/*`, `haptic-tab.tsx`, `external-link.tsx`, `themed-*`). `expo-image`, `expo-linking`, `expo-constants`, `expo-system-ui`, `react-native-gesture-handler` e `react-native-worklets` não são importadas diretamente pelo código do app.

**Bluetooth:** a biblioteca é a `react-native-ble-plx`, voltada a **Bluetooth Low Energy**, com o serviço UART padrão da Nordic (UUIDs na seção 6). Não há código para Bluetooth Clássico (HC-05/HC-06) [Código].

**Testes e verificação:** test runner nativo do Node (`node:test`, com `--experimental-strip-types`) e scripts próprios de verificação web via Chrome DevTools Protocol (`scripts/verificacao-web/`), sem dependências adicionais.

---

## 3. Arquitetura atual do aplicativo

### 3.1 Estrutura de rotas (Expo Router)

```
app/
├── _layout.tsx          Raiz: ErrorBoundary → AuthProvider → BluetoothProvider → Stack
├── login.tsx            /login      (visível só sem autenticação)
├── register.tsx         /register   (visível só sem autenticação)
└── (tabs)/
    ├── _layout.tsx      Tabs + cabeçalho com indicador + EmergencyModal + NoticeHost
    ├── index.tsx        /           aba "Conexão"
    ├── control.tsx      /control    aba "Controle"
    ├── monitor.tsx      /monitor    aba "Monitor"
    └── settings.tsx     /settings   aba "Ajustes" (título da tela: "Configurações")
```

- O `Stack` raiz usa `Stack.Protected`: o grupo `(tabs)` só existe com `isAuthenticated = true`; `login` e `register` só existem com `isAuthenticated = false` [Código; Teste web I5: abrir `/control` sem login mostra a tela de login].
- O cabeçalho das abas (fundo `#DC2626`) mostra o título da tela, o **indicador compacto de modo/conexão** (`components/HeaderTitle.tsx`) e o botão **Reiniciar** [Código; Teste web P-*].

### 3.2 Providers / contexts

| Provider | Arquivo | Responsabilidade |
| --- | --- | --- |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | Captura erros de renderização e mostra mensagem e pilha |
| `AuthProvider` | `context/AuthContext.tsx` | Estado `isAuthenticated`, cadastro e consulta de usuários locais |
| `BluetoothProvider` | `context/BluetoothContext.tsx` | Modo (simulação/BLE), sessão de conexão, busca, telemetria, comandos, confirmação, parada de emergência, avisos e falha simulada |

### 3.3 Camadas de serviço (lógica sem React)

| Arquivo | Conteúdo |
| --- | --- |
| `services/hydroBotProtocol.ts` | UUIDs BLE, tipos de comandos e telemetria, codificação (`comando + "\n"`), interpretação das linhas recebidas (JSON de telemetria e eventos), prefixos de confirmação `*_SET:` e classificação de compatibilidade na busca |
| `services/bleTransport.ts` / `bleTransport.web.ts` | Transporte BLE nativo; a versão web não importa o módulo nativo e informa indisponibilidade |
| `services/simulator.ts` | Dispositivo simulado determinístico (seção 5) |
| `services/telemetry.ts` | Tipo `Telemetry` (campos opcionais: ausente = “sem leitura”), limiar de água baixa (10%), PWM máximo (255) |
| `services/fireLevels.ts` | Faixas de intensidade de fogo, rótulos, cores e ícones |
| `services/emergency.ts` | Comandos da parada de emergência e texto do resultado |
| `utils/validation.ts` | Regex de e-mail, validação de inteiros e dos parâmetros de fogo |
| `utils/layoutMetrics.ts` | Cálculos de teclado, rolagem e altura da barra de abas |

### 3.4 Autenticação
Resumo (detalhes na seção 7): estado em memória, usuários salvos localmente, sem servidor.

### 3.5 Comunicação Bluetooth
Toda a comunicação passa pelo `BluetoothContext`, que escolhe entre o simulador (`services/simulator.ts`) e o transporte BLE (`services/bleTransport.ts`). As telas não acessam o BLE diretamente (seção 6).

### 3.6 Gerenciamento de estado
- **Context API + hooks** (`useState`, `useRef`, `useCallback`); não há Redux, Zustand ou similar [Código].
- **Sessão de conexão com geração:** cada troca de modo, desconexão ou perda de conexão incrementa uma geração (`sessionId`). Temporizadores, notificações BLE e respostas antigas são descartados, e os feedbacks de comando das telas são limpos [Código; Teste web SS1/SS2, T1/T2/T4].
- **Hooks próprios:** `useCommandFeedback` (envia comando e descreve o resultado), `useScreenReader` (detecta TalkBack; na web sempre falso), `useKeyboardHeight` (altura do teclado).

### 3.7 Componentes compartilhados (próprios do app)

| Componente | Função |
| --- | --- |
| `AppModal` | Modal claro padronizado: foco no título ao abrir, retorno do foco ao controle de origem ao fechar, conteúdo rolável, botões de 48 dp |
| `EmergencyModal` | Modal único da parada de emergência (executando → resultado) |
| `EmergencyStopBar` | Botão fixo “PARADA DE EMERGÊNCIA” em Controle e Monitor |
| `HeaderTitle` | Título + indicador compacto (“Simulação · conectado”, “BLE · desconectado”…) |
| `FeedbackLine` | Linha de estado de comando (pendente, sucesso, informação, erro), com ícone e texto |
| `ParamField` | Campo validado de parâmetro de fogo com botão Aplicar |
| `SliderSetting` | Slider com botões − e + |
| `NotConnectedCard` | Orientação “Não conectado” com botão “Ir para Conexão” |
| `NoticeHost` | Exibe os avisos de conexão do contexto no `AppModal` |
| `Icon` | `Ionicons` decorativo, fora da árvore de acessibilidade |
| `ErrorBoundary` | Tela de erro |

### 3.8 Persistência local

| Chave (AsyncStorage) | Conteúdo |
| --- | --- |
| `@hydrobot/registered_users` | Lista de usuários cadastrados: nome, e-mail e **senha em texto puro** |
| `@hydrobot_mock_mode` | Preferência do Modo de Simulação (`"true"`/`"false"`) |

Na web, o AsyncStorage usa o `localStorage` do navegador. Não há banco de dados nem servidor [Código].

### 3.9 Configuração nativa
- `app.json`: `orientation: portrait`, `userInterfaceStyle: light`, `edgeToEdgeEnabled: true`, permissões Android `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, saída web `single`.
- Plugins: `expo-router`, `expo-splash-screen`, `react-native-ble-plx`, `expo-font`, `expo-web-browser` e o plugin local **`./plugins/withFontScaleRelayout`**. Esse plugin altera o código Android gerado: liga a flag `enableFontScaleChangesUpdatingLayout` do RN, acrescenta `fontScale` a `configChanges` e força nova medição ao mudar a fonte [Código; ver seção 10].
- `eas.json`: perfis `development` (dev client), `preview` (APK interno) e `production` (`autoIncrement`).
- Existe configuração iOS (`bundleIdentifier`, textos de permissão), mas **nenhum build iOS foi feito**.

---

## 4. Telas e funcionalidades implementadas

### 4.1 Login (`app/login.tsx`)
- **Finalidade:** autenticar para acessar as abas.
- **Funcionalidades:** campos E-mail e Senha; “próximo” no teclado passa do e-mail à senha; Enter na senha envia; botão **Entrar**; link “Não possui conta? Cadastre-se”. Rolagem com `KeyboardAvoidingView` (`behavior="padding"`) para o teclado não encobrir o formulário.
- **Estados:** formulário; modal “Erro de Autenticação” com a mensagem; ao fechar, o foco volta ao botão Entrar.
- **Navegação:** sucesso → grupo `(tabs)` (aba Conexão); link → `/register`.
- **Evidência:** [Código]; [Teste web] I5, M1, K1 e K2 (formulário rola com altura reduzida; Enter envia o login).

### 4.2 Cadastro (`app/register.tsx`)
- **Funcionalidades:** Nome Completo, E-mail, Senha e Confirmar Senha, com “próximo” entre os campos; botão **Cadastrar**; link “Já possui conta? Faça Login”; mesma rolagem com teclado do Login.
- **Estados:** modal de erro (“Preencha todos os campos.”, “Formato de e-mail inválido.”, “As senhas não coincidem.”); modal de sucesso “Cadastro Realizado / Usuário criado com sucesso!”.
- **Navegação:** sucesso + OK → `/login`.
- **Evidência:** [Código]; [Teste web] K3 e cadastro executado no início de cada roteiro.

### 4.3 Conexão (aba “Conexão”, `app/(tabs)/index.tsx`)
- **Finalidade:** buscar e conectar ao dispositivo (simulado ou BLE).
- **Funcionalidades:** botão **Buscar Dispositivos** / **Parar busca**; lista de dispositivos (simulado: “HydroBot simulado — sem robô físico”; BLE: id e indício de compatibilidade); toque conecta; cartão de conectado com **Desconectar**. O cartão rola quando não cabe na tela.
- **Estados:** “Procurando dispositivos…”, “Conectando…”, “Nenhum dispositivo encontrado”, “Conectado ao dispositivo simulado” (com explicação de que nenhum robô físico é controlado) ou “Conectado via Bluetooth BLE”.
- **Evidência:** [Código]; [Teste web] I4, C2a e ciclos T4 (buscar, conectar, desconectar).

### 4.4 Controle (aba “Controle”, `app/(tabs)/control.tsx`)
- **Finalidade:** operar o robô.
- **Funcionalidades:**
  - **Modo** AUTO/MANUAL (botão com papel de switch). O feedback distingue “aplicado na simulação”, “enviado, aguardando confirmação”, “confirmado” e “falhou”.
  - **Controle de Movimento**, só no modo manual: setas frente, trás, esquerda e direita (pressionar move, soltar envia `STOP`; com TalkBack, toque duplo inicia e “Parar movimento” encerra) e botão central **PARAR**.
  - **Bomba de Água:** estado e PWM; **Ligar** bloqueado com água ≤ 10% ou em AUTO, com o motivo exibido; **Desligar** sempre disponível.
  - **Ações Rápidas:** “Configurar sensores” abre Configurações.
  - **Parada de emergência** fixa no rodapé.
- **Estados:** “Não conectado” (com botão Ir para Conexão), “Modo: aguardando dados”, “Movimento (simulação): Parado / Para frente / …”; no BLE, “Último comando de movimento enviado”.
- **Evidência:** [Código]; [Teste web] EM1–EM11, I1, F (falhas injetadas).

### 4.5 Monitor (aba “Monitor”, `app/(tabs)/monitor.tsx`)
- **Finalidade:** exibir a telemetria.
- **Cartões:**
  - **Nível de Água** (%, barra e classificação).
  - **Detecção de Fogo** (estado, intensidade em unidade relativa, faixa: abaixo do limiar, detecção, referência ou perigo; faixas e origem dos parâmetros).
  - **Sensores de Fogo** (esquerdo, centro e direito: leitura, Δ, nível; selo “Calibração simulada” ou “Calibrado (informado pelo dispositivo)”; valores base).
  - **Bomba de Água** (LIGADA/DESLIGADA e PWM).
  - **Status do Sistema** (Modo, Velocidade, PWM Mín, PWM Máx).
- **Estados:** “Não conectado”; “Preparando simulação…” / “Aguardando dados”; “Leituras SIMULADAS · geradas pelo app” ou “Leituras do HydroBot (BLE)”; “Dados desatualizados — última leitura há N s” (mais de 5 s sem telemetria); campo ausente aparece como **“Sem leitura”**, nunca como 0.
- **Navegação:** parada de emergência fixa; botão “Ir para Conexão” quando desconectado.
- **Evidência:** [Código]; [Teste web] I3, W2/W3, E1, S1/S2, M4, EM6.

### 4.6 Configurações (aba “Ajustes”, `app/(tabs)/settings.tsx`)
- **Seções:**
  - **Origem dos dados:** switch Modo de Simulação, desabilitado na web. Com a simulação ativa e conectada:
    - cenários de fogo: Sem fogo, Detecção, Referência, Elevada;
    - nível de água simulado: Água baixa (8%), Reabastecer (75%), com seleção destacada pela telemetria;
    - falha de envio simulada: Nenhuma, Comandos da bomba, Todos os comandos.
  - **Controle de Movimento:** Velocidade dos Motores, 30–100%, passo 5.
  - **Bomba de Água:** PWM Mínimo 150–255 e PWM Máximo 180–255, sempre com mínimo ≤ máximo.
  - **Sensores de Fogo (Avançado):** Limiar de Detecção 20–200, Intensidade de Referência 100–400 e Intensidade de Perigo 200–600, mantendo limiar < referência < perigo.
  - **Informações:** Sobre o HydroBot (versão 1.0.0) e Ajuda (texto explicativo).
- **Teclado:** com o teclado aberto, a tela reserva a área coberta e rola até o campo em edição (título, campo, Aplicar e mensagem).
- **Evidência:** [Código]; [Teste web] W0–W4, AP1–AP5, C1a–C1c, SS1/SS2, I2, I6, M2/M4 (foco).

---

## 5. Modo de Simulação

> **O Modo de Simulação serve para testar o software e a interface. Ele não valida o robô físico, a comunicação Bluetooth real, a movimentação, o combate a incêndio, a calibração dos sensores nem a segurança do HydroBot.**

### 5.1 Ativação
- Padrão: **ativo**. O app lê `@hydrobot_mock_mode` e só desativa a simulação se o valor salvo for `"false"`. Na web, a simulação é sempre usada (`bleAvailable = false`) [Código].
- Alternância: switch “Modo de Simulação” em Configurações, com modal de confirmação. A troca encerra busca, conexão, temporizadores e dados do modo anterior [Código].
- **Conexão automática:** com a simulação ativa, o “HydroBot simulado” conecta sozinho ao abrir o app e ao ativar o modo; o usuário pode desconectar e reconectar pela aba Conexão [Código; Teste web I3].

### 5.2 Dados simulados (`services/simulator.ts`)
- Atualização a cada **600 ms**, com gerador pseudoaleatório de semente fixa (reprodutível) [Código; Teste automatizado].
- **Estado inicial:** água 75%, bomba desligada, modo MANUAL, parado, velocidade 100%, PWM 180–255, sem fogo, parâmetros de fogo 50 / 200 / 350, base dos sensores 200, `calibrated: true`.
- **Fogo:** o cenário define uma faixa, e a intensidade varia só dentro dela:
  - sem fogo: abaixo do limiar;
  - detecção: entre o limiar e a referência;
  - referência: entre a referência e o perigo;
  - elevada: acima do perigo.

  `fire = intensidade ≥ limiar`. A intensidade é a maior variação (Δ) entre os sensores: centro = intensidade, esquerdo = 0,6×, direito = 0,45×. Os parâmetros aplicados reclassificam as faixas [Teste automatizado; Teste web E1, AP5].
- **Bomba:** ligada → telemetria `pump` = PWM máximo; desligada → 0. Não liga com água ≤ 10% [Teste automatizado].
- **Movimento:** `FWD`, `BACK`, `LEFT` e `RIGHT` mudam o estado de movimento, e `STOP` para. Em AUTO, os direcionais são recusados e não há deslocamento simulado [Teste automatizado; Teste web EM1/EM3].
- **Água:** muda só pelo comando `SIM_WATER` (botões 8% e 75%); não diminui com o uso da bomba.

### 5.3 Comandos aceitos pela simulação
`FWD`, `BACK`, `LEFT`, `RIGHT`, `STOP`, `PUMP_ON`, `PUMP_OFF`, `MODE_AUTO`/`AUTO`, `MODE_MANUAL`/`MANUAL`, `GET_STATUS`, `CALIBRATE`, `SET_SPEED:n`, `SET_PWM_MIN:n`, `SET_PWM_MAX:n`, `SET_FIRE_THRESH:n`, `SET_FIRE_IDEAL:n`, `SET_FIRE_DANGER:n`, além dos comandos exclusivos da simulação `FIRE_SIM[:DETECTED|REFERENCE|HIGH]`, `FIRE_STOP` e `SIM_WATER:n`. Valores fora da faixa ou fora de ordem e comandos desconhecidos são recusados com mensagem [Código; Teste automatizado]. `CALIBRATE` **não é acionado por nenhuma tela**.

**Falha de envio simulada:** “Comandos da bomba” faz `PUMP_*` falhar; “Todos os comandos” faz todos falharem. Serve para testar mensagens de erro e a emergência com falha [Teste web W4, F, EM9, EM12].

### 5.4 Representação na interface
Indicador “Simulação · conectado/conectando…/desconectado” no cabeçalho das quatro abas, com descrição acessível “Os dados são gerados pelo aplicativo, sem controlar um robô físico”. Também aparecem os textos “Leituras SIMULADAS”, “Nível de Água (simulado)”, “Sensores de Fogo (simulados)”, “Calibração simulada”, “Intensidade simulada — unidade relativa”, “Movimento (simulação)” e, nas ações, “aplicado na simulação” [Teste web P-*].

### 5.5 Limitações da simulação
Não há física nem trajetória; o modo AUTO não reproduz o comportamento do robô; o consumo de água não é simulado; a calibração é sempre “simulada”; os comandos são aplicados instantaneamente; nenhum resultado obtido em simulação comprova o funcionamento do firmware ou do hardware.

---

## 6. Bluetooth / BLE

### 6.1 Biblioteca e protocolo
- `react-native-ble-plx` 3.5.0, encapsulada em `services/bleTransport.ts`. O `BleManager` é criado só no primeiro uso real do BLE.
- UUIDs (`services/hydroBotProtocol.ts`), serviço UART padrão da Nordic:
  - serviço `6e400001-b5a3-f393-e0a9-e50e24dcca9e`;
  - RX (app → robô, escrita) `6e400002-…`;
  - TX (robô → app, notificação) `6e400003-…`.
- **Envio:** texto `COMANDO\n` em base64; tenta escrita sem resposta e, se falhar, escrita com resposta. Pede MTU 512.
- **Recebimento:** linhas de texto; JSON é interpretado como telemetria (campos de água, bomba, intensidade, modo, fogo, velocidade, PWM, parâmetros, sensores e calibração); outras linhas são eventos (ex.: `FIRE_THRESH_SET:valor`, `READY`, `ERR:`).

### 6.2 Fluxo de conexão (modo BLE) [Código]
1. **Busca:** pede permissões (Android 12+: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`; anteriores: localização) e verifica se o Bluetooth está ligado. Busca por 10 s e lista dispositivos com nome, com um indício:
   - “Anuncia o serviço de dados usado pelo HydroBot (compatibilidade confirmada só ao conectar)”;
   - “Nome indica HydroBot, mas o serviço de dados não foi anunciado”;
   - “Compatibilidade com o HydroBot não verificada”.
2. **Conexão:** conecta (timeout 10 s), descobre serviços e **encerra com erro se o serviço do HydroBot não existir**. Depois assina as notificações e monitora a desconexão; 1 s após conectar, envia `GET_STATUS`.
3. **Avisos** (modal): permissão negada, Bluetooth desligado, falha na busca, falha ao conectar, conexão perdida (os dados exibidos são descartados).
4. **Resultado dos comandos:** “enviado” (escrita concluída, sem confirmação) ou “falhou”. O app só mostra “confirmado pelo dispositivo” se, em até 3 s, chegar a resposta `*_SET:valor` ou uma telemetria com o novo valor.

### 6.3 Telas que usam o contexto
As quatro abas, o cabeçalho (`HeaderTitle`), `EmergencyStopBar`, `EmergencyModal`, `NoticeHost`, `ParamField`, `SliderSetting`, `NotConnectedCard` e o hook `useCommandFeedback`. Login e Cadastro não usam o contexto Bluetooth.

### 6.4 Comandos enviados pela interface
`FWD`, `BACK`, `LEFT`, `RIGHT`, `STOP`, `MODE_AUTO`, `MODE_MANUAL`, `PUMP_ON`, `PUMP_OFF`, `SET_SPEED:n`, `SET_PWM_MIN:n`, `SET_PWM_MAX:n`, `SET_FIRE_THRESH:n`, `SET_FIRE_IDEAL:n`, `SET_FIRE_DANGER:n`; `GET_STATUS` automático; emergência = `STOP` + `PUMP_OFF` + `MODE_MANUAL`. O protocolo declara outros comandos (`SET_SPEED_L/R`, `SET_TURN_SPEED`, `SET_MOTOR_PWM_MIN`, `SET_KICK_*`, `CALIBRATE`) que **nenhuma tela envia**.

### 6.5 Limitações conhecidas
- **Não foi confirmado** se o firmware atual envia as respostas `*_SET:` ou os campos `fire_thresh/fire_ideal/fire_danger`; sem eles, a tela mostra “enviado, sem confirmação”.
- O arquivo de protocolo registra como padrão do firmware os valores 200/1400/800, fora das faixas aceitas pela tela (20–200, 200–600, 100–400). A escala real não foi confirmada.
- Movimento não tem confirmação no protocolo; a saída do modo AUTO na emergência depende do firmware.
- O UUID é o UART padrão da Nordic, usado por outros dispositivos: anunciar o serviço não comprova que o dispositivo seja o HydroBot.

### 6.6 O que foi testado
- **Executado:** nenhum teste BLE. Na web, o transporte é substituído por `bleTransport.web.ts`, que informa “Conexão física indisponível” [Teste web: o bundle web não contém `react-native-ble-plx`].
- **Testes automatizados** cobrem só a classificação de compatibilidade (`tests/discovery.test.ts`) e o texto do resultado BLE da emergência (`tests/emergency.test.ts`).
- **Depende de Android + robô:** permissões, busca, conexão, notificações, escrita, perda de conexão, confirmações e efeito físico dos comandos.

---

## 7. Autenticação

| Aspecto | Comportamento atual [Código] |
| --- | --- |
| Login | Aceita um usuário cadastrado localmente (e-mail e senha iguais aos salvos) **ou** uma credencial de demonstração fixa no código (`app/login.tsx`, constantes `APP_EMAIL`/`APP_PASSWORD`). Não há servidor |
| Cadastro | Exige os quatro campos preenchidos, e-mail válido e senhas iguais. Salva nome, e-mail (sem espaços nas pontas) e senha. Um novo cadastro com o mesmo e-mail substitui o anterior |
| Validação de e-mail | Expressão `^[^\s@]+@[^\s@]+\.[^\s@]+$` (`utils/validation.ts`) no Login e no Cadastro |
| Senha | **Sem regra de tamanho ou complexidade.** Armazenada **em texto puro** no AsyncStorage do aparelho (ou `localStorage` na web); sem hash, sem criptografia |
| Sessão | Só em memória (`isAuthenticated`). Não persiste: fechar o app, recarregar ou tocar em **Reiniciar** (`Updates.reloadAsync`) volta ao Login. Não há botão “Sair” na interface (a função `logout` existe no contexto, mas nenhuma tela a chama) |
| Proteção de rotas | `Stack.Protected` [Teste web I5] |
| Mensagens de erro | Login: “Formato de e-mail inválido.”, “E-mail ou senha incorretos.” Cadastro: “Preencha todos os campos.”, “Formato de e-mail inválido.”, “As senhas não coincidem.” Exibidas no `AppModal`, com o foco voltando ao botão de origem [Teste web M1] |
| Observação | No Login, o e-mail é comparado exatamente como digitado, enquanto o Cadastro remove espaços das pontas; espaços extras no Login fazem a comparação falhar. Maiúsculas e minúsculas também diferenciam |

---

## 8. Alterações de IHC presentes no código atual

Todas foram confirmadas no código desta versão (não apenas em relatórios).

| Tema | O que existe | Onde | Evidência |
| --- | --- | --- | --- |
| Feedback de ações | `FeedbackLine` + `useCommandFeedback`: pendente, “aplicado na simulação”, “enviado, aguardando confirmação”, “confirmado pelo dispositivo”, “enviado, sem confirmação”, “falhou” | `hooks/useCommandFeedback.ts`, `components/FeedbackLine.tsx` | Teste web W4, F, AP1 |
| Padronização de modais | `AppModal` claro (avisos, Sobre, Ajuda, confirmações, erros de login e cadastro) e `EmergencyModal` | `components/AppModal.tsx`, `EmergencyModal.tsx`, `NoticeHost.tsx` | Teste web I2, I6 |
| Modo de Simulação | Seção 5; indicador no cabeçalho; conexão automática | `context/BluetoothContext.tsx`, `services/simulator.ts`, `components/HeaderTitle.tsx` | Teste web I3, P-* |
| Estados de conexão | Indicador compacto; Não conectado; Conectando; Preparando simulação; Aguardando dados; Dados desatualizados; “Sem leitura” | `HeaderTitle`, `NotConnectedCard`, `monitor.tsx` | Teste web P-*, T3 |
| Validação de campos | Inteiro completo (rejeita `20abc`, `50.5`, `1e2`, sinais), faixas, ordem limiar < referência < perigo, erro após sair do campo ou ao aplicar, apagar todo o valor permitido, nenhum comando inválido enviado | `utils/validation.ts`, `components/ParamField.tsx` | Teste automatizado; Teste web AP1–AP5 |
| Navegação | Aba “Ajustes” (título “Configurações”); “Configurar sensores” → Configurações; “Ir para Conexão” | `app/(tabs)/_layout.tsx`, `control.tsx`, `NotConnectedCard.tsx` | Teste web TAB, I1 |
| Acessibilidade | Nomes e papéis (botão, switch, rádio, cabeçalho, barra de progresso), `aria-*` junto de `accessibilityState`, ícones decorativos ocultos, anúncios de conexão, modo, fogo, água baixa e emergência, áreas de toque de 48–56 dp, contraste recalculado para os pares de cor principais (todos ≥ 4,5:1; cálculo em `docs/IHC-V3-ajustes.md`, não reexecutado nesta análise), direcionais por toque duplo com TalkBack | Vários; `components/Icon.tsx`, `hooks/useScreenReader.ts` | Teste web M3 (0 ícones expostos), W0 (`aria-checked`); TalkBack: pendente |
| Áreas seguras | Barra de abas soma `insets.bottom`; altura conforme a escala de fonte | `app/(tabs)/_layout.tsx`, `utils/layoutMetrics.ts` | Teste automatizado; Android: pendente |
| Foco | Foco no título ao abrir modais; retorno ao controle de origem ao fechar (Sobre, Ajuda, switch, Reiniciar, erros de login e cadastro, emergência) | `AppModal.tsx`, `EmergencyModal.tsx` | Teste web M1, M2, M4 (foco), EM2, EM5, EM7 |
| Fonte ampliada | Itens do Monitor com largura pelo conteúdo; ícone da emergência com espaço reservado; rótulos das abas com `adjustsFontSizeToFit`; cabeçalho com `maxFontSizeMultiplier` 1,4; plugin nativo para mudança de fonte com o app aberto | `monitor.tsx`, `EmergencyStopBar.tsx`, `_layout.tsx`, `HeaderTitle.tsx`, `plugins/withFontScaleRelayout.js` | Teste web só por aproximação (não comprova Android) |
| Teclado | Login e Cadastro roláveis com `KeyboardAvoidingView`; Configurações reserva a área do teclado e rola até o campo; `keyboardShouldPersistTaps="handled"` (Aplicar no primeiro toque) | `login.tsx`, `register.tsx`, `settings.tsx`, `ParamField.tsx`, `hooks/useKeyboardHeight.ts` | Teste web K1–K3, C1a–C1c, AP1; teclado real: pendente |
| Parada de emergência | Botão fixo em Controle e Monitor, sem confirmação prévia; modal único e grande com resultado por ação; nova tentativa; sem operações concorrentes; Voltar não cancela a parada em andamento; fechar não retoma nada | `EmergencyStopBar.tsx`, `EmergencyModal.tsx`, `services/emergency.ts`, `BluetoothContext.tsx` | Teste automatizado; Teste web EM1–EM13 |
| Bomba e água | Ligar bloqueado com água ≤ 10% ou em AUTO (motivo exibido); desligar sempre possível; seleção de água destacada pela telemetria | `control.tsx`, `settings.tsx` | Teste automatizado; Teste web W0–W4 |
| Textos BLE | Referências a HC-05/HC-06 substituídas por Bluetooth Low Energy (BLE) | Telas e Ajuda | Código |
| Limpeza entre sessões | Mensagens antigas somem ao trocar de modo ou desconectar | `useCommandFeedback`, `SliderSetting`, `ParamField` | Teste web SS1/SS2 |
| Tratamento de erros | `ErrorBoundary`; `sendCommand` devolve resultado estruturado em vez de abrir alertas | `components/ErrorBoundary.tsx`, `BluetoothContext.tsx` | Código |

---

## 9. Testes e verificações (executados em 2026-10-07 sobre `eec281b`)

| # | Comando | Resultado | Erros | Avisos |
| --- | --- | --- | --- | --- |
| 1 | `npx tsc --noEmit` | Código de saída 0 | Nenhum | Nenhum |
| 2 | `npm run lint` (`expo lint`) | Código de saída 0 | Nenhum | Nenhum |
| 3 | `npm test` | **33 testes, 33 aprovados**, 0 falhas | Nenhum | Nenhum |
| 4 | `npx expo install --check` | “Dependencies are up to date” | Nenhum | Nenhum |
| 5 | `npx expo-doctor` | **18/18 checagens aprovadas** | Nenhum | Nenhum |
| 6 | `npx expo export --platform web --clear` | Build gerado em `dist/` (bundle JS de 1,65 MB); nenhum arquivo do bundle contém `react-native-ble-plx` | Nenhum | Nenhum |
| 7 | `node scripts/verificacao-web/verify.mjs <saída> http://localhost:8090` (build web de produção servido por `scripts/verificacao-web/serve.mjs`) | **66 critérios, 66 aprovados**, console sem erros nem avisos | Nenhum | Dois identificadores do roteiro se repetem com significados diferentes (“M1” e “M4”); não afeta os resultados |

### Testes automatizados (`npm test`, 33)
- **Simulador (11):**
  - sem fogo, intensidade abaixo do limiar; cada cenário permanece na sua faixa; `FIRE_STOP` persistente;
  - parâmetros em campos próprios reclassificam; rejeição fora de faixa ou de ordem;
  - movimento e `STOP`; bomba e PWM coerentes; água baixa bloqueia ligar, não desligar;
  - emergência em AUTO com fogo e bomba; reprodutibilidade pela semente; comando desconhecido recusado.
- **Validação (4):** inteiros completos, mensagens por tipo de erro, limites das faixas, ordem dos parâmetros.
- **Emergência (8):** ordem dos comandos; sucesso na simulação; BLE sem afirmar parada; estados informados só pela telemetria posterior; falha parcial; falha total com causa comum ou diferente; títulos.
- **Layout/teclado (6):** sobreposição do teclado; rolagem para o item; item maior que a área livre; altura da barra de abas.
- **Compatibilidade BLE (4):** classificação por serviço, nome ou desconhecido; nenhum rótulo afirma validação.

### Roteiro web (66 critérios) — o que ele cobre
Login e proteção de rota; rolagem de Login e Cadastro com altura reduzida; conexão automática da simulação; indicador nas quatro abas; rótulos das abas; seleção de água e correspondência com o Monitor; aplicação de parâmetros e erros; cancelamento do fogo; título dos sensores; emergência (sucesso, AUTO, falha parcial, nova tentativa, falha total, sem conexão, modal único, Esc/Voltar, foco, nada retomado ao fechar); limpeza de mensagens entre sessões; temporizadores (1 ativo conectado, 0 desconectado, máximo 1 em 5 ciclos); ícones fora da acessibilidade; rolagem até o campo focado; cartão de Conexão em área reduzida; aproximação de fonte ampliada; regressão de navegação, modais, foco e emojis.

**Limites do roteiro web:** a web não tem teclado virtual, TalkBack, `maxFontSizeMultiplier` nem `adjustsFontSizeToFit`. A aproximação de fonte ampliada (texto ×1,8 via CSS) não reproduz os defeitos do Android: em uma execução anterior, comparando com a versão `56b1ce2`, os critérios M1, M4, C2b e TAB passaram nas duas versões (`docs/evidencias/verificacao/controle-negativo-56b1ce2.txt`; **não reexecutado nesta análise**).

### Não executado nesta análise
- **Build Android / APK:** não executado. Não há Android SDK nesta máquina (`ANDROID_HOME` aponta para `D:\dev\android-sdk`, que não existe).
- **Compilação do código nativo gerado pelo plugin `withFontScaleRelayout`:** nunca foi compilada.
- **`npx expo prebuild`:** não reexecutado nesta análise; foi executado em 2026-10-06 para a mesma versão do código, gerando o manifesto e o Kotlin esperados.
- **Testes Android, TalkBack, BLE real e hardware:** nenhum.

---

## 10. Limitações atuais

**Apenas simuladas:** dados de água, fogo, sensores, bomba, movimento e modo AUTO quando em Modo de Simulação; cenários de fogo; falha de envio injetada; calibração (“Calibração simulada”).

**Dependentes de hardware (não verificadas):** comunicação BLE com o robô; efeito físico de movimento, bomba e parada de emergência; leitura real dos sensores e do nível de água; saída do modo AUTO pelo firmware; confirmações `*_SET:`; escala real dos parâmetros de fogo.

**Projetadas no protocolo mas não implementadas na interface:** `CALIBRATE` (calibração pelo app), `SET_SPEED_L/R`, `SET_TURN_SPEED`, `SET_MOTOR_PWM_MIN`, `SET_KICK_FWD/BACK/PWM`.

**Não implementado:**
- botão de logout na interface;
- sessão persistente;
- servidor ou banco de dados;
- hash ou criptografia de senha;
- recuperação de senha;
- regra de tamanho de senha;
- simulação física do robô;
- build iOS.

**Pendências de verificação no Android:**
- teclado real (Login, Cadastro, Configurações);
- fonte máxima e mudança de fonte com o app aberto (plugin `withFontScaleRelayout`);
- TalkBack (anúncios, foco dos modais, rádios, direcionais por toque duplo);
- navegação por gestos e por três botões;
- tema escuro do sistema (o app fixa o tema claro);
- permissões BLE;
- compilação do plugin nativo;
- botão Voltar físico no modal de emergência.

**Diferenças entre web e Android:**

| Aspecto | Web | Android |
| --- | --- | --- |
| Origem dos dados | Só simulação (switch desabilitado; “versão web: conexão física indisponível”) | Simulação ou BLE |
| Armazenamento | `localStorage` | AsyncStorage nativo |
| Leitor de tela | Detecção forçada como inativa; `announceForAccessibility` sem efeito | TalkBack |
| Fonte | Sem ajuste automático de rótulos (`adjustsFontSizeToFit`) nem limite de ampliação (`maxFontSizeMultiplier`) | Com ajuste e limite |
| Teclado | Sem eventos de teclado virtual | Eventos de teclado; edge-to-edge |
| Botão Voltar | Tecla Esc fecha os modais | Botão Voltar do sistema |

**Itens técnicos do repositório:**
- `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `themed-*`, `ui/*`, `haptic-tab.tsx`, `external-link.tsx` e `hooks/use-theme-color.ts`/`use-color-scheme*` são arquivos do template do Expo, não usados pelas telas.
- `hooks.zip` (versionado) contém uma cópia antiga de arquivos do projeto e não participa do build.
- Em `app/_layout.tsx`, a verificação `isAuthenticated === null` nunca é verdadeira (o estado é booleano), e o `RestartButton` do Stack raiz não aparece, porque os cabeçalhos dessas telas estão ocultos.
- O `README.md` mantém, abaixo da seção do projeto, o texto padrão do template do Expo.

---

## 11. Classificação para documentação acadêmica

| Recurso | Estado | Evidência |
| --- | --- | --- |
| Login | **IMPLEMENTADO** | `app/login.tsx`, `context/AuthContext.tsx`; Teste web I5, M1, K1, K2 |
| Cadastro | **IMPLEMENTADO** (local, sem servidor; senha em texto puro) | `app/register.tsx`; Teste web K3 e cadastro no roteiro |
| Sessão persistente / logout | **PROJETADO / NÃO IMPLEMENTADO** (sessão só em memória; sem botão Sair) | `context/AuthContext.tsx` |
| BLE (busca, conexão, envio, telemetria) | **DEPENDENTE DE HARDWARE** (código implementado, não testado em dispositivo) | `services/bleTransport.ts`, `context/BluetoothContext.tsx`; sem teste executado |
| Compatibilidade na busca BLE | **IMPLEMENTADO** na lógica / **DEPENDENTE DE HARDWARE** no uso | `services/hydroBotProtocol.ts`; Teste automatizado (4) |
| Modo de Simulação | **IMPLEMENTADO** (recurso de teste da interface) | `services/simulator.ts`; Teste automatizado (11); Teste web |
| Monitoramento (tela Monitor) | **IMPLEMENTADO**; valores reais **DEPENDENTES DE HARDWARE** | `app/(tabs)/monitor.tsx`; Teste web I3, W2, E1, S1 |
| Telemetria | **SIMULADO** (executado); recepção BLE **DEPENDENTE DE HARDWARE** | Teste web; `parseHydroBotMessage` só por Código |
| Movimentação | **SIMULADO** (estado de movimento); físico **DEPENDENTE DE HARDWARE** | Teste automatizado; Teste web EM1/EM3 |
| Bomba | **SIMULADO** (estado/PWM e bloqueio com água baixa); físico **DEPENDENTE DE HARDWARE** | Teste automatizado; Teste web W4, EM10 |
| Parada de emergência | **IMPLEMENTADO** na interface e na simulação; efeito físico **DEPENDENTE DE HARDWARE** | `services/emergency.ts`, `EmergencyModal.tsx`; Teste automatizado (8); Teste web EM1–EM13 |
| Sensores de fogo | **SIMULADO** (três sensores, Δ, faixas); leitura real **DEPENDENTE DE HARDWARE** | `services/simulator.ts`; Teste web S1/S2 |
| Detecção de fogo / cenários | **SIMULADO** | Teste automatizado; Teste web E1 |
| Combate a incêndio (atuação autônoma) | **DEPENDENTE DE HARDWARE** (firmware; o app só envia `MODE_AUTO`) | Código |
| Calibração dos sensores | **PROJETADO / NÃO IMPLEMENTADO** na interface (`CALIBRATE` só no protocolo e na simulação) | `services/hydroBotProtocol.ts`, `services/simulator.ts` |
| Configurações (velocidade, PWM, parâmetros de fogo) | **IMPLEMENTADO** (validação e envio); aplicação no robô **DEPENDENTE DE HARDWARE** | `app/(tabs)/settings.tsx`; Teste automatizado; Teste web AP1–AP5 |
| Nível de água | **SIMULADO** (8%/75%); sensor real **DEPENDENTE DE HARDWARE** | Teste web W0–W4 |
| Acessibilidade (nomes, papéis, foco, ícones) | **IMPLEMENTADO**; TalkBack **pendente** | Teste web M3, foco; Android não testado |
| Fonte ampliada / mudança de fonte | **IMPLEMENTADO** no código; **não verificado no Android** | `plugins/withFontScaleRelayout.js`, `monitor.tsx`, `_layout.tsx` |
| Teclado | **IMPLEMENTADO**; teclado real **não verificado no Android** | Teste web K1–K3, C1 |
| Versão web | **IMPLEMENTADO** (somente simulação) | Teste web (66/66) |
| Versão iOS | **PROJETADO / NÃO IMPLEMENTADO** (configuração existe; nenhum build) | `app.json` |

---

## 12. Comandos para reproduzir

Instalação e verificações:

```bash
npm install
npx tsc --noEmit
npm run lint
npm test
npx expo-doctor
npm run build:web
```

Verificação web (com o servidor rodando, execute o `verify.mjs` em outro terminal):

```bash
node scripts/verificacao-web/serve.mjs dist 8090
node scripts/verificacao-web/verify.mjs saida-verificacao http://localhost:8090
```

APK Android (não executado nesta análise):

```bash
eas build --platform android --profile preview
```

O `verify.mjs` usa o Chrome; outro caminho pode ser informado em `CHROME_PATH`.

---

## 13. Divergências com relatórios anteriores (o código atual prevalece)

| Fonte anterior | Afirmação | Situação no código atual |
| --- | --- | --- |
| Versões anteriores de `RELATORIO_ALTERACOES_IHC_HYDROBOT.md` | Android SDK presente em `D:\dev\android-sdk` | Incorreto: a pasta não existe (já corrigido em `eec281b`) |
| Interface até `a806ef9` (aba Conexão: “Busque por HC-05 ou HC-06”; rodapé de Configurações: “Bluetooth HC-05/06”) e documentação do projeto que cite HC-05/HC-06 | Bluetooth Clássico HC-05/HC-06 | O app usa somente BLE (`react-native-ble-plx`), inclusive em `a806ef9`; os textos foram corrigidos |
| Versões antigas da interface | Botão “Calibrar Sensores” | Hoje é “Configurar sensores”, que só navega; calibração pelo app não existe |
| Versões antigas da interface | Aba “Configurações” | Rótulo da aba é “Ajustes”; o título da tela continua “Configurações” |
| Versões antigas da interface | Faixa grande “MODO DE SIMULAÇÃO” no topo | Substituída pelo indicador compacto no cabeçalho |
| `docs/IHC-V3-ajustes.md` | Descreve a versão `f103d1a` e capturas em `docs/evidencias/web/` | Desatualizado em relação a `51ac9a6` (o próprio arquivo avisa); as capturas atuais estão em `docs/evidencias/verificacao/` |
| GitHub (`origin/ihc-v3-ajustes`) | Último commit `3662cce` | A versão analisada (`eec281b`) ainda não foi enviada; quem consultar o GitHub verá a versão anterior, sem as correções de teclado, fonte ampliada, ícones e emergência sem conexão |

---

## Informações seguras para utilizar no documento acadêmico

- O aplicativo HydroBot é desenvolvido em **React Native 0.81.5 com Expo SDK 54, TypeScript 5.9 e Expo Router 6**; **não usa Flutter nem Dart**.
- A comunicação com o robô foi implementada com **Bluetooth Low Energy**, por meio da biblioteca **react-native-ble-plx 3.5.0**, usando o serviço UART padrão da Nordic (UUID `6e400001-b5a3-f393-e0a9-e50e24dcca9e`). **Essa comunicação não foi testada com o robô físico.**
- O app tem seis telas: Login, Cadastro e as abas **Conexão, Controle, Monitor e Ajustes (Configurações)**. O acesso às abas exige autenticação.
- A autenticação é **local**: usuários cadastrados ficam salvos no próprio aparelho (AsyncStorage), sem servidor; a sessão não é mantida entre aberturas do app.
- O app possui um **Modo de Simulação**, ativo por padrão, que gera dados de água, fogo, sensores, bomba e movimento para **testar a interface sem o robô**; ele não valida o hardware.
- A interface oferece controle de movimento (pressionar e soltar), modo automático/manual, controle da bomba com bloqueio por água baixa, **parada de emergência sem confirmação prévia** com resultado detalhado, monitoramento da telemetria e configuração de velocidade, PWM e parâmetros de detecção de fogo com validação.
- Melhorias de IHC presentes no código: indicação constante do modo e da conexão, feedback distinto para comando aplicado, enviado, confirmado ou com falha, modais padronizados com controle de foco, validação de campos com mensagens específicas, rótulos e papéis acessíveis, ícones decorativos ocultos ao leitor de tela, contraste revisado e ajustes para teclado e fonte ampliada.
- Verificações executadas em 2026-10-07 sobre o commit `eec281b`: verificação de tipos e lint sem erros, **33 testes automatizados aprovados**, `expo-doctor` com 18/18 checagens aprovadas e **66 critérios aprovados** em roteiro automatizado na versão web, em Modo de Simulação.
- **Nenhum teste em aparelho Android, com TalkBack ou com o robô físico foi realizado nesta análise**; esses testes permanecem pendentes.
