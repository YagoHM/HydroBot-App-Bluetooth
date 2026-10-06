// Config plugin (C3): atualiza o layout quando a fonte do Android muda com o
// app aberto.
//
// Causa (análise do React Native 0.81, Fabric):
// - o SurfaceHandler só remede os textos quando layoutContext.fontSizeMultiplier
//   muda, e esse valor só acompanha a escala do sistema com a feature flag
//   enableFontScaleChangesUpdatingLayout, desligada por padrão;
// - sem "fontScale" em configChanges, o Android recria a Activity, e o
//   MainActivity do Expo chama super.onCreate(null): a árvore React é montada
//   de novo e o estado da tela se perde.
//
// O plugin: (1) liga a flag, (2) declara fontScale em configChanges e (3) no
// onConfigurationChanged força nova medição da raiz, para o Fabric receber a
// nova escala sem recriar a Activity.
const {
  AndroidConfig,
  withAndroidManifest,
  withMainActivity,
  withMainApplication,
} = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const TAG = 'hydrobot-font-scale';

function withFontScaleConfigChange(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const current = (activity.$['android:configChanges'] || '').split('|').filter(Boolean);
    if (!current.includes('fontScale')) current.push('fontScale');
    activity.$['android:configChanges'] = current.join('|');
    return cfg;
  });
}

function withFeatureFlag(config) {
  return withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withFontScaleRelayout: MainApplication em Kotlin esperado.');
    }
    const anchor = /^\s*loadReactNative\(this\)\s*$/m;
    if (!anchor.test(cfg.modResults.contents)) {
      throw new Error('withFontScaleRelayout: chamada loadReactNative(this) não encontrada no MainApplication.');
    }
    cfg.modResults.contents = mergeContents({
      tag: TAG,
      src: cfg.modResults.contents,
      anchor,
      offset: 1,
      comment: '//',
      newSrc: [
        '    // HydroBot: o RN 0.81 traz enableFontScaleChangesUpdatingLayout desligado;',
        '    // sem ele o Fabric não remede os textos quando a fonte do sistema muda.',
        '    if (DefaultNewArchitectureEntryPoint.releaseLevel == ReleaseLevel.STABLE &&',
        '        BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {',
        '      com.facebook.react.internal.featureflags.ReactNativeFeatureFlags.dangerouslyForceOverride(',
        '          object : com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider by',
        '              com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android(',
        '                  true, true, true) {',
        '            override fun enableFontScaleChangesUpdatingLayout(): Boolean = true',
        '          })',
        '    }',
      ].join('\n'),
    }).contents;
    return cfg;
  });
}

function withRelayoutOnFontScale(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withFontScaleRelayout: MainActivity em Kotlin esperado.');
    }
    const anchor = /^\s*override fun getMainComponentName\(\): String = "main"\s*$/m;
    if (!anchor.test(cfg.modResults.contents)) {
      throw new Error('withFontScaleRelayout: getMainComponentName() não encontrado no MainActivity.');
    }
    cfg.modResults.contents = mergeContents({
      tag: TAG,
      src: cfg.modResults.contents,
      anchor,
      offset: 1,
      comment: '//',
      newSrc: [
        '',
        '  private var lastFontScale = 0f',
        '',
        '  // HydroBot: com "fontScale" em configChanges a Activity não é recriada;',
        '  // força nova medição para o Fabric aplicar a nova escala de fonte.',
        '  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {',
        '    super.onConfigurationChanged(newConfig)',
        '    if (newConfig.fontScale != lastFontScale) {',
        '      lastFontScale = newConfig.fontScale',
        '      window?.decorView?.let { root ->',
        '        forceRelayout(root)',
        '        root.requestLayout()',
        '      }',
        '    }',
        '  }',
        '',
        '  private fun forceRelayout(view: android.view.View) {',
        '    view.forceLayout()',
        '    if (view is android.view.ViewGroup) {',
        '      for (i in 0 until view.childCount) forceRelayout(view.getChildAt(i))',
        '    }',
        '  }',
      ].join('\n'),
    }).contents;
    return cfg;
  });
}

module.exports = function withFontScaleRelayout(config) {
  return withRelayoutOnFontScale(withFeatureFlag(withFontScaleConfigChange(config)));
};
