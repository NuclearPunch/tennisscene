// 앱은 웹(루트 eslint.config.mjs)과 따로 검사한다. 루트 설정은 mobile/ 을 무시한다.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "src/components/brand/logoPaths.ts"],
  },
]);
