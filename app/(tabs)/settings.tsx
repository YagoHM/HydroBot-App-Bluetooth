import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useBluetooth } from '../../context/BluetoothContext';

export default function SettingsScreen() {
  const { isConnected, sendCommand, telemetry } = useBluetooth();
  
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

  const handleSaveSetting = async (command: string, value: number, name: string) => {
    if (!isConnected) {
      Alert.alert('Erro', 'Conecte-se ao HydroBot primeiro');
      return;
    }
    await sendCommand(`${command}:${value}`);
    Alert.alert('Sucesso', `${name} atualizado para ${value}`);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Connection Status */}
        <View style={[styles.statusCard, !isConnected && styles.statusCardDisconnected]}>
          <Ionicons 
            name={isConnected ? 'checkmark-circle' : 'close-circle'} 
            size={24} 
            color={isConnected ? '#10B981' : '#EF4444'} 
          />
          <Text style={styles.statusText}>
            {isConnected ? 'HydroBot Conectado' : 'Desconectado'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Controle de Movimento</Text>

        {/* Velocidade */}
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
                handleSaveSetting('SET_SPEED', Math.round(value), 'Velocidade')
              }
              minimumTrackTintColor="#DC2626"
              maximumTrackTintColor="#D1D5DB"
              thumbTintColor="#DC2626"
              disabled={!isConnected}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>30%</Text>
              <Text style={styles.sliderLabel}>100%</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Bomba de Água</Text>

        {/* PWM Mínimo */}
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
                handleSaveSetting('SET_PWM_MIN', Math.round(value), 'PWM Mínimo')
              }
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#D1D5DB"
              thumbTintColor="#3B82F6"
              disabled={!isConnected}
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

        {/* PWM Máximo */}
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
                handleSaveSetting('SET_PWM_MAX', Math.round(value), 'PWM Máximo')
              }
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#D1D5DB"
              thumbTintColor="#3B82F6"
              disabled={!isConnected}
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

        <Text style={styles.sectionTitle}>Sensores de Fogo (Avançado)</Text>

        {/* Fire Threshold */}
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
              editable={isConnected}
            />
            <TouchableOpacity
              style={[styles.applyButton, !isConnected && styles.applyButtonDisabled]}
              onPress={() => handleSaveSetting('SET_FIRE_THRESH', fireThresh, 'Limiar de Detecção')}
              disabled={!isConnected}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inputDescription}>
            Sensibilidade para detectar fogo (20-200)
          </Text>
        </View>

        {/* Fire Danger */}
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
              editable={isConnected}
            />
            <TouchableOpacity
              style={[styles.applyButton, !isConnected && styles.applyButtonDisabled]}
              onPress={() => handleSaveSetting('SET_FIRE_DANGER', fireDanger, 'Intensidade de Perigo')}
              disabled={!isConnected}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inputDescription}>
            Quando recuar (200-600)
          </Text>
        </View>

        {/* Fire Ideal */}
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
              editable={isConnected}
            />
            <TouchableOpacity
              style={[styles.applyButton, !isConnected && styles.applyButtonDisabled]}
              onPress={() => handleSaveSetting('SET_FIRE_IDEAL', fireIdeal, 'Distância Ideal')}
              disabled={!isConnected}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inputDescription}>
            Distância ideal para combater (100-400)
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Informações</Text>

        {/* Sobre */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.infoRow}>
            <Ionicons name="information-circle" size={24} color="#DC2626" />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Sobre o HydroBot</Text>
              <Text style={styles.infoValue}>Versão 1.0.0</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Ajuda */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.infoRow}
            onPress={() => Alert.alert(
              'Ajuda',
              'Comandos disponíveis:\n\n' +
              '• Modo Manual: Controle direto do robô\n' +
              '• Modo Auto: Robô busca fogo automaticamente\n' +
              '• Calibrar: Ajusta sensores de fogo\n' +
              '• Parada de Emergência: Para tudo imediatamente'
            )}
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
          <Text style={styles.footerSubtext}>React Native + Bluetooth HC-05/06</Text>
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusCardDisconnected: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
  sliderContainer: {
    paddingHorizontal: 8,
  },
  sliderValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  sliderDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  applyButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    color: '#6B7280',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});