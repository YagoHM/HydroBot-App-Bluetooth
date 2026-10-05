// Versão web: não há acesso ao Bluetooth do robô. Nenhum módulo BLE nativo é
// importado aqui; o app funciona apenas no Modo de Simulação.

import type { BleConnectHandlers, BleConnection, BleDeviceInfo } from './bleTransport';

export type { BleConnectHandlers, BleConnection, BleDeviceInfo };

export const bleAvailable = false;

const UNAVAILABLE = 'Conexão física indisponível na versão web. Use o Modo de Simulação.';

export async function requestBlePermissions(): Promise<boolean> {
  return false;
}

export async function isBlePoweredOn(): Promise<boolean> {
  return false;
}

export function watchBlePower(_onPoweredOff: () => void): () => void {
  return () => {};
}

export function startBleScan(
  _onDevice: (device: BleDeviceInfo) => void,
  onError: (message: string) => void,
): void {
  onError(UNAVAILABLE);
}

export function stopBleScan(): void {}

export async function connectBle(_id: string, _handlers: BleConnectHandlers): Promise<BleConnection> {
  throw new Error(UNAVAILABLE);
}
