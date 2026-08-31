import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useBluetooth } from '../../context/BluetoothContext';

export default function MonitorScreen() {
  const { telemetry, isConnected, isMockMode } = useBluetooth();
  const showTelemetry = isConnected || isMockMode;

  const getWaterIcon = (level: number) => {
    if (level >= 60) return 'water';
    if (level >= 40) return 'water-outline';
    if (level >= 20) return 'water-outline';
    return 'alert-circle';
  };

  const getWaterColor = (level: number) => {
    if (level >= 60) return '#3B82F6';
    if (level >= 40) return '#F59E0B';
    if (level >= 20) return '#EF4444';
    return '#991B1B';
  };

  const getFireIntensityLevel = (intensity: number) => {
    if (intensity >= 350) return 'PERIGO - Muito Perto';
    if (intensity >= 200) return 'IDEAL - Combatendo';
    if (intensity >= 50) return 'DETECTADO - Aproximando';
    return 'NENHUM';
  };

  const getFireColor = (intensity: number) => {
    if (intensity >= 350) return '#DC2626';
    if (intensity >= 200) return '#F59E0B';
    if (intensity >= 50) return '#FCD34D';
    return '#D1D5DB';
  };

  const getSensorColor = (delta: number) => {
    if (delta >= 200) return '#DC2626'; // Vermelho - fogo detectado
    if (delta >= 100) return '#F59E0B'; // Laranja - calor
    if (delta >= 50) return '#FCD34D';  // Amarelo - morno
    return '#10B981'; // Verde - normal
  };

  const getSensorIntensity = (delta: number) => {
    const maxDelta = 400;
    return Math.min((delta / maxDelta) * 100, 100);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {!showTelemetry ? (
          <View style={styles.disconnectedCard}>
            <Ionicons name="bluetooth-outline" size={64} color="#D1D5DB" />
            <Text style={styles.disconnectedTitle}>Não Conectado</Text>
            <Text style={styles.disconnectedText}>
              Conecte-se ao HydroBot para ver os dados
            </Text>
          </View>
        ) : (
          <>
            {/* Nível de Água */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons 
                    name={getWaterIcon(telemetry?.water || 0)} 
                    size={32} 
                    color={getWaterColor(telemetry?.water || 0)} 
                  />
                  <Text style={styles.cardTitle}>Nível de Água</Text>
                </View>
              </View>

              <View style={styles.metricContainer}>
                <Text style={[styles.metricValue, { color: getWaterColor(telemetry?.water || 0) }]}>
                  {telemetry?.water || 0}%
                </Text>
                
                {/* Barra de progresso */}
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { 
                        width: `${telemetry?.water || 0}%`,
                        backgroundColor: getWaterColor(telemetry?.water || 0)
                      }
                    ]} 
                  />
                </View>

                <Text style={styles.metricDescription}>
                  {(telemetry?.water || 0) >= 60 && 'Nível adequado'}
                  {(telemetry?.water || 0) >= 40 && (telemetry?.water || 0) < 60 && 'Nível médio'}
                  {(telemetry?.water || 0) >= 20 && (telemetry?.water || 0) < 40 && 'Nível baixo - Reabasteça'}
                  {(telemetry?.water || 0) < 20 && 'CRÍTICO - Reabasteça imediatamente!'}
                </Text>
              </View>
            </View>

            {/* Sensores de Fogo - 3 Sensores */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="flame" size={32} color="#DC2626" />
                  <Text style={styles.cardTitle}>Sensores de Fogo</Text>
                  {telemetry?.calibrated && (
                    <View style={styles.calibratedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.calibratedText}>Calibrado</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.sensorsContainer}>
                {/* Sensor Esquerdo */}
                <View style={styles.sensorCard}>
                  <View style={styles.sensorHeader}>
                    <Ionicons 
                      name="arrow-back" 
                      size={20} 
                      color={getSensorColor(telemetry?.delta_left || 0)} 
                    />
                    <Text style={styles.sensorTitle}>Esquerdo</Text>
                  </View>
                  
                  <Text style={[styles.sensorValue, { color: getSensorColor(telemetry?.delta_left || 0) }]}>
                    {telemetry?.sensor_left || 0}
                  </Text>
                  
                  <View style={styles.sensorDelta}>
                    <Text style={styles.sensorDeltaLabel}>Δ:</Text>
                    <Text style={[styles.sensorDeltaValue, { color: getSensorColor(telemetry?.delta_left || 0) }]}>
                      {telemetry?.delta_left || 0}
                    </Text>
                  </View>

                  <View style={styles.sensorBar}>
                    <View 
                      style={[
                        styles.sensorBarFill,
                        { 
                          height: `${getSensorIntensity(telemetry?.delta_left || 0)}%`,
                          backgroundColor: getSensorColor(telemetry?.delta_left || 0)
                        }
                      ]} 
                    />
                  </View>
                </View>

                {/* Sensor Central */}
                <View style={styles.sensorCard}>
                  <View style={styles.sensorHeader}>
                    <Ionicons 
                      name="arrow-up" 
                      size={20} 
                      color={getSensorColor(telemetry?.delta_center || 0)} 
                    />
                    <Text style={styles.sensorTitle}>Centro</Text>
                  </View>
                  
                  <Text style={[styles.sensorValue, { color: getSensorColor(telemetry?.delta_center || 0) }]}>
                    {telemetry?.sensor_center || 0}
                  </Text>
                  
                  <View style={styles.sensorDelta}>
                    <Text style={styles.sensorDeltaLabel}>Δ:</Text>
                    <Text style={[styles.sensorDeltaValue, { color: getSensorColor(telemetry?.delta_center || 0) }]}>
                      {telemetry?.delta_center || 0}
                    </Text>
                  </View>

                  <View style={styles.sensorBar}>
                    <View 
                      style={[
                        styles.sensorBarFill,
                        { 
                          height: `${getSensorIntensity(telemetry?.delta_center || 0)}%`,
                          backgroundColor: getSensorColor(telemetry?.delta_center || 0)
                        }
                      ]} 
                    />
                  </View>
                </View>

                {/* Sensor Direito */}
                <View style={styles.sensorCard}>
                  <View style={styles.sensorHeader}>
                    <Ionicons 
                      name="arrow-forward" 
                      size={20} 
                      color={getSensorColor(telemetry?.delta_right || 0)} 
                    />
                    <Text style={styles.sensorTitle}>Direito</Text>
                  </View>
                  
                  <Text style={[styles.sensorValue, { color: getSensorColor(telemetry?.delta_right || 0) }]}>
                    {telemetry?.sensor_right || 0}
                  </Text>
                  
                  <View style={styles.sensorDelta}>
                    <Text style={styles.sensorDeltaLabel}>Δ:</Text>
                    <Text style={[styles.sensorDeltaValue, { color: getSensorColor(telemetry?.delta_right || 0) }]}>
                      {telemetry?.delta_right || 0}
                    </Text>
                  </View>

                  <View style={styles.sensorBar}>
                    <View 
                      style={[
                        styles.sensorBarFill,
                        { 
                          height: `${getSensorIntensity(telemetry?.delta_right || 0)}%`,
                          backgroundColor: getSensorColor(telemetry?.delta_right || 0)
                        }
                      ]} 
                    />
                  </View>
                </View>
              </View>

              {/* Valores Base (Calibração) */}
              {telemetry?.calibrated && (
                <View style={styles.baseValues}>
                  <Text style={styles.baseTitle}>Valores Base (Calibração)</Text>
                  <View style={styles.baseRow}>
                    <View style={styles.baseItem}>
                      <Text style={styles.baseLabel}>Esq:</Text>
                      <Text style={styles.baseValue}>{telemetry?.base_left || 0}</Text>
                    </View>
                    <View style={styles.baseItem}>
                      <Text style={styles.baseLabel}>Centro:</Text>
                      <Text style={styles.baseValue}>{telemetry?.base_center || 0}</Text>
                    </View>
                    <View style={styles.baseItem}>
                      <Text style={styles.baseLabel}>Dir:</Text>
                      <Text style={styles.baseValue}>{telemetry?.base_right || 0}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Intensidade do Fogo (Resumo) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons 
                    name="analytics" 
                    size={32} 
                    color={getFireColor(telemetry?.intensity || 0)} 
                  />
                  <Text style={styles.cardTitle}>Detecção de Fogo</Text>
                </View>
              </View>

              <View style={styles.metricContainer}>
                {telemetry?.fire ? (
                  <View style={styles.fireDetected}>
                    <Ionicons name="flame" size={48} color="#DC2626" />
                    <Text style={styles.fireDetectedText}>FOGO DETECTADO!</Text>
                  </View>
                ) : (
                  <View style={styles.fireDetected}>
                    <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                    <Text style={[styles.fireDetectedText, { color: '#10B981' }]}>
                      Nenhum fogo detectado
                    </Text>
                  </View>
                )}

                <Text style={styles.metricLabel}>Intensidade Máxima:</Text>
                <Text style={[styles.metricValue, { color: getFireColor(telemetry?.intensity || 0) }]}>
                  {telemetry?.intensity || 0}
                </Text>

                <View style={styles.fireLevel}>
                  <Ionicons 
                    name="analytics" 
                    size={20} 
                    color={getFireColor(telemetry?.intensity || 0)} 
                  />
                  <Text style={[styles.fireLevelText, { color: getFireColor(telemetry?.intensity || 0) }]}>
                    {getFireIntensityLevel(telemetry?.intensity || 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Estado da Bomba */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons 
                    name="speedometer" 
                    size={32} 
                    color={(telemetry?.pump || 0) > 0 ? '#3B82F6' : '#D1D5DB'} 
                  />
                  <Text style={styles.cardTitle}>Bomba de Água</Text>
                </View>
              </View>

              <View style={styles.metricContainer}>
                <View style={styles.pumpStatus}>
                  <View style={[
                    styles.pumpIndicator,
                    { backgroundColor: (telemetry?.pump || 0) > 0 ? '#10B981' : '#EF4444' }
                  ]} />
                  <Text style={styles.pumpStatusText}>
                    {(telemetry?.pump || 0) > 0 ? 'LIGADA' : 'DESLIGADA'}
                  </Text>
                </View>

                {(telemetry?.pump || 0) > 0 && (
                  <>
                    <Text style={styles.metricValue}>
                      PWM: {telemetry?.pump}
                    </Text>
                    
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill,
                          { 
                            width: `${((telemetry?.pump || 0) / 255) * 100}%`,
                            backgroundColor: '#3B82F6'
                          }
                        ]} 
                      />
                    </View>

                    <Text style={styles.metricDescription}>
                      Potência: {Math.round(((telemetry?.pump || 0) / 255) * 100)}%
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Status do Sistema */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="information-circle" size={32} color="#DC2626" />
                  <Text style={styles.cardTitle}>Status do Sistema</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Modo</Text>
                  <View style={styles.infoValueContainer}>
                    <Ionicons 
                      name={telemetry?.mode === 'AUTO' ? 'sync' : 'hand-left'} 
                      size={20} 
                      color="#DC2626" 
                    />
                    <Text style={styles.infoValue}>{telemetry?.mode || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Velocidade</Text>
                  <Text style={styles.infoValue}>{telemetry?.speed || 100}%</Text>
                </View>

                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>PWM Mín</Text>
                  <Text style={styles.infoValue}>{telemetry?.pwm_min || 180}</Text>
                </View>

                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>PWM Máx</Text>
                  <Text style={styles.infoValue}>{telemetry?.pwm_max || 255}</Text>
                </View>
              </View>
            </View>
          </>
        )}
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
  disconnectedCard: {
    backgroundColor: '#fff',
    padding: 60,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 40,
  },
  disconnectedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6B7280',
    marginTop: 16,
  },
  disconnectedText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
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
  cardHeader: {
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  calibratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  calibratedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
  metricContainer: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 4,
  },
  metricDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  pumpStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pumpIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  pumpStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  fireDetected: {
    alignItems: 'center',
    marginBottom: 16,
  },
  fireDetectedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
    marginTop: 8,
  },
  fireLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  fireLevelText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  sensorsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  sensorCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sensorTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 4,
  },
  sensorValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  sensorDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sensorDeltaLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginRight: 4,
  },
  sensorDeltaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sensorBar: {
    width: '100%',
    height: 60,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  sensorBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  baseValues: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  baseTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  baseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  baseItem: {
    flex: 1,
    alignItems: 'center',
  },
  baseLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  baseValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 4,
  },
});