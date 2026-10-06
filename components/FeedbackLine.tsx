import { Ionicons } from './Icon';
import { StyleSheet, Text, View } from 'react-native';
import type { Feedback } from '../hooks/useCommandFeedback';

const LOOK: Record<Feedback['kind'], { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  pending: { icon: 'hourglass-outline', color: '#374151', bg: '#F3F4F6' },
  success: { icon: 'checkmark-circle', color: '#065F46', bg: '#ECFDF5' },
  info: { icon: 'information-circle', color: '#1E40AF', bg: '#EFF6FF' },
  error: { icon: 'alert-circle', color: '#991B1B', bg: '#FEF2F2' },
};

/** Linha de estado de um comando: ícone + texto (nunca só cor). */
export default function FeedbackLine({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  const look = LOOK[feedback.kind];
  return (
    <View
      style={[styles.box, { backgroundColor: look.bg }]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={feedback.text}
    >
      <Ionicons name={look.icon} size={18} color={look.color} />
      <Text style={[styles.text, { color: look.color }]}>{feedback.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
