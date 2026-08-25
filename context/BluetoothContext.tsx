import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, DevSettings, PermissionsAndroid, Platform } from "react-native";
import { BleManager, State as BleState, Device } from "react-native-ble-plx";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TelemetryData {
  water: number;
  pump: number;
  intensity: number;
  mode: "AUTO" | "MANUAL";
  fire: boolean;
  speed: number;
  pwm_min: number;
  pwm_max: number;
  sensor_left: number;
  sensor_center: number;
  sensor_right: number;
  delta_left: number;
  delta_center: number;
  delta_right: number;
  base_left: number;
  base_center: number;
  base_right: number;
  calibrated: boolean;
}

interface BluetoothContextType {
  device: Device | null;
  isConnected: boolean;
  telemetry: TelemetryData | null;
  connect: (device: Device) => Promise<void>;
  disconnect: () => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
  isScanning: boolean;
  startScan: () => void;
  stopScan: () => void;
  devices: Device[];
  // Mock mode
  isMockMode: boolean;
  toggleMockMode: () => Promise<void>;
  // Usado em _layout.tsx
  restartApp: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // ESP32 → App
const RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // App → ESP32
const MOCK_MODE_KEY = "@hydrobot_mock_mode";

const MOCK_DEVICE = {
  id: "mock-001",
  name: "HydroBot_MOCK",
} as unknown as Device;

const MOCK_BASE: TelemetryData = {
  water: 75,
  pump: 0,
  intensity: 0,
  mode: "MANUAL",
  fire: false,
  speed: 100,
  pwm_min: 180,
  pwm_max: 255,
  sensor_left: 50,
  sensor_center: 50,
  sensor_right: 50,
  delta_left: 5,
  delta_center: 5,
  delta_right: 5,
  base_left: 200,
  base_center: 200,
  base_right: 200,
  calibrated: true,
};

// bleManager em nível de módulo (padrão do lib)
const bleManager = new BleManager();

// ─── Contexto ─────────────────────────────────────────────────────────────────

const BluetoothContext = createContext<BluetoothContextType | undefined>(
  undefined,
);

export const BluetoothProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [device, setDevice] = useState<Device | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [bleReady, setBleReady] = useState(false); // evita checar BLE antes de saber o modo

