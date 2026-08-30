import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useBluetooth } from "../../context/BluetoothContext";

export default function SettingsScreen() {
  const { isConnected, sendCommand, telemetry, isMockMode, toggleMockMode } =
    useBluetooth();

  const [speed, setSpeed] = useState(100);
  const [pwmMin, setPwmMin] = useState(180);
  const [pwmMax, setPwmMax] = useState(255);
  const [fireThresh, setFireThresh] = useState(50);
  const [fireDanger, setFireDanger] = useState(350);
  const [fireIdeal, setFireIdeal] = useState(200);

  useEffect(() => {
    if (telemetry) {
      setSpeed(telemetry.speed);
      setPwmMin(telemetry.pwm_min);
      setPwmMax(telemetry.pwm_max);
    }
  }, [telemetry]);

  const handleSaveSetting = async (
    command: string,
    value: number,
    name: string,
  ) => {
    if (!isConnected && !isMockMode) {
      Alert.alert("Erro", "Conecte-se ao HydroBot primeiro");
      return;
    }
    await sendCommand(`${command}:${value}`);
    Alert.alert("Sucesso", `${name} atualizado para ${value}`);
  };

  const handleToggleMock = () => {
    Alert.alert(
      isMockMode ? "Desativar Simulação?" : "Ativar Simulação?",
      isMockMode
        ? "O app voltará a usar Bluetooth real. A conexão atual será encerrada."
        : "O app usará dados simulados. Nenhum Arduino é necessário.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: toggleMockMode },
      ],
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Connection Status */}
        <View
          style={[
            styles.statusCard,
            !isConnected && styles.statusCardDisconnected,
          ]}
        >
          <Ionicons
            name={isConnected ? "checkmark-circle" : "close-circle"}
            size={24}
            color={isConnected ? "#10B981" : "#EF4444"}
          />
          <Text
            style={[
              styles.statusText,
              !isConnected && styles.statusTextDisconnected,
            ]}
          >
            {isConnected
              ? `HydroBot Conectado${isMockMode ? " (simulação)" : ""}`
              : "Desconectado"}
          </Text>
        </View>

        {/* ── DESENVOLVEDOR ─────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Desenvolvedor</Text>

        <View style={[styles.card, isMockMode && styles.cardMockActive]}>
          <View style={styles.mockRow}>
            <View style={styles.mockIcon}>
              <Ionicons
                name={isMockMode ? "bug" : "bug-outline"}
                size={24}
                color={isMockMode ? "#DC2626" : "#6B7280"}
              />
            </View>
            <View style={styles.mockText}>
              <Text style={styles.settingTitle}>Modo Simulação</Text>
              <Text style={styles.mockSubtitle}>
                {isMockMode
                  ? "🧪 Ativo — dados gerados pelo app"
                  : "📡 Inativo — usando Bluetooth real"}
              </Text>
            </View>
            <Switch
              value={isMockMode}
              onValueChange={handleToggleMock}
              trackColor={{ false: "#D1D5DB", true: "#FCA5A5" }}
              thumbColor={isMockMode ? "#DC2626" : "#9CA3AF"}
            />
          </View>

          {isMockMode && (
            <View style={styles.mockHint}>
              <Text style={styles.mockHintText}>
                Comandos especiais de teste:{"\n"}
                {"  "}• <Text style={styles.mockCode}>FIRE_SIM</Text> — simula
                detecção de fogo{"\n"}
                {"  "}• <Text style={styles.mockCode}>FIRE_STOP</Text> — cancela
                simulação de fogo
              </Text>
              <View style={styles.mockButtons}>
                <TouchableOpacity
                  style={styles.mockBtn}
                  onPress={() => sendCommand("FIRE_SIM")}
                >
                  <Ionicons name="flame" size={16} color="#fff" />
                  <Text style={styles.mockBtnText}>Simular Fogo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mockBtn, styles.mockBtnSecondary]}
                  onPress={() => sendCommand("FIRE_STOP")}
                >
                  <Ionicons name="water" size={16} color="#DC2626" />
                  <Text
                    style={[styles.mockBtnText, styles.mockBtnTextSecondary]}
                  >
                    Parar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── CONTROLE DE MOVIMENTO ─────────────────────────────── */}
        <Text style={styles.sectionTitle}>Controle de Movimento</Text>

        <View style={styles.card}>
          <View style={styles.settingHeader}>
            <Ionicons name="speedometer" size={24} color="#DC2626" />
            <Text style={styles.settingTitle}>Velocidade dos Motores</Text>
          </View>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>{speed}%</Text>
            <Slider
              style={styles.slider}
              minimumValue={30}
              maximumValue={100}
              step={5}
              value={speed}
              onValueChange={setSpeed}
              onSlidingComplete={(value) =>
                handleSaveSetting("SET_SPEED", Math.round(value), "Velocidade")
              }
              minimumTrackTintColor="#DC2626"
              maximumTrackTintColor="#D1D5DB"
              thumbTintColor="#DC2626"
              disabled={!isConnected && !isMockMode}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>30%</Text>
              <Text style={styles.sliderLabel}>100%</Text>
            </View>
          </View>
        </View>

        {/* ── BOMBA DE ÁGUA ─────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Bomba de Água</Text>

        <View style={styles.card}>
          <View style={styles.settingHeader}>
            <Ionicons name="water-outline" size={24} color="#DC2626" />
            <Text style={styles.settingTitle}>PWM Mínimo</Text>
          </View>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>{pwmMin}</Text>
            <Slider
              style={styles.slider}
              minimumValue={150}
              maximumValue={255}
              step={5}
              value={pwmMin}
              onValueChange={setPwmMin}
              onSlidingComplete={(value) =>
                handleSaveSetting(
                  "SET_PWM_MIN",
                  Math.round(value),
                  "PWM Mínimo",
                )
              }
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#D1D5DB"
              thumbTintColor="#3B82F6"
              disabled={!isConnected && !isMockMode}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>150</Text>
              <Text style={styles.sliderLabel}>255</Text>
            </View>
            <Text style={styles.sliderDescription}>
              Potência inicial da bomba
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.settingHeader}>
            <Ionicons name="water" size={24} color="#DC2626" />
            <Text style={styles.settingTitle}>PWM Máximo</Text>
          </View>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>{pwmMax}</Text>
            <Slider
              style={styles.slider}
              minimumValue={180}
              maximumValue={255}
              step={5}
              value={pwmMax}
              onValueChange={setPwmMax}
              onSlidingComplete={(value) =>
                handleSaveSetting(
                  "SET_PWM_MAX",
                  Math.round(value),
                  "PWM Máximo",
                )
              }
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#D1D5DB"
              thumbTintColor="#3B82F6"
              disabled={!isConnected && !isMockMode}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>180</Text>
              <Text style={styles.sliderLabel}>255</Text>
            </View>
            <Text style={styles.sliderDescription}>
              Potência máxima da bomba
            </Text>
          </View>
        </View>

        {/* ── SENSORES DE FOGO ──────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Sensores de Fogo (Avançado)</Text>

        <View style={styles.card}>
          <View style={styles.settingHeader}>
            <Ionicons name="flame-outline" size={24} color="#DC2626" />
            <Text style={styles.settingTitle}>Limiar de Detecção</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={fireThresh.toString()}
              onChangeText={(text) => setFireThresh(parseInt(text) || 50)}
              keyboardType="numeric"
              editable={isConnected || isMockMode}
            />
            <TouchableOpacity
              style={[
                styles.applyButton,
                !isConnected && !isMockMode && styles.applyButtonDisabled,
              ]}
              onPress={() =>
                handleSaveSetting(
                  "SET_FIRE_THRESH",
                  fireThresh,
                  "Limiar de Detecção",
                )
              }
              disabled={!isConnected && !isMockMode}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inputDescription}>
            Sensibilidade para detectar fogo (20–200)
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.settingHeader}>
            <Ionicons name="warning" size={24} color="#DC2626" />
            <Text style={styles.settingTitle}>Intensidade de Perigo</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={fireDanger.toString()}
              onChangeText={(text) => setFireDanger(parseInt(text) || 350)}
              keyboardType="numeric"
              editable={isConnected || isMockMode}
            />
            <TouchableOpacity
              style={[
                styles.applyButton,
                !isConnected && !isMockMode && styles.applyButtonDisabled,
              ]}
              onPress={() =>
                handleSaveSetting(
                  "SET_FIRE_DANGER",
                  fireDanger,
                  "Intensidade de Perigo",
                )
              }
              disabled={!isConnected && !isMockMode}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inputDescription}>Quando recuar (200–600)</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.settingHeader}>
            <Ionicons name="locate" size={24} color="#DC2626" />
            <Text style={styles.settingTitle}>Distância Ideal</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={fireIdeal.toString()}
              onChangeText={(text) => setFireIdeal(parseInt(text) || 200)}
              keyboardType="numeric"
              editable={isConnected || isMockMode}
            />
            <TouchableOpacity
              style={[
                styles.applyButton,
                !isConnected && !isMockMode && styles.applyButtonDisabled,
              ]}
              onPress={() =>
                handleSaveSetting(
                  "SET_FIRE_IDEAL",
                  fireIdeal,
                  "Distância Ideal",
                )
              }
              disabled={!isConnected && !isMockMode}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inputDescription}>
            Distância ideal para combater (100–400)
          </Text>
        </View>

        {/* ── INFORMAÇÕES ───────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Informações</Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() =>
              Alert.alert(
                "Sobre o HydroBot",
                "HydroBot Arduino Controller\nVersão 1.0.0",
              )
            }
          >
            <Ionicons name="information-circle" size={24} color="#DC2626" />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Sobre o HydroBot</Text>
              <Text style={styles.infoValue}>Versão 1.0.0</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() =>
              Alert.alert(
                "Ajuda",
                "Comandos disponíveis:\n\n" +
                  "• Modo Manual: Controle direto do robô\n" +
                  "• Modo Auto: Robô busca fogo automaticamente\n" +
                  "• Calibrar: Ajusta sensores de fogo\n" +
                  "• Parada de Emergência: Para tudo imediatamente",
              )
            }
          >
            <Ionicons name="help-circle" size={24} color="#DC2626" />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Ajuda</Text>
              <Text style={styles.infoValue}>Toque para ver comandos</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>HydroBot Arduino Controller</Text>
          <Text style={styles.footerSubtext}>
            React Native + {isMockMode ? "Simulação 🧪" : "Bluetooth HC-05/06"}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 16,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusCardDisconnected: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#065F46",
  },
  statusTextDisconnected: {
    color: "#991B1B",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
    marginLeft: 4,
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
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  // Mock mode
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
  mockSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  mockHint: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#FCA5A5",
  },
  mockHintText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
  },
  mockCode: {
    fontFamily: "monospace",
    color: "#DC2626",
    fontWeight: "600",
  },
  mockButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  mockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mockBtnSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#DC2626",
  },
  mockBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  mockBtnTextSecondary: {
    color: "#DC2626",
  },
  // Existentes
  settingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 12,
  },
  sliderContainer: {
    paddingHorizontal: 8,
  },
  sliderValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#DC2626",
    textAlign: "center",
    marginBottom: 8,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -8,
  },
  sliderLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  sliderDescription: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#fff",
  },
  applyButton: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  inputDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
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
    color: "#6B7280",
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  footerSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
});
