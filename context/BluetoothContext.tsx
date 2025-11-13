import { Buffer } from 'buffer';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State as BleState, Device } from 'react-native-ble-plx';

interface TelemetryData {
  water: number;
  pump: number;
  intensity: number;
  mode: 'AUTO' | 'MANUAL';
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
}

const BluetoothContext = createContext<BluetoothContextType | undefined>(undefined);

const bleManager = new BleManager();

// UUIDs do ESP32 HydroBot (NimBLE usa minúsculas)
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // ESP32 -> App
const RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // App -> ESP32

export const BluetoothProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [device, setDevice] = useState<Device | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Solicitar permissões Android
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(granted).every(status => status === 'granted');
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === 'granted';
      }
    }
    return true;
  };

  // Verificar estado do Bluetooth
  const checkBluetoothState = async () => {
    const state = await bleManager.state();
    console.log('📶 Estado do Bluetooth:', state);
    
    if (state !== BleState.PoweredOn) {
      Alert.alert(
        'Bluetooth Desligado',
        'Por favor, ative o Bluetooth para continuar',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const parseTelemetry = (data: string) => {
    try {
      const cleaned = data.replace(/[\r\n]/g, '').trim();
      console.log('🔍 Parseando:', cleaned);
      
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        const parsed = JSON.parse(cleaned);
        console.log('✅ Telemetria parseada:', parsed);
        
        setTelemetry({
          water: parsed.water || 0,
          pump: parsed.pump || 0,
          intensity: parsed.intensity || 0,
          mode: parsed.mode || 'MANUAL',
          fire: parsed.fire === true || parsed.fire === 'true',
          speed: parsed.speed || 100,
          pwm_min: parsed.pwm_min || 180,
          pwm_max: parsed.pwm_max || 255,
          sensor_left: parsed.sensor_left || 0,
          sensor_center: parsed.sensor_center || 0,
          sensor_right: parsed.sensor_right || 0,
          delta_left: parsed.delta_left || 0,
          delta_center: parsed.delta_center || 0,
          delta_right: parsed.delta_right || 0,
          base_left: parsed.base_left || 0,
          base_center: parsed.base_center || 0,
          base_right: parsed.base_right || 0,
          calibrated: parsed.calibrated === true || parsed.calibrated === 'true',
        });
      }
    } catch (error) {
      console.log('❌ Erro ao parsear telemetria:', error);
    }
  };

  const startScan = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Erro', 'Permissões de Bluetooth negadas');
      return;
    }

    const isBluetoothOn = await checkBluetoothState();
    if (!isBluetoothOn) return;

    setDevices([]);
    setIsScanning(true);

    console.log('🔍 Iniciando scan BLE...');

    bleManager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        console.error('❌ Erro no scan:', error);
        setIsScanning(false);
        Alert.alert('Erro', 'Falha ao buscar dispositivos: ' + error.message);
        return;
      }

      if (scannedDevice && scannedDevice.name) {
        console.log('📱 Dispositivo encontrado:', scannedDevice.name, '| ID:', scannedDevice.id);
        
        setDevices((prev) => {
          const exists = prev.find((d) => d.id === scannedDevice.id);
          if (!exists) {
            return [...prev, scannedDevice];
          }
          return prev;
        });
      }
    });

    setTimeout(() => {
      console.log('⏰ Timeout do scan - parando...');
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
  };

  const connect = async (dev: Device) => {
    try {
      console.log('🔗 Conectando ao dispositivo:', dev.name, '(', dev.id, ')');
      
      const connected = await dev.connect({ 
        timeout: 10000,
        requestMTU: 512 
      });
      console.log('✅ Conectado! Descobrindo serviços...');
      
      await connected.discoverAllServicesAndCharacteristics();
      console.log('✅ Serviços descobertos');
      
      // Debug: listar serviços
      const services = await connected.services();
      console.log('📋 Serviços disponíveis:');
      for (const service of services) {
        console.log('   -', service.uuid);
        const chars = await service.characteristics();
        for (const char of chars) {
          console.log('      >', char.uuid, '| Props:', {
            read: char.isReadable,
            write: char.isWritableWithResponse,
            writeNoResp: char.isWritableWithoutResponse,
            notify: char.isNotifiable
          });
        }
      }
      
      setDevice(connected);
      setIsConnected(true);

      // Monitorar característica TX
      console.log('📡 Iniciando monitor de telemetria...');
      
      connected.monitorCharacteristicForService(
        SERVICE_UUID,
        TX_CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            console.log('❌ Erro no monitor:', error.message);
            return;
          }
          
          if (characteristic?.value) {
            try {
              const data = Buffer.from(characteristic.value, 'base64').toString('utf-8');
              console.log('📊 Dados recebidos:', data.substring(0, 100));
              parseTelemetry(data);
            } catch (e) {
              console.log('❌ Erro ao decodificar dados:', e);
            }
          }
        }
      );

      console.log('✅ Monitor ativo!');
      Alert.alert('✅ Conectado', `Conectado ao ${dev.name || 'HydroBot'}`);
      
      // Solicitar status inicial
      setTimeout(() => {
        sendCommand('GET_STATUS');
      }, 1000);
      
    } catch (error: any) {
      console.error('❌ Erro ao conectar:', error);
      Alert.alert('Erro', 'Falha ao conectar: ' + (error.message || 'Erro desconhecido'));
      setIsConnected(false);
      setDevice(null);
    }
  };

  const disconnect = async () => {
    if (device) {
      try {
        console.log('🔌 Desconectando...');
        await device.cancelConnection();
        setDevice(null);
        setIsConnected(false);
        setTelemetry(null);
        Alert.alert('Desconectado', 'Dispositivo desconectado');
      } catch (error) {
        console.error('❌ Erro ao desconectar:', error);
      }
    }
  };

  const sendCommand = async (command: string) => {
    if (!device || !isConnected) {
      console.log('⚠️ Tentativa de enviar comando sem conexão');
      Alert.alert('Erro', 'Dispositivo não conectado');
      return;
    }

    try {
      // 🔧 SOLUÇÃO 1: Verificar se ainda está conectado
      const stillConnected = await device.isConnected();
      if (!stillConnected) {
        console.log('⚠️ Dispositivo desconectado!');
        setIsConnected(false);
        Alert.alert('Erro', 'Dispositivo desconectado');
        return;
      }

      console.log('📤 Enviando comando:', command);
      
      // Adicionar quebra de linha
      const commandWithNewline = command + '\n';
      const data = Buffer.from(commandWithNewline, 'utf-8').toString('base64');
      
      console.log('   Base64:', data.substring(0, 50));
      
      // 🔧 SOLUÇÃO 2: Tentar writeWithoutResponse primeiro
      try {
        await device.writeCharacteristicWithoutResponseForService(
          SERVICE_UUID,
          RX_CHAR_UUID,
          data
        );
        console.log('✅ Comando enviado (writeWithoutResponse)');
        return;
      } catch (err1: any) {
        console.log('⚠️ writeWithoutResponse falhou, tentando writeWithResponse...');
        
        // 🔧 SOLUÇÃO 3: Fallback para writeWithResponse
        try {
          await device.writeCharacteristicWithResponseForService(
            SERVICE_UUID,
            RX_CHAR_UUID,
            data
          );
          console.log('✅ Comando enviado (writeWithResponse)');
          return;
        } catch (err2: any) {
          throw err2; // Propaga o erro final
        }
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao enviar comando:', error);
      console.error('   Mensagem:', error.message);
      console.error('   Código:', error.errorCode);
      console.error('   Reason:', error.reason);
      
      // 🔧 SOLUÇÃO 4: Verificar se perdeu conexão
      try {
        const stillConnected = await device.isConnected();
        if (!stillConnected) {
          setIsConnected(false);
          Alert.alert('Conexão Perdida', 'O dispositivo foi desconectado. Reconecte e tente novamente.');
          return;
        }
      } catch (checkError) {
        console.error('Erro ao verificar conexão:', checkError);
      }
      
      Alert.alert('Erro', 'Falha ao enviar comando. Tente reconectar o dispositivo.');
    }
  };

  useEffect(() => {
    checkBluetoothState();
    
    const subscription = bleManager.onStateChange((state) => {
      console.log('📶 Estado do Bluetooth mudou para:', state);
      if (state === BleState.PoweredOff) {
        Alert.alert('Bluetooth Desligado', 'O Bluetooth foi desligado');
        setIsConnected(false);
        setDevice(null);
      }
    }, true);

    return () => {
      bleManager.stopDeviceScan();
      subscription.remove();
    };
  }, []);

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
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = () => {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error('useBluetooth deve ser usado dentro de BluetoothProvider');
  }
  return context;
};