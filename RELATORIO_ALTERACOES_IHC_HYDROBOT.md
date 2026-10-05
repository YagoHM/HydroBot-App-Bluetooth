# Relatório técnico — alterações de IHC no HydroBot (pré-build Android)

## Identificação

| Item | Valor |
| --- | --- |
| Repositório | `YagoHM/HydroBot-App-Bluetooth` (cópia local) |
| Base analisada | `master` @ `a806ef9` (“Cadastro & Login”) |
| Branch das alterações | `ihc-v3-ajustes` (local, **ainda não enviada ao GitHub**) |
| Commits das alterações | `2c41ee4` (ajustes de IHC) e `0880d3d` (conexão automática da simulação, que evita a regressão do I3, e evidências). O próprio relatório entra num commit posterior na mesma branch |
| Escopo | Interface mobile, usabilidade, comunicabilidade e acessibilidade. O Modo de Simulação é um recurso para testar a interface |

### Como ler as verificações

| Rótulo | Significado |
| --- | --- |
| **Lógica** | Testes automatizados executados (`npm test`, 15 testes) sobre o simulador e a validação. |
| **Web** | Roteiro automatizado executado no **build web de produção** (`expo export`), em Chrome headless, viewport 390×844, Modo de Simulação. Scripts em `scripts/verificacao-web/` e logs em `docs/evidencias/`. |
| **Código** | Apenas análise do código-fonte, sem execução. |
| **Pendente (Android)** | Depende do aplicativo instalado; nada foi executado em Android nesta etapa. |

Nada aqui é reteste com participantes nem validação do robô físico. A execução web confirma o comportamento da interface e da simulação; não confirma BLE, TalkBack, teclado ou barras nativas do Android.

---

## 1. Alterações atuais

