import { Ionicons } from "../../components/Icon";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppModal, { AppModalButton } from "../../components/AppModal";
import FeedbackLine from "../../components/FeedbackLine";
import ParamField from "../../components/ParamField";
import SliderSetting from "../../components/SliderSetting";
import { announce, useBluetooth, type SimFailure } from "../../context/BluetoothContext";
import { useCommandFeedback } from "../../hooks/useCommandFeedback";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { keyboardOverlap, scrollTargetForItem } from "../../utils/layoutMetrics";
import {
  DEFAULT_FIRE_PARAMS,
  type FireParamKey,
  type FireParams,
} from "../../services/fireLevels";
import type { FireScenario } from "../../services/telemetry";

interface ModalState {
  title: string;
  message?: string;
  buttons?: AppModalButton[];
  /** Controle que abriu o modal; recebe o foco de volta ao fechar. */
  returnFocusRef?: RefObject<any>;
}

const SCENARIOS: { key: FireScenario; command: string; label: string }[] = [
  { key: "none", command: "FIRE_STOP", label: "Sem fogo" },
  { key: "detected", command: "FIRE_SIM:DETECTED", label: "Detecção" },
  { key: "reference", command: "FIRE_SIM:REFERENCE", label: "Referência" },
  { key: "high", command: "FIRE_SIM:HIGH", label: "Elevada" },
];

const WATER_LEVELS: { value: number; label: string }[] = [
  { value: 8, label: "Água baixa (8%)" },
  { value: 75, label: "Reabastecer (75%)" },
];

const FAILURES: { key: SimFailure; label: string }[] = [
  { key: "none", label: "Nenhuma" },
  { key: "pump", label: "Comandos da bomba" },
  { key: "all", label: "Todos os comandos" },
];

const HELP_TEXT =
  "Conexão: busque e conecte ao HydroBot por Bluetooth Low Energy (BLE). No Modo de Simulação, conecte ao dispositivo simulado.\n\n" +
  "Controle manual: mantenha uma seta pressionada para mover; ao soltar, o app envia Parar. Com leitor de tela, toque duas vezes na seta e use Parar movimento.\n\n" +
  "Modo automático: o firmware do robô decide movimento e bomba. Na simulação, o deslocamento automático não é reproduzido.\n\n" +
  "Bomba: ligar fica bloqueado com água em 10% ou menos e no modo automático; desligar está sempre disponível.\n\n" +
  "Parada de emergência (Controle e Monitor): envia, sem pedir confirmação, parar movimento, desligar bomba e sair do modo automático. Na simulação, o efeito é aplicado e mostrado. Com o robô, o app informa o que foi enviado e o que a telemetria confirmou; confirme visualmente que o robô parou.\n\n" +
  "Configurar sensores: limiar de detecção, intensidade de referência e intensidade de perigo, em unidade relativa, sempre com limiar < referência < perigo. O app não executa calibração física.\n\n" +
  "Modo de Simulação: dados gerados pelo app para testar a interface e as mensagens. Não comprova movimentação, combate a incêndio, calibração ou segurança do robô físico.";

