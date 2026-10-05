import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppModal from '../components/AppModal';
import { useAuth } from '../context/AuthContext';
import { EMAIL_REGEX } from '../utils/validation';

const APP_EMAIL = 'admin@hydrobot.com';
const APP_PASSWORD = '1234';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loginButtonRef = useRef<any>(null);
  const { login, findUser } = useAuth();

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const handleLogin = async () => {
    if (!EMAIL_REGEX.test(email)) {
      showError('Formato de e-mail inválido.');
      return;
    }

    const isDemoUser = email === APP_EMAIL && password === APP_PASSWORD;
    const registeredUser = findUser(email, password);

    if (!isDemoUser && !registeredUser) {
      showError('E-mail ou senha incorretos.');
      return;
    }

    await login();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Ionicons name="shield-checkmark" size={64} color="#DC2626" />
        <Text style={styles.title}>HydroBot</Text>
        <Text style={styles.subtitle}>Digite o e-mail e a senha para continuar</Text>

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#6B7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          ref={loginButtonRef}
          style={styles.button}
          onPress={handleLogin}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Entrar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/register')}
          accessibilityRole="link"
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={styles.link}>Não possui conta? Cadastre-se</Text>
        </TouchableOpacity>
      </View>

      <AppModal
        visible={errorModalVisible}
        title="Erro de Autenticação"
        message={errorMessage}
        onRequestClose={() => setErrorModalVisible(false)}
        returnFocusRef={loginButtonRef}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 350,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 16,
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
});
