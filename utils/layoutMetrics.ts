// Cálculos de layout sem dependência de React, para poderem ser testados.

/**
 * Quanto o teclado cobre da área rolável. No Android com edge-to-edge a janela
 * não encolhe: o teclado se sobrepõe às abas (que já ocupam `tabBarHeight` na
 * base da tela) e ao conteúdo acima delas.
 */
export function keyboardOverlap(keyboardHeight: number, tabBarHeight: number): number {
  if (!keyboardHeight || keyboardHeight <= 0) return 0;
  return Math.max(0, Math.round(keyboardHeight - tabBarHeight));
}

export interface ScrollItem {
  /** Posição do item dentro do conteúdo rolável. */
  itemTop: number;
  itemHeight: number;
  /** Rolagem atual e altura visível do ScrollView (sem descontar o teclado). */
  scrollY: number;
  viewportHeight: number;
  overlap: number;
  margin?: number;
}

/**
 * Nova posição de rolagem para deixar o item (título, campo, Aplicar e erro)
 * visível acima do teclado, ou null se já estiver visível. Se o item for maior
 * que a área livre (fonte muito ampliada), alinha o topo para manter título e
 * campo à vista; o resto continua alcançável por rolagem.
 */
export function scrollTargetForItem({
  itemTop,
  itemHeight,
  scrollY,
  viewportHeight,
  overlap,
  margin = 12,
}: ScrollItem): number | null {
  const visible = Math.max(0, viewportHeight - overlap);
  const top = itemTop - margin;
  const bottom = itemTop + itemHeight + margin;
  if (bottom - top > visible) return Math.max(0, Math.round(top));
  if (top < scrollY) return Math.max(0, Math.round(top));
  if (bottom > scrollY + visible) return Math.max(0, Math.round(bottom - visible));
  return null;
}

/**
 * Altura da barra de abas para a escala de fonte atual: ícone + rótulo
 * (12 sp, altura de linha 16 sp) + margens + área do sistema (insets).
 * Em escala 1 resulta nos 68 dp usados até aqui.
 */
export function tabBarHeight(fontScale: number, insetBottom: number): number {
  const scale = Math.max(1, fontScale || 1);
  return Math.ceil(52 + 16 * scale) + Math.max(0, insetBottom);
}
