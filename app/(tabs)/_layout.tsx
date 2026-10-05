import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppModal from '../../components/AppModal';
import EmergencyModal from '../../components/EmergencyModal';
import HeaderTitle from '../../components/HeaderTitle';
import NoticeHost from '../../components/NoticeHost';
import { useBluetooth } from '../../context/BluetoothContext';

function RestartButton() {
  const { restartApp } = useBluetooth();
  const [confirming, setConfirming] = useState(false);
  const buttonRef = useRef<any>(null);

  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        onPress={() => setConfirming(true)}
        accessibilityRole="button"
        accessibilityLabel="Reiniciar aplicativo"
        hitSlop={8}
        style={{
          marginRight: 12,
          paddingHorizontal: 10,
          minHeight: 40,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Ionicons name="reload" size={20} color="#fff" />
        <Text style={{ color: '#fff', marginLeft: 4, fontSize: 12, fontWeight: '600' }}>
          Reiniciar
        </Text>
      </TouchableOpacity>
      <AppModal
        visible={confirming}
        title="Reiniciar aplicativo?"
        message="O aplicativo será recarregado e a conexão atual (real ou simulada) será encerrada."
        buttons={[
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Reiniciar', onPress: () => void restartApp() },
        ]}
        onRequestClose={() => setConfirming(false)}
        returnFocusRef={buttonRef}
      />
    </>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#B91C1C',
          // Abas não selecionadas continuam acionáveis: contraste 4,83:1 sobre branco
          tabBarInactiveTintColor: '#6B7280',
          headerStyle: {
            backgroundColor: '#DC2626',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          // Título + indicador compacto de modo/conexão (substitui a faixa grande)
          headerTitleAlign: 'left',
          headerTitle: ({ children }) => <HeaderTitle title={String(children)} />,
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            // Altura suficiente para ícone + rótulo sem corte; insets evitam a barra do sistema
            height: 68 + insets.bottom,
            paddingBottom: 10 + insets.bottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            lineHeight: 16,
            // Evita que o rótulo seja comprimido e corte letras como "ç" e "g"
            minHeight: 16,
            flexShrink: 0,
            fontWeight: '600',
          },
          headerRight: () => <RestartButton />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Conexão',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bluetooth" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="control"
          options={{
            title: 'Controle',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="game-controller" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="monitor"
          options={{
            title: 'Monitor',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="analytics" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Configurações',
            // "Configurações" não cabia na aba e aparecia com reticências
            tabBarLabel: 'Ajustes',
            tabBarAccessibilityLabel: 'Ajustes, tela de Configurações',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <NoticeHost />
      <EmergencyModal />
    </>
  );
}