| Problema ou requisito | Alteração realizada | Arquivos | Verificação e resultado observado | Pendência no app instalado |
| --- | --- | --- | --- | --- |
| **BLE — textos incompatíveis** (HC-05/HC-06 com biblioteca BLE) | “Busque pelo HydroBot compatível com Bluetooth Low Energy (BLE)”, rodapé “Bluetooth Low Energy (BLE)”, Ajuda e texto de permissão iOS sem “Arduino”. UUIDs e comandos inalterados | `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx`, `app.json` | **Código**: busca por “HC-0” e “Arduino” fora de `node_modules` sem ocorrências. **Web**: textos novos exibidos | Conferir os textos com o modo BLE ativo |
| **BLE — transporte isolado por plataforma** | `BleManager` criado só no primeiro uso. A versão web (`bleTransport.web.ts`) não importa `react-native-ble-plx`. Removido `services/bleService.ts` (não usado e divergente) | `services/bleTransport.ts`, `services/bleTransport.web.ts`, `services/hydroBotProtocol.ts`, `context/BluetoothContext.tsx` | **Web**: o bundle de produção não contém `react-native-ble-plx` e o app abre. A versão inicial `a806ef9` abria em branco com `TypeError: Cannot read properties of undefined (reading 'createClient')` (`docs/evidencias/web-versao-inicial-a806ef9.png`) | Busca, conexão, notificações e escrita BLE com o robô; permissões Android 12+ |
| **Identificação da simulação** | Faixa “MODO DE SIMULAÇÃO” igual nas quatro abas, com ícone e texto além da cor. Conexão diferencia “Conectado ao dispositivo simulado” de “Conectado via Bluetooth BLE”. Monitor rotula “Leituras SIMULADAS”, “(simulado)” e “Calibração simulada” | `components/ModeBanner.tsx`, `app/(tabs)/*.tsx` | **Web**: faixa presente nas quatro abas; com a simulação ativa, nenhum “Desconectado” no texto visível (regressão E5) | Leitura da faixa pelo TalkBack; fontes ampliadas |
| **Conexão automática da simulação** | Com a simulação ativa, o dispositivo simulado conecta ao abrir o app e ao ativar o modo; ainda é possível desconectar e reconectar | `context/BluetoothContext.tsx` | **Web**: logo após o login, o Monitor mostra “Leituras SIMULADAS” sem passar por Conexão (regressão I3) | — |
| **Coerência dos dados — ausência** | A telemetria passou a ter campos opcionais, e o que falta aparece como “Sem leitura”, nunca como 0. Estados: “Não conectado”, “Preparando simulação…”/“Aguardando dados” e “Dados desatualizados” (> 5 s sem leitura) | `services/telemetry.ts`, `app/(tabs)/monitor.tsx` | **Web**: Monitor sem conexão mostra “Não conectado”; antes da 1ª leitura, “Preparando simulação…”; após Desconectar, nenhuma leitura antiga | BLE conectado sem telemetria; perda de conexão real (**Código**) |
| **Coerência dos dados — fogo** | Cenários da simulação (sem fogo, detecção, referência, elevada) presos à faixa escolhida; `FIRE_STOP` persiste até nova ação. Rótulos de faixa em unidade relativa (“Acima da intensidade de perigo”…), no lugar de “Muito Perto/Combatendo” | `services/simulator.ts`, `services/fireLevels.ts`, `app/(tabs)/monitor.tsx`, `app/(tabs)/settings.tsx` | **Lógica**: 200–300 ciclos por cenário, sempre na faixa; cancelamento persiste. **Web**: “Elevada” 407, 412, 399, 401; após cancelar, 11, 12, 11, 15, 10 com “Nenhum fogo detectado” | — |
| **Parâmetros aplicados** | Limiar, referência e perigo ficam em campos próprios (não sobrescrevem os sensores), e o Monitor classifica com os valores aplicados. “Distância Ideal” virou “Intensidade de Referência”, sem mudar o comando `SET_FIRE_IDEAL` | `services/simulator.ts`, `components/ParamField.tsx`, `app/(tabs)/monitor.tsx` | **Lógica**: base dos sensores intacta após `SET_FIRE_*`. **Web**: limiar 100 aplicado → Monitor “detecção ≥ 100”, intensidade 141 “Acima do limiar” | Confirmar no firmware o significado e a escala de `SET_FIRE_*` |
| **Validação** | Aceita só texto inteiro com dígitos (rejeita `20abc`, `50.5`, `1e2`, sinais). Mensagem por tipo de erro, `onBlur` em todos os campos, regra limiar < referência < perigo explicada na tela. “Aplicar” com valor inválido mantém o foco no campo e não envia comando | `utils/validation.ts`, `components/ParamField.tsx` | **Lógica**: 4 testes. **Web**: `""` → “Digite um valor.”; `20abc`/`1e2` → “Use apenas dígitos…”; `50.5` → “sem casas decimais”; `19` → “entre 20 e 200”; `200` → “Deve ser menor que a intensidade de referência em vigor (200).”; apagar tudo e redigitar continua possível (E2) | Teclado numérico Android e colagem de texto |
| **Resultado dos comandos** | `sendCommand` passou a retornar `applied-sim`, `sent` ou `failed`, sem `Alert` interno. As telas distinguem “aplicado na simulação”, “enviado, aguardando confirmação”, “confirmado pelo dispositivo”, “enviado, sem confirmação” e “falhou” | `context/BluetoothContext.tsx`, `hooks/useCommandFeedback.ts`, `components/FeedbackLine.tsx` | **Web** (falha injetada em todos os comandos): limiar 120 → “falhou”, valor em vigor inalterado; modo → “falhou”, segue Manual; bomba → “falhou”, segue Desligada | Falha real de escrita BLE (**Código**) |
| **Emergência — acesso** | Botão “PARADA DE EMERGÊNCIA” fixo no rodapé de Controle e Monitor, fora da rolagem, sem confirmação prévia; distinto do “PARAR” (apenas movimento) | `components/EmergencyStopBar.tsx`, `app/(tabs)/control.tsx`, `app/(tabs)/monitor.tsx` | **Web**: visível nas duas abas sem rolar, na viewport 390×844 | Área segura e barra do sistema; fontes ampliadas |
| **Emergência — comportamento** | Ação centralizada: `STOP`, `PUMP_OFF` e `MODE_MANUAL`, cada um tentado mesmo se o anterior falhar. Resultado por comando; a detecção de fogo não é alterada | `context/BluetoothContext.tsx`, `components/EmergencyStopBar.tsx` | **Lógica** e **Web**: em AUTO com fogo elevado e bomba ligada → movimento parado, bomba desligada, modo Manual 2 s depois, fogo mantido (413). Com falha injetada na bomba → “Parada com falha parcial”, bomba segue “Ligada” | Efeito físico; saída do AUTO pelo firmware |
| **Bomba — representação** | Simulação usa PWM coerente (ligada = PWM máximo). Tela: “Ligada · PWM 255 de 255 (100%)” | `services/simulator.ts`, `app/(tabs)/control.tsx`, `app/(tabs)/monitor.tsx` | **Lógica** e **Web**: sem “LIGADA” com “0%” | Formato de `pump` na telemetria real |
| **Bomba — água baixa** | Bloqueio só para ligar (água ≤ 10% ou modo AUTO), com motivo visível; desligar nunca é bloqueado | `app/(tabs)/control.tsx` | **Lógica** e **Web**: água 8% com bomba ligada → “Desligar” funcionou; “Ligar” desabilitado com “Reabasteça para ligar a bomba” | — |
| **Movimento simulado** | Estado de movimento para os direcionais e `STOP` | `services/simulator.ts`, `app/(tabs)/control.tsx` | **Web**: segurando “frente” → “Para frente”; ao soltar → “Parado” | Pressionar/soltar em tela de toque real |
| **Sliders e PWM** | A telemetria não sobrescreve o slider durante o arraste. PWM mín ≤ máx pelos limites dependentes. Botões − / + de 48 dp; em falha, o slider volta ao último valor | `components/SliderSetting.tsx`, `app/(tabs)/settings.tsx` | **Lógica**: `SET_PWM_MIN:210` com máx 200 recusado. Sem arraste e reversão: **Código** | Arraste no aparelho com telemetria chegando |
| **Isolamento entre modos** | Geração de sessão: trocar de modo, desconectar ou perder a conexão encerra busca, temporizadores, assinatura e conexão física; callbacks antigos são descartados | `context/BluetoothContext.tsx` (`invalidateSession` l. 206, `teardown` l. 227, `toggleMockMode` l. 610, descarte na conexão l. 565) | **Web** (temporizadores da simulação): 1 ativo após conectar, 0 após desconectar, máximo 1 em 5 ciclos. Troca BLE ↔ simulação: **Código** (na web não há BLE) | Alternar BLE ↔ simulação com o robô conectado |
| **Calibração** | “Calibrar Sensores” virou “Configurar sensores”, abrindo Configurações (sem calibração física) | `app/(tabs)/control.tsx` | **Web**: o toque leva a `/settings` (regressão I1) | — |
| **Ajuda e mensagens** | Ajuda reescrita conforme o comportamento implementado (simulação × robô, sem prometer parada garantida). Avisos de conexão e reinício passaram para o `AppModal` claro; feedback de comando fica inline, sem modal a cada leitura | `app/(tabs)/settings.tsx`, `components/NoticeHost.tsx`, `components/AppModal.tsx`, `app/(tabs)/_layout.tsx` | **Web**: Ajuda e Sobre abrem; modal com fundo `rgb(255,255,255)` (regressão I6); mensagem longa rolável | Diálogos de permissão nativos |
| **Acessibilidade — rótulos e papéis** | Nomes acessíveis (mover para frente/trás/esquerda/direita, parar movimento, parada de emergência, aplicar…), papéis (`button`, `switch`, `radio`, `progressbar`, `header`), estados e valores dos sliders; erros associados ao campo | Telas e componentes | **Web**: árvore de acessibilidade expôs, entre outros, botão “Mover para frente”, “Aplicar Limiar de Detecção” e switch “Modo de Simulação” desabilitado | **TalkBack** |
| **Acessibilidade — pressionar/soltar** | Com TalkBack ativo, toque duplo na seta inicia o movimento e “Parar movimento” encerra; o modo é detectado por `AccessibilityInfo` (na web sempre desativado) | `app/(tabs)/control.tsx`, `hooks/useScreenReader.ts` | **Código** | **TalkBack** |
| **Acessibilidade — foco e anúncios** | Ao abrir um modal, o foco vai para o título (`accessibilityViewIsModal`). Anúncios só em mudança de conexão, modo, fogo, água baixa e emergência, não a cada leitura | `components/AppModal.tsx`, `context/BluetoothContext.tsx` | **Código** (na web os anúncios são inoperantes). O retorno do foco ao fechar o modal **não foi implementado** | **TalkBack** |
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

