// Transporte Bluetooth Low Energy (BLE) para Android/iOS.
// A versão web fica em bleTransport.web.ts e não importa o módulo nativo.

import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State as BleState, type Subscription } from 'react-native-ble-plx';
import {
  HYDROBOT_RX_UUID,
  HYDROBOT_SERVICE_UUID,
  HYDROBOT_TX_UUID,
  encodeHydroBotCommand,
  type HydroBotCommand,
} from './hydroBotProtocol';

export interface BleDeviceInfo {
  id: string;
  name: string | null;
}

export interface BleConnection {
  id: string;
  name: string | null;
  write: (command: string) => Promise<void>;
  isConnected: () => Promise<boolean>;
  close: () => Promise<void>;
}

export interface BleConnectHandlers {
  onText: (text: string) => void;
  onDisconnected: (message?: string) => void;
}

export const bleAvailable = true;

let manager: BleManager | null = null;

// Criado apenas na primeira utilização real do BLE, nunca no carregamento do módulo.
function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(granted).every((s) => s === 'granted');
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return granted === 'granted';
}

export async function isBlePoweredOn(): Promise<boolean> {
  return (await getManager().state()) === BleState.PoweredOn;
}

/** Chama `onPoweredOff` quando o Bluetooth é desligado. Retorna a função de remoção. */
export function watchBlePower(onPoweredOff: () => void): () => void {
  const sub = getManager().onStateChange((state) => {
    if (state === BleState.PoweredOff) onPoweredOff();
  }, true);
  return () => sub.remove();
}

export function startBleScan(
  onDevice: (device: BleDeviceInfo) => void,
  onError: (message: string) => void,
): void {
  getManager().startDeviceScan(null, null, (error, dev) => {
    if (error) {
      onError(error.message);
      return;
    }
    const name = dev?.name ?? dev?.localName ?? null;
    if (dev && name) onDevice({ id: dev.id, name });
  });
}

export function stopBleScan(): void {
  manager?.stopDeviceScan();
}

export async function connectBle(
  id: string,
  { onText, onDisconnected }: BleConnectHandlers,
): Promise<BleConnection> {
  const mgr = getManager();
  const device = await mgr.connectToDevice(id, { timeout: 10000, requestMTU: 512 });
  await device.discoverAllServicesAndCharacteristics();

  let closedByApp = false;
  const subs: Subscription[] = [];

  subs.push(
    device.monitorCharacteristicForService(HYDROBOT_SERVICE_UUID, HYDROBOT_TX_UUID, (err, char) => {
      if (err) {
        console.log('❌ Monitor:', err.message);
        return;
      }
      if (char?.value) onText(Buffer.from(char.value, 'base64').toString('utf-8'));
    }),
  );

  subs.push(
    mgr.onDeviceDisconnected(id, (err) => {
      subs.forEach((s) => s.remove());
      if (!closedByApp) onDisconnected(err?.message);
    }),
  );

  return {
    id: device.id,
    name: device.name ?? device.localName ?? null,
    write: async (command: string) => {
      const data = Buffer.from(
        encodeHydroBotCommand(command as HydroBotCommand),
        'utf-8',
      ).toString('base64');
      try {
        await device.writeCharacteristicWithoutResponseForService(
          HYDROBOT_SERVICE_UUID,
          HYDROBOT_RX_UUID,
          data,
        );
      } catch {
        await device.writeCharacteristicWithResponseForService(
          HYDROBOT_SERVICE_UUID,
          HYDROBOT_RX_UUID,
          data,
        );
      }
    },
    isConnected: () => device.isConnected(),
    close: async () => {
      closedByApp = true;
      subs.forEach((s) => s.remove());
      try {
        await device.cancelConnection();
      } catch {
        // já desconectado
      }
    },
  };
}
