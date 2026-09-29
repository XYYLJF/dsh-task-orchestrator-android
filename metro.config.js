// Metro 配置：解决 pnpm（hoisted）布局下的模块解析问题
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 开启 package.json "exports" 字段解析：
// @agentclientprotocol/sdk 的 "./experimental/http-client" 子路径导出
// （createHttpStream）依赖 exports 字段，Metro 默认关闭该特性。
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
