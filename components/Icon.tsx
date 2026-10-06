import { Ionicons as BaseIonicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof BaseIonicons>;

/**
 * Ícone decorativo (M3): fica fora da navegação do TalkBack, porque a mesma
 * informação está no texto ao lado ou no nome acessível do controle que o
 * contém. Botões só com ícone mantêm o nome no próprio botão.
 */
function DecorativeIonicons(props: Props) {
  return (
    <BaseIonicons
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      {...props}
    />
  );
}

DecorativeIonicons.glyphMap = BaseIonicons.glyphMap;

export const Ionicons = DecorativeIonicons as typeof DecorativeIonicons & {
  glyphMap: typeof BaseIonicons.glyphMap;
};
