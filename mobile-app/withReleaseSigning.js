const { withAppBuildGradle } = require('@expo/config-plugins');

// 기존 twa-build/android.keystore로 릴리즈 빌드에 서명하기 위한 config plugin.
// 실제 비밀번호는 이 파일에 넣지 않고, 빌드 시 -P커맨드라인 프로퍼티(MYAPP_RELEASE_*)로만 전달한다
// (Play 스토어에 이미 게시된 기존 앱과 같은 키로 서명해야 "업데이트"로 인식된다).
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    contents = contents.replace(
      /signingConfigs\s*\{\s*debug\s*\{[^}]*\}\s*\}/,
      `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }`
    );

    contents = contents.replace(
      /release\s*\{\s*\/\/ Caution![^\n]*\n[^\n]*\n\s*signingConfig signingConfigs\.debug/,
      (match) => match.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release')
    );

    config.modResults.contents = contents;
    return config;
  });
};
