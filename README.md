# 回响特攻 · ECHO RUSH

固定竞技场、俯视角、自动射击的单人生存游戏。**当前6秒的行动，会成为未来最多3个循环分身。** 用走位布置历史火线，再把敌人引入过去的弹道。存活180秒获胜，死亡立即结算。

实现：三种敌人、自动枪、冲刺、震荡波、60/120秒两次升级、开始/暂停/结算/重开、音量和减少特效设置、PC键盘、移动端多点触控、失焦与竖屏暂停。无需账号、后端或API密钥。

## 本地运行

已验证 Node **24.19.0** / npm **11.9.0**。在仓库根目录运行：

```sh
npm ci --include=dev
npm run dev -- --host 0.0.0.0
```

开发服务默认5173端口，以终端输出为准。手机同网段打开电脑局域网IP和实际端口；云环境的本地地址不是公开试玩链接。Ctrl+C停止服务。

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --host 0.0.0.0
```

构建输出 `dist`。preview默认4173端口，仅用于本地检查，不用作生产服务器。

## 操作

| 动作 | PC | 手机横屏 |
| --- | --- | --- |
| 移动 | WASD / 方向键 | 左侧摇杆 |
| 基础攻击 | 自动射击最近敌人 | 自动 |
| 冲刺 | Space | 冲刺按钮 |
| 震荡波 | Q | 震荡波按钮 |
| 暂停 / 继续 | Esc 或暂停按钮 | 页面按钮 |

分身重放**历史位置与攻击方向**，不会重新瞄准，也不会录制其他分身。6秒边界统一重置历史分身相位；真人、敌人、冷却和在途子弹不重置。第4段替换最旧记录。升级只影响未来真人与新记录，旧快照保持不变。分身伤害只在创建攻击时乘一次0.45。

切后台、失焦、触屏设备转竖屏时暂停；恢复可见/横屏后须显式继续。若单帧间隔超过250ms也会暂停，不补算离开期间的时间。设置与本机最高击杀保存在版本化localStorage，存储不可用仍可玩。震荡波的动画没有持续伤害。

## 自动验证

```sh
npm test              # 纯核心/配置/存储，36项测试
npm run test:e2e      # 4个浏览器流程，包含20次重开
```

Playwright默认使用 `/usr/bin/chromium`。其他机器可安装浏览器后指定路径：

```sh
npx playwright install chromium
CHROMIUM_PATH="$(node -e 'process.stdout.write(require("playwright").chromium.executablePath())')" npm run test:e2e
```

浏览器测试在专用 `e2e` Vite模式中加载测试夹具。普通开发模式与正式构建不暴露强制推进/胜负/生命值入口；生产产物已做单独检查。CI执行安装、类型检查、核心测试、构建与浏览器流程。

测试覆盖：359/360边界与FIFO、事件0/1/358/359、唯一ID、无递归录制、30/60/120Hz一致性、快照不变、连续碰撞、单次死亡、免伤、技能优先级、容量拒绝、跨段冷却、60/120/180秒状态优先级、有种子随机、暂停叠加、十分钟核心仿真、70敌人/360弹丸压力夹具。

## 架构

- `src/core/`：纯TypeScript仿真，无Phaser/DOM/浏览器计时器。World拥有实体、ID、状态与战斗结算。
- `src/core/clock/`：唯一60Hz累加时钟。Phaser提供原始显示帧delta，不作为战斗权威。
- `src/core/echo/`：不可变动作快照、最多3个FIFO分身、同相位事件游标。
- `src/adapters/`：键盘与独立pointerId触控统一为逐tick输入。
- `src/view/`：程序几何、插值、有限特效、用户手势解锁的程序音效。
- `src/ui/`：菜单/HUD/升级/设置；重开新建World，不重复注册监听器。
- `docs/plan.md`：原始设计参考；`docs/progress.md`：实施进度；`docs/qa.md`：实际验证与未测项。

依赖精确锁定见package.json与package-lock.json。项目.npmrc把缓存放到被忽略的.npm-cache目录。

## Render Static Site

本仓库含 `render.yaml`。现有 Render 站点若已连接GitHub的main分支，推送会按该站点配置自动触发构建。Blueprint文件不会自动修改控制台中独立创建的现有服务。

| 配置 | 值 |
| --- | --- |
| 类型 | Static Site |
| Branch | main |
| Root Directory | 留空（仓库根目录） |
| Build Command | `npm ci --include=dev && npm run typecheck && npm test && npm run build` |
| Publish Directory | `dist` |
| NODE_VERSION | `24.19.0` |
| Start Command | 无 |

没有history路由，无需SPA重写。资源本地打包，默认根路径 `/`，不依赖素材CDN、代理、数据库或密钥。发布状态和公开URL只在实际核验后记入qa.md；推送成功不代表Render部署成功。

## 已知限制

已验证Linux Chromium与模拟触摸/横竖屏，**没有真实Android/iOS、Safari或移动GPU性能结果**。程序几何美术遵循首版计划。Phaser独立分包约1.21MB（gzip约332KB），保留Vite体积警告，不隐藏风险。十分钟核心仿真是逻辑有界性验证，不代表真实手机十分钟画面性能。公开部署结果见qa.md。