Log: `docs/evidencias/regressao/regressao-web.log.json`. Capturas: `docs/evidencias/regressao/`.

---

## 3. Verificações antes do build

### Comandos executados

| Comando | Resultado | Erros ou avisos remanescentes |
| --- | --- | --- |
| `npx tsc --noEmit` | Saída 0 | Nenhum |
| `npm run lint` (`expo lint`) | Saída 0, sem mensagens | Nenhum (a base `a806ef9` tinha 2 avisos `array-type`, corrigidos) |
| `npm test` | 15 testes, 15 aprovados | Nenhum |
| `npx expo export --platform web` | Build gerado em `dist/` | Nenhum |
| `node scripts/verificacao-web/flow.mjs …` (roteiro principal, build de produção) | Todas as etapas concluídas; 23 capturas | Console sem erros nem avisos |
| `node scripts/verificacao-web/regress.mjs …` (regressão + falhas + temporizadores) | 18 checagens concluídas | Console sem erros nem avisos |
| `npx expo install --check` / `npx expo-doctor` | 1 checagem falhou: **13 pacotes com versão de patch abaixo da esperada pelo SDK 54** (ex.: `expo` 54.0.21 × ~54.0.37, `expo-router` 6.0.14 × ~6.0.24) | Ver §4 |
| Build Android | **Não executado** nesta etapa | — |

