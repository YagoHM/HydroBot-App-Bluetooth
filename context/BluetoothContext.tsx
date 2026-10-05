import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo } from "react-native";
import * as ble from "../services/bleTransport";
import {
  parseHydroBotMessage,
  type HydroBotTelemetry,
} from "../services/hydroBotProtocol";
import {
  createSimState,
  simApplyCommand,
  simTelemetry,
  simTick,
  type SimState,
} from "../services/simulator";
import {
  LOW_WATER_PUMP_BLOCK,
  type DataSource,
  type Telemetry,
} from "../services/telemetry";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface DeviceInfo {
  id: string;
  name: string | null;
  simulated: boolean;
}

/**
 * Resultado de um comando, sem exagerar o que se sabe:
 * - "applied-sim": a simulação aplicou o comando;
 * - "sent": a escrita BLE terminou, mas o dispositivo ainda não confirmou;
 * - "failed": o comando não foi aplicado/enviado.
 */
export type CommandOutcome =
  | { ok: true; status: "applied-sim" | "sent"; command: string }
  | { ok: false; status: "failed"; command: string; error: string };

export interface EmergencyStep {
  command: string;
  label: string;
  outcome: CommandOutcome;
}

export interface EmergencyReport {
  at: number;
  source: DataSource;
  steps: EmergencyStep[];
}

export interface Notice {
  title: string;
  message: string;
}

/** Falha injetada na simulação para testar mensagens de erro. */
export type SimFailure = "none" | "pump" | "all";

export interface ConfirmOptions {
  /** Considera confirmado quando uma nova telemetria satisfaz a condição. */
  check?: (t: Telemetry) => boolean;
  /** Ou quando o dispositivo responde com este prefixo (ex.: "FIRE_THRESH_SET:"). */
  ackPrefix?: string;
  ackValue?: string;
  timeoutMs?: number;
}

type DeviceEvent =
  | { type: "telemetry"; telemetry: Telemetry }
  | { type: "line"; raw: string };

