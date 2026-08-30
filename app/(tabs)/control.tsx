import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useBluetooth } from '../../context/BluetoothContext';

export default function ControlScreen() {
  const { isConnected, sendCommand, telemetry, isMockMode } = useBluetooth();
  const [pumpActive, setPumpActive] = useState(false);

  useEffect(() => {
    if (telemetry) {
      setPumpActive(telemetry.pump > 0);
    }
  }, [telemetry]);

  const handleCommand = async (cmd: string, description: string) => {
    if (!isConnected && !isMockMode) {
      Alert.alert('Erro', 'Conecte-se ao HydroBot primeiro');
      return;
    }
    await sendCommand(cmd);
  };

  const toggleMode = async () => {
    if (!isConnected && !isMockMode) {
      Alert.alert('Erro', 'Conecte-se ao HydroBot primeiro');
      return;
    }
    
    const isAuto = telemetry?.mode === 'AUTO';
    await sendCommand(isAuto ? 'MODE_MANUAL' : 'MODE_AUTO');
    Alert.alert(
      'Modo Alterado',
      isAuto ? 'Modo Manual ativado' : 'Modo Automático ativado'
    );
  };

  const togglePump = async () => {
    if (!isConnected && !isMockMode) {
      Alert.alert('Erro', 'Conecte-se ao HydroBot primeiro');
      return;
    }

    if (telemetry && telemetry.water <= 10) {
      Alert.alert('Aviso', 'Nível de água muito baixo!');
      return;
    }

    await sendCommand(pumpActive ? 'PUMP_OFF' : 'PUMP_ON');
  };

  const isManualMode = telemetry?.mode === 'MANUAL' || !telemetry;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Status Bar */}
        <View style={[styles.statusBar, !isConnected && styles.statusBarDisconnected]}>
          <Ionicons 
            name={isConnected ? 'radio-button-on' : 'radio-button-off'} 
            size={20} 
            color={isConnected ? '#10B981' : '#EF4444'} 
          />
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.card}>
          <View style={styles.modeHeader}>
            <View style={styles.modeInfo}>
              <Ionicons 
                name={telemetry?.mode === 'AUTO' ? 'sync' : 'hand-left'} 
                size={28} 
                color="#DC2626" 
              />
              <View style={styles.modeText}>
                <Text style={styles.modeTitle}>
                  Modo {telemetry?.mode === 'AUTO' ? 'Automático' : 'Manual'}
                </Text>
                <Text style={styles.modeDescription}>
                  {telemetry?.mode === 'AUTO' 
                    ? 'Robô controla sozinho' 
                    : 'VOCÊ controla o CARRINHO'}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[
                styles.modeButton,
                telemetry?.mode === 'AUTO' && styles.modeButtonActive
              ]}
              onPress={toggleMode}
              disabled={!isConnected && !isMockMode}
            >
              <Text style={[
                styles.modeButtonText,
                telemetry?.mode === 'AUTO' && styles.modeButtonTextActive
              ]}>
                {telemetry?.mode === 'AUTO' ? 'AUTO' : 'MANUAL'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Controles Direcionais */}
        {isManualMode && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Controle de Movimento</Text>
            
            <View style={styles.controlsContainer}>
              {/* Frente */}
              <View style={styles.controlRow}>
                <TouchableOpacity
                  style={styles.directionButton}
                  onPressIn={() => handleCommand('FWD', 'Frente')}
                  onPressOut={() => handleCommand('STOP', 'Parar')}
                  disabled={!isConnected && !isMockMode}
                >
                  <Ionicons name="arrow-up" size={32} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Esquerda, Parar, Direita */}
              <View style={styles.controlRow}>
                <TouchableOpacity
                  style={styles.directionButton}
                  onPressIn={() => handleCommand('LEFT', 'Esquerda')}
                  onPressOut={() => handleCommand('STOP', 'Parar')}
                  disabled={!isConnected && !isMockMode}
                >
                  <Ionicons name="arrow-back" size={32} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.directionButton, styles.stopButton]}
                  onPress={() => handleCommand('STOP', 'Parar')}
                  disabled={!isConnected && !isMockMode}
                >
                  <Ionicons name="stop" size={32} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.directionButton}
                  onPressIn={() => handleCommand('RIGHT', 'Direita')}
                  onPressOut={() => handleCommand('STOP', 'Parar')}
                  disabled={!isConnected && !isMockMode}
                >
                  <Ionicons name="arrow-forward" size={32} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Trás */}
              <View style={styles.controlRow}>
                <TouchableOpacity
                  style={styles.directionButton}
                  onPressIn={() => handleCommand('BACK', 'Trás')}
                  onPressOut={() => handleCommand('STOP', 'Parar')}
                  disabled={!isConnected && !isMockMode}
                >
                  <Ionicons name="arrow-down" size={32} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Controle da Bomba */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bomba de Água</Text>
          
          <View style={styles.pumpContainer}>
            <View style={styles.pumpInfo}>
              <Ionicons 
                name="water" 
                size={48} 
                color={pumpActive ? '#3B82F6' : '#D1D5DB'} 
              />
              <View style={styles.pumpText}>
                <Text style={styles.pumpStatus}>
                  {pumpActive ? 'Ligada' : 'Desligada'}
                </Text>
                {pumpActive && telemetry && (
                  <Text style={styles.pumpPWM}>
                    PWM: {telemetry.pump}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.pumpButton, pumpActive && styles.pumpButtonActive]}
              onPress={togglePump}
              disabled={(!isConnected && !isMockMode) || !isManualMode}
            >
              <Ionicons 
                name={pumpActive ? 'pause' : 'play'} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.pumpButtonText}>
                {pumpActive ? 'Desligar' : 'Ligar'}
              </Text>
            </TouchableOpacity>
          </View>

          {telemetry && telemetry.water <= 10 && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.warningText}>Nível de água baixo!</Text>
            </View>
          )}
        </View>

        {/* Ações Rápidas */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ações Rápidas</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCommand('CALIBRATE', 'Calibrar')}
            disabled={!isConnected && !isMockMode}
          >
            <Ionicons name="settings-outline" size={24} color="#DC2626" />
            <Text style={styles.actionButtonText}>Calibrar Sensores</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.emergencyButton]}
            onPress={() => {
              handleCommand('STOP', 'Parada de Emergência');
              handleCommand('PUMP_OFF', 'Desligar bomba');
              Alert.alert('Emergência', 'Todos os sistemas desligados!');
            }}
            disabled={!isConnected && !isMockMode}
          >
            <Ionicons name="alert-circle" size={24} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>
              Parada de Emergência
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusBarDisconnected: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeText: {
    marginLeft: 12,
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modeDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  modeButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#DC2626',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  controlsContainer: {
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 8,
  },
  directionButton: {
    backgroundColor: '#DC2626',
    width: 70,
    height: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  stopButton: {
    backgroundColor: '#991B1B',
  },
  pumpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pumpInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pumpText: {
    marginLeft: 16,
  },
  pumpStatus: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  pumpPWM: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  pumpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  pumpButtonActive: {
    backgroundColor: '#3B82F6',
  },
  pumpButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  emergencyButton: {
    backgroundColor: '#991B1B',
    marginBottom: 0,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
});