O dev server também foi usado na web durante o desenvolvimento (em desenvolvimento, o Metro mostra avisos do react-native-web sobre `shadow*` e `pointerEvents`; o build de produção não registrou nenhum).

### Checagens específicas

| Checagem | Teste executado | Análise de código |
| --- | --- | --- |
| Persistência do cancelamento do fogo simulado | **Lógica**: 300 ciclos após `FIRE_STOP` sem fogo. **Web**: 5 leituras seguidas entre 10 e 15, “Nenhum fogo detectado” | A atualização periódica (`simTick`) altera só o ruído, nunca o cenário |
| Emergência interrompe movimento e bomba sem retomada automática | **Lógica**: STOP/PUMP_OFF/MODE_MANUAL seguidos de 50 ciclos → parado, bomba 0, Manual, fogo mantido. **Web**: nas duas abas, Manual e bomba desligada 2 s depois, fogo 413 mantido | No BLE, depende do firmware (§5) |
| Desligar a bomba com água baixa | **Lógica** e **Web**: água 8% com bomba ligada → desligou; ligar ficou bloqueado com motivo | — |
| Simulação usa os parâmetros aplicados | **Lógica**: limiar/referência/perigo 100/300/500 → intensidade em [100, 300) classificada “detecção”. **Web**: Monitor exibiu “detecção ≥ 100” após aplicar 100 | — |
| Entradas inválidas rejeitadas | **Lógica**: `""`, `"   "`, `20abc`, `50.5`, `50,5`, `1e2`, `-5`, `0x10`, `+20` e `2 0` rejeitados, além de limites e ordem. **Web**: `""`, `20abc`, `50.5`, `1e2`, `19` e `200` com mensagem específica; “Aplicar” com valor inválido não mostrou sucesso e manteve o foco no campo | — |
| Sem sucesso falso quando o envio falha | **Web** com falha injetada: limiar, modo e bomba mostram “falhou” e mantêm o estado anterior; emergência mostra falha parcial | BLE: em exceção de escrita, `sendCommand` retorna `failed` e trata perda de conexão (l. 361–405). Slider volta ao último valor em falha (`SliderSetting.tsx` l. 80) |
| Encerramento de conexões e temporizadores ao alternar os modos | **Web** (só simulação): intervalos de 600 ms ativos 1 → 0 ao desconectar; máximo 1 em 5 ciclos de conectar/desconectar; Monitor sem dados antigos | Troca BLE ↔ simulação: `toggleMockMode` chama `teardown` (para a busca, limpa temporizadores, fecha a conexão BLE e incrementa a geração); conexão BLE que termina depois da troca é fechada (l. 565). **Não executado: exige Android com BLE** |

### O que não pôde ser executado e por quê

- **BLE real, permissões e troca BLE ↔ simulação**: na web, o transporte BLE é intencionalmente indisponível, e não houve aparelho Android com o robô nesta etapa.
- **TalkBack, anúncios e foco**: o react-native-web não implementa `announceForAccessibility` nem detecta leitor de tela.
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

Versão instalável para teste (APK):

```bash
eas build --platform android --profile preview
```

Para depurar no aparelho com o Metro, use um development build:

```bash
eas build --platform android --profile development
```

O perfil `production` gera AAB, voltado à loja, e não é necessário para esta revisão. Uma alternativa local, com o SDK já presente em `D:\dev\android-sdk`, é `npx expo prebuild --clean` seguido de `npx expo run:android --variant release` (não executado).

### Possíveis impedimentos

1. **Versões de patch desalinhadas** (expo-doctor, 13 pacotes). Recomenda-se `npx expo install --fix`, seguido de `npx tsc --noEmit`, `npm run lint`, `npm test` e da execução web antes do build. Não apliquei a atualização, porque altera dependências e merece revisão da equipe.
2. **Pasta `android/` local desatualizada**: é anterior às mudanças de `app.json` (ainda usa tema `DayNight`). Ela está no `.gitignore`, então o EAS gera os arquivos nativos a partir do `app.json`. Para build local, use `npx expo prebuild --clean`.
3. **Branch não publicada**: o EAS empacota a cópia local. Rode o build a partir da branch `ihc-v3-ajustes` com a árvore limpa (`git status`).
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
| **TalkBack** | Leitura da faixa de modo, rótulos dos direcionais, toque duplo para mover e “Parar movimento”, switches e chips com estado, sliders (valor e −/+), erros dos campos, foco ao abrir/fechar modais, anúncios de conexão/modo/fogo/água sem narrar cada leitura |
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

Com o servidor rodando, em outro terminal, execute a regressão. Ela usa o Chrome; outro caminho pode ser informado em `CHROME_PATH`:

```bash
node scripts/verificacao-web/regress.mjs saida-regressao http://localhost:8090
```
