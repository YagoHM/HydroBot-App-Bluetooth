import { useEffect, useRef, type RefObject } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface AppModalButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel';
}

interface AppModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AppModalButton[];
  onRequestClose: () => void;
  /**
   * Elemento que abriu o modal. Ao fechar, o foco (TalkBack ou teclado)
   * volta para ele. Na web, sem ref, volta ao elemento que tinha o foco.
   */
  returnFocusRef?: RefObject<any>;
}

/** Tempo para a animação de saída terminar antes de mover o foco. */
const RETURN_FOCUS_DELAY_MS = 300;

export function restoreFocus(target: any) {
  if (!target) return;
  if (Platform.OS === 'web') {
    target.focus?.();
    return;
  }
  const tag = findNodeHandle(target);
  if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
}

export default function AppModal({
  visible,
  title,
  message,
  buttons,
  onRequestClose,
  returnFocusRef,
}: AppModalProps) {
  const resolvedButtons: AppModalButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  const titleRef = useRef<Text>(null);
  const wasVisibleRef = useRef(false);
  const webOpenerRef = useRef<any>(null);

  // Guarda quem abriu o modal e devolve o foco a ele quando o modal fecha.
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      webOpenerRef.current =
        Platform.OS === 'web' && typeof document !== 'undefined' ? document.activeElement : null;
    }
    if (!visible && wasVisibleRef.current) {
      const target = returnFocusRef?.current ?? webOpenerRef.current;
      const timer = setTimeout(() => restoreFocus(target), RETURN_FOCUS_DELAY_MS);
      wasVisibleRef.current = false;
      return () => clearTimeout(timer);
    }
    wasVisibleRef.current = visible;
  }, [visible, returnFocusRef]);

  const handlePress = (button: AppModalButton) => {
    onRequestClose();
    button.onPress?.();
  };

  // Leva o foco do leitor de tela para o título ao abrir, e lê a mensagem.
  const handleShow = () => {
    if (Platform.OS === 'web') return;
    const tag = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      onShow={handleShow}
    >
      <View style={styles.overlay}>
        <View style={styles.box} accessibilityViewIsModal>
          <Text ref={titleRef} style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {message ? (
            <ScrollView style={styles.messageScroll}>
              <Text style={styles.message}>{message}</Text>
            </ScrollView>
          ) : null}

          <View style={styles.buttonRow}>
            {resolvedButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'cancel' ? styles.buttonCancel : styles.buttonDefault,
                ]}
                onPress={() => handlePress(button)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'cancel' && styles.buttonTextCancel,
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
  },
  messageScroll: {
    flexGrow: 0,
    flexShrink: 1,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    paddingHorizontal: 20,
    minHeight: 48,
    minWidth: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonDefault: {
    backgroundColor: '#DC2626',
  },
  buttonCancel: {
    backgroundColor: '#F3F4F6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextCancel: {
    color: '#374151',
  },
});
