import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * true quando TalkBack/VoiceOver está ativo. Na web sempre false: o
 * react-native-web responde "true" fixo e não detecta leitores de tela.
 */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (active) setEnabled(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);
  return enabled;
}
