const { withGradleProperties, AndroidConfig } = require('@expo/config-plugins');
const { updateAndroidBuildProperty } = AndroidConfig.BuildProperties;

// 이 저장소 경로에 한글(비-ASCII) 문자가 섞여 있어서(예: "안티그래비티 파일") 생기는 두 가지 문제를 고친다.
// expo prebuild가 android/gradle.properties를 매번 새로 만들기 때문에, 손으로 고치는 대신
// 이 config plugin으로 app.json에 등록해서 prebuild할 때마다 자동으로 반영되게 한다.
// 1) Gradle이 자식 프로세스(node) 출력을 잘못된 인코딩으로 읽어 settings.gradle의
//    includeBuild 경로가 깨지는 문제 -> JVM 기본 인코딩을 UTF-8로 고정해서 해결.
// 2) Android Gradle Plugin이 비-ASCII 경로 자체를 막는 문제 -> 공식 우회 옵션으로 해결.
//    (주의: 구글 공식 문서도 "Windows에서 빌드가 실패할 수 있다"고 경고하는 임시 우회이므로,
//    가능하면 나중에 프로젝트를 ASCII 경로로 옮기는 게 더 안전하다.)
module.exports = function withAndroidNonAsciiPathFix(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    const existingJvmArgs = props.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    );
    const jvmArgsValue =
      existingJvmArgs && existingJvmArgs.type === 'property' && !existingJvmArgs.value.includes('-Dfile.encoding')
        ? `${existingJvmArgs.value} -Dfile.encoding=UTF-8`
        : existingJvmArgs?.value || '-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8';

    let next = updateAndroidBuildProperty(props, 'org.gradle.jvmargs', jvmArgsValue);
    next = updateAndroidBuildProperty(next, 'android.overridePathCheck', 'true');

    config.modResults = next;
    return config;
  });
};