export default function SettingsScreen() {
  const {
    isConnected,
    telemetry,
    isMockMode,
    toggleMockMode,
    bleAvailable,
    simFailure,
    setSimFailure,
  } = useBluetooth();
  const [modal, setModal] = useState<ModalState | null>(null);
  const mockSwitchRef = useRef<any>(null);
  const aboutRef = useRef<any>(null);
  const helpRef = useRef<any>(null);
  const [pwmMinLocal, setPwmMinLocal] = useState(180);
  const [pwmMaxLocal, setPwmMaxLocal] = useState(255);
  // Valores confirmados pelo dispositivo quando a telemetria não traz os parâmetros.
  const [confirmedParams, setConfirmedParams] =
    useState<FireParams>(DEFAULT_FIRE_PARAMS);
  const simFb = useCommandFeedback();

  // ── Teclado (C1): o Android com edge-to-edge não encolhe a janela, então a
  // tela reserva a área coberta pelo teclado e rola até o cartão em edição.
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const viewportRef = useRef(0);
  const focusedCardRef = useRef<any>(null);
  const tabBar = useBottomTabBarHeight();
  const overlap = keyboardOverlap(useKeyboardHeight(), tabBar);
  const overlapRef = useRef(overlap);

  const ensureFocusedVisible = useCallback(() => {
    const card = focusedCardRef.current;
    const content = contentRef.current;
    if (!card || !content) return;
    card.measureLayout(
      content,
      (_x: number, y: number, _w: number, h: number) => {
        const target = scrollTargetForItem({
          itemTop: y,
          itemHeight: h,
          scrollY: scrollYRef.current,
          viewportHeight: viewportRef.current,
          overlap: overlapRef.current,
        });
        if (target !== null) scrollRef.current?.scrollTo({ y: target, animated: true });
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    overlapRef.current = overlap;
    if (overlap > 0) ensureFocusedVisible();
  }, [overlap, ensureFocusedVisible]);

  const handleFieldFocus = useCallback(
    (card: any) => {
      focusedCardRef.current = card;
      // aguarda o teclado abrir/o cartão crescer antes de medir
      setTimeout(ensureFocusedVisible, 60);
    },
    [ensureFocusedVisible],
  );
  const handleFieldBlur = useCallback((card: any) => {
    if (focusedCardRef.current === card) focusedCardRef.current = null;
  }, []);

  const telemetryParams: FireParams | null =
    telemetry?.fire_thresh !== undefined &&
    telemetry.fire_ideal !== undefined &&
    telemetry.fire_danger !== undefined
      ? {
          thresh: telemetry.fire_thresh,
          ideal: telemetry.fire_ideal,
          danger: telemetry.fire_danger,
        }
      : null;
  const currentParams = telemetryParams ?? confirmedParams;

  const handleParamConfirmed = (key: FireParamKey, value: number) =>
    setConfirmedParams((p) => ({ ...p, [key]: value }));

  const handleToggleMock = () => {
    if (!bleAvailable) {
      setModal({
        returnFocusRef: mockSwitchRef,
        title: "Somente simulação",
        message:
          "Na versão web não há acesso ao Bluetooth do robô. Use o app Android para a conexão física.",
      });
      return;
    }
    const activating = !isMockMode;
    setModal({
      returnFocusRef: mockSwitchRef,
      title: activating ? "Ativar Modo de Simulação?" : "Usar Bluetooth BLE?",
      message: activating
        ? "O app usará um dispositivo simulado e nenhum robô físico será controlado. A busca e a conexão BLE atuais serão encerradas."
        : "O app passará a usar Bluetooth Low Energy (BLE). A conexão simulada será encerrada e os dados simulados, descartados.",
      buttons: [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            const changed = await toggleMockMode();
            if (!changed) return;
            setConfirmedParams(DEFAULT_FIRE_PARAMS);
            setModal({
              returnFocusRef: mockSwitchRef,
              title: activating
                ? "Modo de Simulação ativado"
                : "Modo Bluetooth BLE ativado",
              message: activating
                ? "O dispositivo simulado está sendo conectado. Os dados exibidos serão simulados."
                : "Busque e conecte ao HydroBot na aba Conexão.",
            });
          },
        },
      ],
    });
  };

  const runWater = async (w: (typeof WATER_LEVELS)[number]) => {
    const { confirmed } = await simFb.run(`SIM_WATER:${w.value}`, {
      label: `Água simulada em ${w.value}%`,
    });
    // Em falha, a seleção continua no valor anterior (vem da telemetria) e a falha aparece abaixo.
    if (confirmed) announce(`${w.label} selecionado`);
  };

  const runScenario = (s: (typeof SCENARIOS)[number]) =>
    simFb.run(s.command, { label: `Cenário de fogo: ${s.label}` });

  const controlsEnabled = isConnected;
  const scenario = telemetry?.scenario;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        // Espaço extra só enquanto o teclado está aberto: ao fechar, volta a 0.
        contentContainerStyle={{ paddingBottom: overlap }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={(e) => {
          viewportRef.current = e.nativeEvent.layout.height;
        }}
      >
        <View ref={contentRef} collapsable={false} style={styles.content}>
          {/* ── ORIGEM DOS DADOS ─────────────────────────────────── */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Origem dos dados
          </Text>

          <View style={[styles.card, isMockMode && styles.cardMockActive]}>
            <View style={styles.mockRow}>
              <Ionicons
                name={isMockMode ? "flask" : "bluetooth"}
                size={24}
                color={isMockMode ? "#92400E" : "#374151"}
                style={styles.mockIcon}
              />
              <View style={styles.mockText}>
                <Text style={styles.mockTitle} nativeID="mock-switch-label">
                  Modo de Simulação
                </Text>
                <Text style={styles.mockSubtitle}>
                  {isMockMode
                    ? "Ativo — os dados são gerados pelo aplicativo, sem controlar um robô físico"
                    : "Inativo — usando Bluetooth Low Energy (BLE)"}
                </Text>
                {!bleAvailable && (
                  <Text style={styles.mockSubtitle}>
                    Versão web: a conexão física não está disponível.
                  </Text>
                )}
              </View>
              <Switch
                ref={mockSwitchRef}
                value={isMockMode}
                onValueChange={handleToggleMock}
                disabled={!bleAvailable}
                trackColor={{ false: "#9CA3AF", true: "#FCA5A5" }}
                thumbColor={isMockMode ? "#B91C1C" : "#F9FAFB"}
                accessibilityLabel="Modo de Simulação"
                accessibilityLabelledBy="mock-switch-label"
                accessibilityRole="switch"
                accessibilityState={{ checked: isMockMode, disabled: !bleAvailable }}
                aria-checked={isMockMode}
              />
            </View>

            {isMockMode && (
              <View style={styles.mockPanel}>
                {!isConnected ? (
                  <Text style={styles.mockHintText}>
                    Conecte-se ao dispositivo simulado na aba Conexão para usar os
                    cenários de teste.
                  </Text>
                ) : (
                  <>
                    <Text style={styles.groupTitle}>Cenário de fogo simulado</Text>
                    <Text style={styles.mockHintText}>
                      A intensidade fica dentro da faixa escolhida, conforme os
                      parâmetros aplicados, até você escolher outro cenário.
                    </Text>
                    <View
                      style={styles.chips}
                      accessibilityRole="radiogroup"
                      accessibilityLabel="Cenário de fogo simulado"
                    >
                      {SCENARIOS.map((s) => {
                        const selected = scenario === s.key;
                        return (
                          <TouchableOpacity
                            key={s.key}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => void runScenario(s)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected, checked: selected }}
                            aria-checked={selected}
                            accessibilityLabel={`Cenário ${s.label}`}
                          >
                            {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={styles.groupTitle}>Nível de água simulado</Text>
                    <View
                      style={styles.chips}
                      accessibilityRole="radiogroup"
                      accessibilityLabel="Nível de água simulado"
                    >
                      {WATER_LEVELS.map((w) => {
                        // Destaque pelo estado confirmado da simulação (telemetria), não pelo toque.
                        const selected = telemetry?.water === w.value;
                        return (
                          <TouchableOpacity
                            key={w.value}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => void runWater(w)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected, checked: selected }}
                            aria-checked={selected}
                            accessibilityLabel={`Nível de água: ${w.label}`}
                          >
                            {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                              {w.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.mockHintText}>
                      Nível atual na simulação:{" "}
                      {telemetry?.water !== undefined ? `${telemetry.water}%` : "aguardando leitura"}
                    </Text>

                    <Text style={styles.groupTitle}>Falha de envio simulada</Text>
                    <Text style={styles.mockHintText}>
                      Para testar mensagens de erro e a parada de emergência com
                      falha parcial.
                    </Text>
                    <View
                      style={styles.chips}
                      accessibilityRole="radiogroup"
                      accessibilityLabel="Falha de envio simulada"
                    >
                      {FAILURES.map((f) => {
                        const selected = simFailure === f.key;
                        return (
                          <TouchableOpacity
                            key={f.key}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => setSimFailure(f.key)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected, checked: selected }}
                            aria-checked={selected}
                            accessibilityLabel={`Falha simulada: ${f.label}`}
                          >
                            {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                              {f.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <FeedbackLine feedback={simFb.feedback} />
                  </>
                )}
              </View>
            )}
          </View>

          {/* ── CONTROLE DE MOVIMENTO ─────────────────────────────── */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Controle de Movimento
          </Text>
          <SliderSetting
            title="Velocidade dos Motores"
            icon="speedometer"
            command="SET_SPEED"
            telemetryKey="speed"
            remoteValue={telemetry?.speed}
            fallback={100}
            min={30}
            max={100}
            step={5}
            unit="%"
            description="Velocidade usada nos comandos de movimento"
            color="#B91C1C"
            disabled={!controlsEnabled}
          />

          {/* ── BOMBA DE ÁGUA ─────────────────────────────────────── */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Bomba de Água
          </Text>
          <SliderSetting
            title="PWM Mínimo"
            icon="water-outline"
            command="SET_PWM_MIN"
            telemetryKey="pwm_min"
            remoteValue={telemetry?.pwm_min}
            fallback={180}
            min={150}
            max={Math.max(150, pwmMaxLocal)}
            step={5}
            description={`Potência inicial da bomba (0–255). Não pode passar do PWM máximo (${pwmMaxLocal}).`}
            color="#1D4ED8"
            disabled={!controlsEnabled}
            onLocalChange={setPwmMinLocal}
          />
          <SliderSetting
            title="PWM Máximo"
            icon="water"
            command="SET_PWM_MAX"
            telemetryKey="pwm_max"
            remoteValue={telemetry?.pwm_max}
            fallback={255}
            min={Math.min(255, Math.max(180, pwmMinLocal))}
            max={255}
            step={5}
            description={`Potência máxima da bomba (0–255). Não pode ficar abaixo do PWM mínimo (${pwmMinLocal}).`}
            color="#1D4ED8"
            disabled={!controlsEnabled}
            onLocalChange={setPwmMaxLocal}
          />

          {/* ── SENSORES DE FOGO ──────────────────────────────────── */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Sensores de Fogo (Avançado)
          </Text>
          <Text style={styles.sectionHint}>
            Intensidade em unidade relativa. Regra: limiar de detecção &lt;
            intensidade de referência &lt; intensidade de perigo.
            {isMockMode
              ? " Na simulação, o Monitor classifica as leituras com os valores aplicados aqui."
              : telemetryParams
                ? " Valores em vigor informados pelo dispositivo."
                : " O dispositivo não informa seus parâmetros: “em vigor” mostra o último valor confirmado ou o padrão do app."}
          </Text>
          <ParamField
            paramKey="thresh"
            command="SET_FIRE_THRESH"
            title="Limiar de Detecção"
            icon="flame-outline"
            help="Intensidade mínima para considerar fogo detectado."
            current={currentParams}
            editable={controlsEnabled}
            onConfirmed={handleParamConfirmed}
            onFieldFocus={handleFieldFocus}
            onFieldBlur={handleFieldBlur}
          />
          <ParamField
            paramKey="ideal"
            command="SET_FIRE_IDEAL"
            title="Intensidade de Referência"
            icon="locate"
            help="Intensidade que marca a faixa de referência para atuação."
            current={currentParams}
            editable={controlsEnabled}
            onConfirmed={handleParamConfirmed}
            onFieldFocus={handleFieldFocus}
            onFieldBlur={handleFieldBlur}
          />
          <ParamField
            paramKey="danger"
            command="SET_FIRE_DANGER"
            title="Intensidade de Perigo"
            icon="warning"
            help="Intensidade a partir da qual a leitura é tratada como perigo."
            current={currentParams}
            editable={controlsEnabled}
            onConfirmed={handleParamConfirmed}
            onFieldFocus={handleFieldFocus}
            onFieldBlur={handleFieldBlur}
          />

          {/* ── INFORMAÇÕES ───────────────────────────────────────── */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Informações
          </Text>

          <View style={styles.card}>
            <TouchableOpacity
              ref={aboutRef}
              style={styles.infoRow}
              onPress={() =>
                setModal({
                  returnFocusRef: aboutRef,
                  title: "Sobre o HydroBot",
                  message:
                    "Versão 1.0.0 — HydroBot Controller.\n\nControle do robô por Bluetooth Low Energy (BLE), com Modo de Simulação para testar a interface sem o robô.",
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Sobre o HydroBot, versão 1.0.0"
            >
              <Ionicons name="information-circle" size={24} color="#B91C1C" />
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>Sobre o HydroBot</Text>
                <Text style={styles.infoValue}>Versão 1.0.0</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <TouchableOpacity
              ref={helpRef}
              style={styles.infoRow}
              onPress={() =>
                setModal({ title: "Ajuda", message: HELP_TEXT, returnFocusRef: helpRef })
              }
              accessibilityRole="button"
              accessibilityLabel="Ajuda"
              accessibilityHint="Explica cada função do aplicativo"
            >
              <Ionicons name="help-circle" size={24} color="#B91C1C" />
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>Ajuda</Text>
                <Text style={styles.infoValue}>Como cada função se comporta</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>HydroBot Controller</Text>
            <Text style={styles.footerSubtext}>
              React Native + {isMockMode ? "Simulação" : "Bluetooth Low Energy (BLE)"}
            </Text>
          </View>
        </View>
      </ScrollView>

      <AppModal
        visible={modal !== null}
        title={modal?.title ?? ""}
        message={modal?.message}
        buttons={modal?.buttons}
        returnFocusRef={modal?.returnFocusRef}
        onRequestClose={() => setModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 12,
    marginLeft: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardMockActive: {
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  mockRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mockIcon: {
    marginRight: 12,
  },
  mockText: {
    flex: 1,
  },
  mockTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  mockSubtitle: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 2,
  },
  mockPanel: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#FCD34D",
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  mockHintText: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
    marginTop: 2,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#B91C1C",
    backgroundColor: "#fff",
  },
  chipSelected: {
    backgroundColor: "#B91C1C",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#B91C1C",
  },
  chipTextSelected: {
    color: "#fff",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    color: "#4B5563",
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  footerSubtext: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 4,
  },
});