  const mockTelRef = useRef<TelemetryData>({ ...MOCK_BASE });
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Carrega preferência salva ─────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(MOCK_MODE_KEY).then((val) => {
      if (val === "true") setIsMockMode(true);
      setBleReady(true); // só inicializa BLE depois de saber o modo
    });
  }, []);

  // ─── Inicializa BLE apenas no modo real ───────────────────────────────────

  useEffect(() => {
    if (!bleReady || isMockMode) return;

    checkBluetoothState();

    const subscription = bleManager.onStateChange((state) => {
      console.log("📶 Bluetooth:", state);
      if (state === BleState.PoweredOff) {
        Alert.alert("Bluetooth Desligado", "O Bluetooth foi desligado");
        setIsConnected(false);
        setDevice(null);
      }
    }, true);

    return () => {
      bleManager.stopDeviceScan();
      subscription.remove();
    };
  }, [bleReady, isMockMode]);

  // ─── Limpa interval ao desmontar ──────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
    };
  }, []);

  // ─── Toggle mock mode ─────────────────────────────────────────────────────

  const toggleMockMode = async () => {
    const next = !isMockMode;

    // Limpa tudo antes de trocar
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
    if (!next && device) {
      try {
        await device.cancelConnection();
      } catch {
        /* ignora */
      }
    }
    setDevice(null);
    setIsConnected(false);
    setTelemetry(null);
    setDevices([]);
    setIsScanning(false);
    setIsMockMode(next);

    await AsyncStorage.setItem(MOCK_MODE_KEY, String(next));

    Alert.alert(
      next ? "🧪 Modo Simulação Ativado" : "📡 Modo Real Ativado",
      next
        ? "Dados simulados — nenhum Arduino necessário."
        : "Usando Bluetooth real.",
    );
  };

  // ─── Restart app ──────────────────────────────────────────────────────────

  const restartApp = () => {
    DevSettings.reload();
  };

  // ─── BLE real: helpers ────────────────────────────────────────────────────

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== "android") return true;
    if (Platform.Version >= 31) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(granted).every((s) => s === "granted");
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === "granted";
  };

  const checkBluetoothState = async (): Promise<boolean> => {
    const state = await bleManager.state();
    if (state !== BleState.PoweredOn) {
      Alert.alert(
        "Bluetooth Desligado",
        "Por favor, ative o Bluetooth para continuar",
        [{ text: "OK" }],
      );
      return false;
    }
    return true;
  };

  const parseTelemetry = (data: string) => {
    try {
      const cleaned = data.replace(/[\r\n]/g, "").trim();
      if (!cleaned.startsWith("{") || !cleaned.endsWith("}")) return;
      const p = JSON.parse(cleaned);
      setTelemetry({
        water: p.water ?? 0,
        pump: p.pump ?? 0,
        intensity: p.intensity ?? 0,
        mode: p.mode ?? "MANUAL",
        fire: p.fire === true || p.fire === "true",
        speed: p.speed ?? 100,
        pwm_min: p.pwm_min ?? 180,
        pwm_max: p.pwm_max ?? 255,
        sensor_left: p.sensor_left ?? 0,
        sensor_center: p.sensor_center ?? 0,
        sensor_right: p.sensor_right ?? 0,
        delta_left: p.delta_left ?? 0,
        delta_center: p.delta_center ?? 0,
        delta_right: p.delta_right ?? 0,
        base_left: p.base_left ?? 0,
        base_center: p.base_center ?? 0,
        base_right: p.base_right ?? 0,
        calibrated: p.calibrated === true || p.calibrated === "true",
      });
    } catch (e) {
      console.log("❌ parseTelemetry:", e);
    }
  };

  // ─── Mock: implementações ─────────────────────────────────────────────────

  const startMockScan = () => {
    setDevices([]);
    setIsScanning(true);
    setTimeout(() => {
      setDevices([MOCK_DEVICE]);
      setIsScanning(false);
    }, 1500);
  };

  const connectMock = async () => {
    mockTelRef.current = { ...MOCK_BASE };
    setTimeout(() => {
      setDevice(MOCK_DEVICE);
      setIsConnected(true);
      setTelemetry({ ...mockTelRef.current });
      Alert.alert("✅ Conectado", "HydroBot_MOCK (simulação)");

      // Telemetria com ruído leve para simular leituras reais
      mockIntervalRef.current = setInterval(() => {
        const t = mockTelRef.current;
        mockTelRef.current = {
          ...t,
          sensor_left: Math.max(0, t.sensor_left + (Math.random() * 10 - 5)),
          sensor_center: Math.max(
            0,
            t.sensor_center + (Math.random() * 10 - 5),
          ),
          sensor_right: Math.max(0, t.sensor_right + (Math.random() * 10 - 5)),
          intensity: Math.floor(Math.random() * (t.fire ? 500 : 80)),
        };
        setTelemetry({ ...mockTelRef.current });
      }, 600);
    }, 800);
  };

  const disconnectMock = async () => {
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
    setDevice(null);
    setIsConnected(false);
    setTelemetry(null);
    Alert.alert("Desconectado", "Simulação encerrada");
  };

  const sendCommandMock = async (command: string) => {
    console.log("[MOCK] >", command);
    const [cmd, val] = command.split(":");
    const num = parseInt(val, 10);

    const update = (patch: Partial<TelemetryData>) => {
      mockTelRef.current = { ...mockTelRef.current, ...patch };
      setTelemetry({ ...mockTelRef.current });
    };

    if (!isNaN(num)) {
      const numMap: Record<string, keyof TelemetryData> = {
        SET_SPEED: "speed",
        SET_PWM_MIN: "pwm_min",
        SET_PWM_MAX: "pwm_max",
        SET_FIRE_THRESH: "sensor_left", // apenas para não ignorar o comando
        SET_FIRE_DANGER: "sensor_center",
        SET_FIRE_IDEAL: "sensor_right",
      };
      if (numMap[cmd]) update({ [numMap[cmd]]: num });
    }

    const boolMap: Record<string, Partial<TelemetryData>> = {
      PUMP_ON: { pump: 1 },
      PUMP_OFF: { pump: 0 },
      AUTO: { mode: "AUTO" },
      MANUAL: { mode: "MANUAL" },
      FIRE_SIM: { fire: true, intensity: 480 }, // simula fogo para testar UI
      FIRE_STOP: { fire: false, intensity: 0 },
    };
    if (boolMap[cmd]) update(boolMap[cmd]);
  };

  // ─── API pública ──────────────────────────────────────────────────────────

  const startScan = async () => {
    if (isMockMode) {
      startMockScan();
      return;
    }

    const ok = await requestPermissions();
    if (!ok) {
      Alert.alert("Erro", "Permissões de Bluetooth negadas");
      return;
    }
    if (!(await checkBluetoothState())) return;

    setDevices([]);
    setIsScanning(true);

    bleManager.startDeviceScan(null, null, (error, dev) => {
      if (error) {
        console.error("❌ Scan:", error);
        setIsScanning(false);
        Alert.alert("Erro", "Falha ao buscar dispositivos: " + error.message);
        return;
      }
      if (dev?.name) {
        setDevices((prev) =>
          prev.find((d) => d.id === dev.id) ? prev : [...prev, dev],
        );
      }
    });

    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  const stopScan = () => {
    if (isMockMode) {
      setIsScanning(false);
      return;
    }
    bleManager.stopDeviceScan();
    setIsScanning(false);
  };

  const connect = async (dev: Device) => {
    if (isMockMode) {
      await connectMock();
      return;
    }

    try {
      console.log("🔗 Conectando:", dev.name, dev.id);
      const connected = await dev.connect({ timeout: 10000, requestMTU: 512 });
      await connected.discoverAllServicesAndCharacteristics();

      // Debug de serviços
      const services = await connected.services();
      for (const svc of services) {
        const chars = await svc.characteristics();
        for (const c of chars) {
          console.log(`  ${c.uuid}`, {
            r: c.isReadable,
            w: c.isWritableWithResponse,
            wn: c.isWritableWithoutResponse,
            n: c.isNotifiable,
          });
        }
      }

      setDevice(connected);
      setIsConnected(true);

      connected.monitorCharacteristicForService(
        SERVICE_UUID,
        TX_CHAR_UUID,
        (err, char) => {
          if (err) {
            console.log("❌ Monitor:", err.message);
            return;
          }
          if (char?.value) {
            try {
              parseTelemetry(
                Buffer.from(char.value, "base64").toString("utf-8"),
              );
            } catch (e) {
              console.log("❌ Decode:", e);
            }
          }
        },
      );

      Alert.alert("✅ Conectado", `Conectado ao ${dev.name || "HydroBot"}`);
      setTimeout(() => sendCommand("GET_STATUS"), 1000);
    } catch (error: any) {
      console.error("❌ connect:", error);
      Alert.alert(
        "Erro",
        "Falha ao conectar: " + (error.message || "Erro desconhecido"),
      );
      setIsConnected(false);
      setDevice(null);
    }
  };

  const disconnect = async () => {
    if (isMockMode) {
      await disconnectMock();
      return;
    }
    if (!device) return;
    try {
      await device.cancelConnection();
      setDevice(null);
      setIsConnected(false);
      setTelemetry(null);
      Alert.alert("Desconectado", "Dispositivo desconectado");
    } catch (e) {
      console.error("❌ disconnect:", e);
    }
  };

  const sendCommand = async (command: string) => {
    if (isMockMode) {
      await sendCommandMock(command);
      return;
    }

    if (!device || !isConnected) {
      Alert.alert("Erro", "Dispositivo não conectado");
      return;
    }

    try {
      const stillOn = await device.isConnected();
      if (!stillOn) {
        setIsConnected(false);
        Alert.alert("Erro", "Dispositivo desconectado");
        return;
      }

      const data = Buffer.from(command + "\n", "utf-8").toString("base64");

      try {
        await device.writeCharacteristicWithoutResponseForService(
          SERVICE_UUID,
          RX_CHAR_UUID,
          data,
        );
        console.log("✅ Enviado (no-resp):", command);
        return;
      } catch {
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          RX_CHAR_UUID,
          data,
        );
        console.log("✅ Enviado (resp):", command);
      }
    } catch (error: any) {
      console.error("❌ sendCommand:", error.message);
      try {
        if (!(await device.isConnected())) {
          setIsConnected(false);
          Alert.alert("Conexão Perdida", "Reconecte e tente novamente.");
          return;
        }
      } catch {
        /* ignora */
      }
      Alert.alert("Erro", "Falha ao enviar comando. Tente reconectar.");
    }
  };

  // ─── Provider ─────────────────────────────────────────────────────────────

  return (
    <BluetoothContext.Provider
      value={{
        device,
        isConnected,
        telemetry,
        connect,
        disconnect,
        sendCommand,
        isScanning,
        startScan,
        stopScan,
        devices,
        isMockMode,
        toggleMockMode,
        restartApp,
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = () => {
  const ctx = useContext(BluetoothContext);
  if (!ctx)
    throw new Error("useBluetooth deve ser usado dentro de BluetoothProvider");
  return ctx;
};
