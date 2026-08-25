import { Buffer } from 'buffer';
import { Device, BleManager, State as BleState, Subscription } from 'react-native-ble-plx';
import {
  HYDROBOT_DEVICE_NAME,
  HYDROBOT_RX_UUID,
  HYDROBOT_SERVICE_UUID,
  HYDROBOT_TX_UUID,
  HydroBotCommand,
  ParsedHydroBotMessage,
  encodeHydroBotCommand,
  parseHydroBotMessage,
} from './hydroBotProtocol';

type ScanHandlers = {
  onDevice: (device: Device) => void;
  onError: (message: string) => void;
  onDone?: () => void;
};

type TelemetryHandler = (messages: ParsedHydroBotMessage[]) => void;
type DisconnectHandler = (errorMessage?: string) => void;

class HydroBotBleService {
  private manager = new BleManager();
  private device: Device | null = null;
  private notifySubscription: Subscription | null = null;
  private disconnectSubscription: Subscription | null = null;
  private telemetryHandlers = new Set<TelemetryHandler>();
  private disconnectHandlers = new Set<DisconnectHandler>();
  private scanTimer: ReturnType<typeof setTimeout> | null = null;

  async state() {
    return this.manager.state();
  }

  onStateChange(callback: (state: BleState) => void) {
    return this.manager.onStateChange(callback, true);
  }

  async ensurePoweredOn() {
    const state = await this.state();
    if (state !== BleState.PoweredOn) {
      throw new Error('Bluetooth desligado. Ative o Bluetooth e tente novamente.');
    }
  }

  scan({ onDevice, onError, onDone }: ScanHandlers, timeoutMs = 10000) {
    this.stopScan();

    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        this.stopScan();
        onError(error.message);
        return;
      }

      if (!device) return;
      const name = device.name ?? device.localName ?? '';
      const serviceUUIDs = device.serviceUUIDs?.map((uuid) => uuid.toLowerCase()) ?? [];
      if (name.includes(HYDROBOT_DEVICE_NAME) || serviceUUIDs.includes(HYDROBOT_SERVICE_UUID)) {
        onDevice(device);
      }
    });

    this.scanTimer = setTimeout(() => {
      this.stopScan();
      onDone?.();
    }, timeoutMs);
  }

  stopScan() {
    this.manager.stopDeviceScan();
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  async connect(device: Device) {
    this.stopScan();
    await this.disconnect(false);

    const connected = await device.connect({ timeout: 12000 });
    await connected.discoverAllServicesAndCharacteristics();

    this.device = connected;
    this.disconnectSubscription = connected.onDisconnected((error) => {
      this.cleanup(false);
      for (const handler of this.disconnectHandlers) {
        handler(error?.message);
      }
    });

    this.notifySubscription = connected.monitorCharacteristicForService(
      HYDROBOT_SERVICE_UUID,
      HYDROBOT_TX_UUID,
      (error, characteristic) => {
        if (error) {
          this.emitTelemetry([{ kind: 'event', raw: error.message, event: 'error' }]);
          return;
        }

        if (!characteristic?.value) return;

        const text = Buffer.from(characteristic.value, 'base64').toString('utf8');
        this.emitTelemetry(parseHydroBotMessage(text));
      },
    );

    return connected;
  }

  async disconnect(sendStop = true) {
    const current = this.device;
    if (!current) {
      this.cleanup(false);
      return;
    }

    if (sendStop) {
      try {
        await this.sendCommand('STOP');
      } catch {
        // Disconnection safety should not be blocked by a failed STOP write.
      }
    }

    try {
      await current.cancelConnection();
    } finally {
      this.cleanup();
    }
  }

  async sendCommand(command: HydroBotCommand) {
    const current = this.device;
    if (!current) {
      throw new Error('HydroBot não conectado.');
    }

    const isConnected = await current.isConnected();
    if (!isConnected) {
      this.cleanup();
      throw new Error('Conexão BLE perdida.');
    }

    const payload = Buffer.from(encodeHydroBotCommand(command), 'utf8').toString('base64');

    try {
      await current.writeCharacteristicWithoutResponseForService(
        HYDROBOT_SERVICE_UUID,
        HYDROBOT_RX_UUID,
        payload,
      );
    } catch {
      await current.writeCharacteristicWithResponseForService(
        HYDROBOT_SERVICE_UUID,
        HYDROBOT_RX_UUID,
        payload,
      );
    }
  }

  requestStatus() {
    return this.sendCommand('GET_STATUS');
  }

  subscribeToTelemetry(handler: TelemetryHandler) {
    this.telemetryHandlers.add(handler);
    return () => this.telemetryHandlers.delete(handler);
  }

  subscribeToDisconnect(handler: DisconnectHandler) {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  destroy() {
    this.stopScan();
    this.cleanup(false);
    this.manager.destroy();
  }

  private emitTelemetry(messages: ParsedHydroBotMessage[]) {
    for (const handler of this.telemetryHandlers) {
      handler(messages);
    }
  }

  private cleanup(removeDisconnectSubscription = true) {
    this.notifySubscription?.remove();
    this.notifySubscription = null;
    if (removeDisconnectSubscription) {
      this.disconnectSubscription?.remove();
    }
    this.disconnectSubscription = null;
    this.device = null;
  }
}

export const hydroBotBleService = new HydroBotBleService();
