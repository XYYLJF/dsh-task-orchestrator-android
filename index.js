// 自定义应用入口：替代 expo 默认的 node_modules/expo/AppEntry.js。
// pnpm（hoisted）布局下 AppEntry.js 的 '../../App' 相对解析会落到 .pnpm 深处而失败，
// 故以本项目根内入口显式导入 App。
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