interface BluetoothContextType {
  isMockMode: boolean;
  /** false na versão web: só há simulação. */
  bleAvailable: boolean;
  connectionState: ConnectionState;
  isConnected: boolean;
  device: DeviceInfo | null;
  devices: DeviceInfo[];
  isScanning: boolean;
  startScan: () => Promise<void>;
  stopScan: () => void;
  connect: (device: DeviceInfo) => Promise<void>;
  disconnect: () => Promise<void>;
  /** null enquanto não há leitura válida da sessão atual. */
  telemetry: Telemetry | null;
  sendCommand: (command: string) => Promise<CommandOutcome>;
  waitForConfirmation: (options: ConfirmOptions) => Promise<boolean>;
  emergencyStop: () => Promise<EmergencyReport>;
  lastEmergency: EmergencyReport | null;
  dismissEmergency: () => void;
  toggleMockMode: () => Promise<boolean>;
  restartApp: () => Promise<void>;
  notice: Notice | null;
  clearNotice: () => void;
  simFailure: SimFailure;
  setSimFailure: (f: SimFailure) => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MOCK_MODE_KEY = "@hydrobot_mock_mode";
const SIM_TICK_MS = 600;
const SIM_SEED = 1;

export const SIM_DEVICE: DeviceInfo = {
  id: "sim-001",
  name: "HydroBot simulado",
  simulated: true,
};

const EMERGENCY_STEPS: [string, string][] = [
  ["STOP", "Parar movimento"],
  ["PUMP_OFF", "Desligar bomba"],
  ["MODE_MANUAL", "Sair do modo automático"],
];

export function announce(message: string) {
  try {
    AccessibilityInfo.announceForAccessibility?.(message);
  } catch {
    // leitor de tela indisponível nesta plataforma
  }
}

const failed = (command: string, error: string): CommandOutcome => ({
  ok: false,
  status: "failed",
  command,
  error,
});

// ─── Contexto ─────────────────────────────────────────────────────────────────

const BluetoothContext = createContext<BluetoothContextType | undefined>(
  undefined,
);

export const BluetoothProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isMockMode, setIsMockMode] = useState(true);
  const [modeLoaded, setModeLoaded] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lastEmergency, setLastEmergency] = useState<EmergencyReport | null>(
    null,
  );
  const [simFailure, setSimFailureState] = useState<SimFailure>("none");

  // Cada sessão (modo + conexão) tem uma geração. Callbacks de sessões
  // anteriores (temporizadores, notificações BLE) comparam a geração e são
  // descartados, para que dados de um modo nunca apareçam no outro.
  const genRef = useRef(0);
  const isMockRef = useRef(true);
  const connectionRef = useRef<ConnectionState>("disconnected");
  const simRef = useRef<SimState>(createSimState(SIM_SEED));
  const simFailureRef = useRef<SimFailure>("none");
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const bleConnRef = useRef<ble.BleConnection | null>(null);
  const bleRecordRef = useRef<Partial<HydroBotTelemetry>>({});
  const lineBufferRef = useRef("");
  const listenersRef = useRef(new Set<(e: DeviceEvent) => void>());

  const updateConnection = useCallback((s: ConnectionState) => {
    connectionRef.current = s;
    setConnectionState(s);
  }, []);

  const later = useCallback((gen: number, ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      if (gen === genRef.current) fn();
    }, ms);
    timersRef.current.add(id);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  const publish = useCallback((t: Telemetry) => {
    setTelemetry(t);
    listenersRef.current.forEach((l) => l({ type: "telemetry", telemetry: t }));
  }, []);

  /** Encerra a sessão atual de forma síncrona e devolve a conexão BLE a fechar. */
  const invalidateSession = useCallback(() => {
    genRef.current += 1;
    clearTimers();
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    ble.stopBleScan();
    const conn = bleConnRef.current;
    bleConnRef.current = null;
    bleRecordRef.current = {};
    lineBufferRef.current = "";
    setDevice(null);
    updateConnection("disconnected");
    setTelemetry(null);
    setDevices([]);
    setIsScanning(false);
    setLastEmergency(null);
    return conn;
  }, [clearTimers, updateConnection]);

  const teardown = useCallback(async () => {
    const conn = invalidateSession();
    if (conn) await conn.close();
  }, [invalidateSession]);

  const handleConnectionLost = useCallback(
    (detail?: string) => {
      invalidateSession();
      setNotice({
        title: "Conexão perdida",
        message:
          "A conexão com o HydroBot foi perdida e os dados exibidos foram descartados." +
          (detail ? ` Detalhe: ${detail}.` : "") +
          " Volte à aba Conexão, busque e conecte novamente.",
      });
      announce("Conexão com o HydroBot perdida");
    },
    [invalidateSession],
  );

  // ─── Carrega preferência salva ─────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(MOCK_MODE_KEY)
      .catch(() => null)
      .then((val) => {
        // padrão é simulação; na web não existe outra opção
        const mock = !ble.bleAvailable || val !== "false";
        isMockRef.current = mock;
        setIsMockMode(mock);
        setModeLoaded(true);
      });
  }, []);

  // ─── Estado do Bluetooth (apenas no modo BLE) ─────────────────────────────

  useEffect(() => {
    if (!modeLoaded || isMockMode || !ble.bleAvailable) return;
    return ble.watchBlePower(() => {
      const hadConnection = bleConnRef.current !== null;
      void teardown();
      setNotice({
        title: "Bluetooth desligado",
        message: hadConnection
          ? "O Bluetooth foi desligado e a conexão com o HydroBot foi encerrada. Ative o Bluetooth e conecte novamente."
          : "Ative o Bluetooth do celular para buscar o HydroBot.",
      });
    });
  }, [modeLoaded, isMockMode, teardown]);

  // ─── Limpeza ao desmontar ─────────────────────────────────────────────────

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      genRef.current += 1;
      timers.forEach(clearTimeout);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      ble.stopBleScan();
      void bleConnRef.current?.close();
    };
  }, []);

  // ─── Anúncios para leitor de tela (somente mudanças relevantes) ──────────

  const prevAnnouncedRef = useRef<{
    mode?: string;
    fire?: boolean;
    lowWater?: boolean;
  }>({});
  useEffect(() => {
    if (!telemetry) {
      prevAnnouncedRef.current = {};
      return;
    }
    const prev = prevAnnouncedRef.current;
    const sim = telemetry.source === "sim";
    const lowWater =
      telemetry.water !== undefined
        ? telemetry.water <= LOW_WATER_PUMP_BLOCK
        : undefined;
    if (prev.mode && telemetry.mode && prev.mode !== telemetry.mode) {
      announce(
        telemetry.mode === "AUTO" ? "Modo automático ativo" : "Modo manual ativo",
      );
    }
    if (prev.fire !== undefined && telemetry.fire !== undefined && prev.fire !== telemetry.fire) {
      announce(
        telemetry.fire
          ? sim
            ? "Alerta: fogo simulado detectado"
            : "Alerta: fogo detectado"
          : "Fogo não detectado",
      );
    }
    if (prev.lowWater === false && lowWater === true) {
      announce("Alerta: nível de água baixo");
    }
    prevAnnouncedRef.current = { mode: telemetry.mode, fire: telemetry.fire, lowWater };
  }, [telemetry]);

  // ─── Dados recebidos por BLE ──────────────────────────────────────────────

  const handleBleText = useCallback(
    (gen: number, text: string) => {
      if (gen !== genRef.current) return;
      const lines = (lineBufferRef.current + text).split(/\r?\n/);
      let rest = lines.pop() ?? "";
      const trimmedRest = rest.trim();
      // Mensagem completa sem quebra de linha final (um JSON inteiro ou um evento simples)
      if (
        trimmedRest &&
        ((trimmedRest.startsWith("{") && trimmedRest.endsWith("}")) ||
          !trimmedRest.includes("{"))
      ) {
        lines.push(rest);
        rest = "";
      }
      lineBufferRef.current = rest;

      for (const msg of parseHydroBotMessage(lines.join("\n"))) {
        if (msg.kind === "telemetry") {
          bleRecordRef.current = { ...bleRecordRef.current, ...msg.telemetry };
          publish({ ...bleRecordRef.current, source: "ble", receivedAt: Date.now() });
        } else {
          listenersRef.current.forEach((l) => l({ type: "line", raw: msg.raw }));
        }
      }
    },
    [publish],
  );

  // ─── Comandos ─────────────────────────────────────────────────────────────

  const sendCommand = useCallback(
    async (command: string): Promise<CommandOutcome> => {
      if (isMockRef.current) {
        if (connectionRef.current !== "connected") {
          return failed(
            command,
            "Não conectado ao dispositivo simulado. Conecte-se na aba Conexão.",
          );
        }
        const injected = simFailureRef.current;
        if (injected === "all" || (injected === "pump" && command.startsWith("PUMP"))) {
          return failed(command, "Falha de envio simulada (ativada em Configurações).");
        }
        const r = simApplyCommand(simRef.current, command);
        if (!r.ok) return failed(command, r.error);
        simRef.current = r.state;
        publish(simTelemetry(r.state, Date.now()));
        return { ok: true, status: "applied-sim", command };
      }

      const conn = bleConnRef.current;
      if (!conn || connectionRef.current !== "connected") {
        return failed(command, "Dispositivo não conectado. Conecte-se na aba Conexão.");
      }
      try {
        await conn.write(command);
        return { ok: true, status: "sent", command };
      } catch (error: any) {
        let stillConnected = false;
        try {
          stillConnected = await conn.isConnected();
        } catch {
          stillConnected = false;
        }
        if (!stillConnected && bleConnRef.current === conn) {
          handleConnectionLost();
          return failed(command, "A conexão foi perdida durante o envio.");
        }
        return failed(
          command,
          `Falha ao enviar (${error?.message ?? "erro desconhecido"}). Tente novamente.`,
        );
      }
    },
    [publish, handleConnectionLost],
  );

  const waitForConfirmation = useCallback(
    ({ check, ackPrefix, ackValue, timeoutMs = 3000 }: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        const gen = genRef.current;
        let done = false;
        const listener = (e: DeviceEvent) => {
          if (gen !== genRef.current) return finish(false);
          if (e.type === "telemetry" && check?.(e.telemetry)) finish(true);
          if (
            e.type === "line" &&
            ackPrefix &&
            e.raw.startsWith(ackPrefix) &&
            (ackValue === undefined || e.raw.slice(ackPrefix.length).trim() === ackValue)
          ) {
            finish(true);
          }
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        function finish(value: boolean) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          listenersRef.current.delete(listener);
          resolve(value);
        }
        listenersRef.current.add(listener);
      }),
    [],
  );

  const emergencyStop = useCallback(async (): Promise<EmergencyReport> => {
    const source: DataSource = isMockRef.current ? "sim" : "ble";
    const steps: EmergencyStep[] = [];
    // Cada comando é tentado mesmo que o anterior falhe.
    for (const [command, label] of EMERGENCY_STEPS) {
      steps.push({ command, label, outcome: await sendCommand(command) });
    }
    const report: EmergencyReport = { at: Date.now(), source, steps };
    setLastEmergency(report);
    const failures = steps.filter((s) => !s.outcome.ok).length;
    announce(
      failures === 0
        ? source === "sim"
          ? "Parada de emergência aplicada na simulação"
          : "Parada de emergência enviada. Aguarde a confirmação do robô."
        : `Parada de emergência com ${failures} falha${failures > 1 ? "s" : ""}. Verifique o robô.`,
    );
    return report;
  }, [sendCommand]);

  const dismissEmergency = useCallback(() => setLastEmergency(null), []);

  // ─── Busca e conexão ──────────────────────────────────────────────────────

  const stopScan = useCallback(() => {
    clearTimers();
    ble.stopBleScan();
    setIsScanning(false);
  }, [clearTimers]);

  const startScan = useCallback(async () => {
    const gen = genRef.current;
    setDevices([]);

    if (isMockRef.current) {
      setIsScanning(true);
      later(gen, 1500, () => {
        setDevices([SIM_DEVICE]);
        setIsScanning(false);
      });
      return;
    }

    if (!ble.bleAvailable) {
      setNotice({
        title: "Bluetooth indisponível",
        message: "A conexão física não está disponível nesta versão. Use o Modo de Simulação.",
      });
      return;
    }
    const allowed = await ble.requestBlePermissions();
    if (gen !== genRef.current) return;
    if (!allowed) {
      setNotice({
        title: "Permissão necessária",
        message:
          "Permita o acesso ao Bluetooth e à localização nas configurações do Android e toque em Buscar novamente.",
      });
      return;
    }
    if (!(await ble.isBlePoweredOn())) {
      setNotice({
        title: "Bluetooth desligado",
        message: "Ative o Bluetooth do celular e toque em Buscar novamente.",
      });
      return;
    }
    if (gen !== genRef.current) return;

    setIsScanning(true);
    ble.startBleScan(
      (found) => {
        if (gen !== genRef.current) return;
        setDevices((prev) =>
          prev.some((d) => d.id === found.id)
            ? prev
            : [...prev, { ...found, simulated: false }],
        );
      },
      (message) => {
        if (gen !== genRef.current) return;
        ble.stopBleScan();
        setIsScanning(false);
        setNotice({
          title: "Falha na busca",
          message: `Não foi possível buscar dispositivos (${message}). Verifique o Bluetooth e tente novamente.`,
        });
      },
    );
    later(gen, 10000, () => {
      ble.stopBleScan();
      setIsScanning(false);
    });
  }, [later]);

  const connect = useCallback(
    async (target: DeviceInfo) => {
      if (connectionRef.current !== "disconnected") return;
      stopScan();
      const gen = genRef.current;
      updateConnection("connecting");

      if (isMockRef.current) {
        later(gen, 800, () => {
          simRef.current = createSimState(SIM_SEED);
          setDevice(SIM_DEVICE);
          setLastEmergency(null);
          updateConnection("connected");
          announce("Conectado ao dispositivo simulado");
          // A primeira leitura chega no primeiro ciclo; até lá a interface mostra "Aguardando dados".
          simIntervalRef.current = setInterval(() => {
            if (gen !== genRef.current) return;
            simRef.current = simTick(simRef.current);
            publish(simTelemetry(simRef.current, Date.now()));
          }, SIM_TICK_MS);
        });
        return;
      }

      try {
        const conn = await ble.connectBle(target.id, {
          onText: (text) => handleBleText(gen, text),
          onDisconnected: (detail) => {
            if (gen === genRef.current) handleConnectionLost(detail);
          },
        });
        if (gen !== genRef.current) {
          // O modo mudou durante a conexão: não manter conexão física por engano.
          await conn.close();
          return;
        }
        bleConnRef.current = conn;
        bleRecordRef.current = {};
        const name = conn.name ?? target.name;
        setDevice({ id: conn.id, name, simulated: false });
        setLastEmergency(null);
        updateConnection("connected");
        announce(`Conectado por Bluetooth BLE a ${name ?? "dispositivo"}`);
        later(gen, 1000, () => {
          void sendCommand("GET_STATUS");
        });
      } catch (error: any) {
        if (gen !== genRef.current) return;
        updateConnection("disconnected");
        setNotice({
          title: "Falha ao conectar",
          message: `Não foi possível conectar a ${target.name ?? "este dispositivo"} (${error?.message ?? "erro desconhecido"}). Aproxime o celular do HydroBot, confirme que ele está ligado e tente novamente.`,
        });
      }
    },
    [stopScan, updateConnection, later, publish, handleBleText, handleConnectionLost, sendCommand],
  );

  const disconnect = useCallback(async () => {
    await teardown();
    announce("Desconectado");
  }, [teardown]);

  // Com a simulação ativa, o dispositivo simulado é conectado automaticamente
  // (preserva a correção I3: Monitor com dados simulados logo após ativar).
  // O usuário ainda pode desconectar e reconectar pela aba Conexão.
  useEffect(() => {
    if (modeLoaded && isMockRef.current) void connect(SIM_DEVICE);
  }, [modeLoaded, connect]);

  // ─── Troca de modo ────────────────────────────────────────────────────────

  const setSimFailure = useCallback((f: SimFailure) => {
    simFailureRef.current = f;
    setSimFailureState(f);
  }, []);

  const toggleMockMode = useCallback(async (): Promise<boolean> => {
    const next = !isMockRef.current;
    if (!next && !ble.bleAvailable) {
      setNotice({
        title: "Bluetooth indisponível",
        message: "Na versão web só é possível usar o Modo de Simulação.",
      });
      return false;
    }
    // Encerra busca, conexão (física ou simulada), temporizadores e dados do modo anterior.
    await teardown();
    simRef.current = createSimState(SIM_SEED);
    setSimFailure("none");
    isMockRef.current = next;
    setIsMockMode(next);
    try {
      await AsyncStorage.setItem(MOCK_MODE_KEY, String(next));
    } catch {
      // preferência não salva; o modo atual continua valendo nesta sessão
    }
    announce(next ? "Modo de Simulação ativado" : "Modo Bluetooth BLE ativado");
    if (next) void connect(SIM_DEVICE);
    return true;
  }, [teardown, setSimFailure, connect]);

  const restartApp = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      // fallback: reinicia a sessão sem fechar o app
      await teardown();
    }
  }, [teardown]);

  const clearNotice = useCallback(() => setNotice(null), []);

  // ─── Provider ─────────────────────────────────────────────────────────────

  return (
    <BluetoothContext.Provider
      value={{
        isMockMode,
        bleAvailable: ble.bleAvailable,
        connectionState,
        isConnected: connectionState === "connected",
        device,
        devices,
        isScanning,
        startScan,
        stopScan,
        connect,
        disconnect,
        telemetry,
        sendCommand,
        waitForConfirmation,
        emergencyStop,
        lastEmergency,
        dismissEmergency,
        toggleMockMode,
        restartApp,
        notice,
        clearNotice,
        simFailure,
        setSimFailure,
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
