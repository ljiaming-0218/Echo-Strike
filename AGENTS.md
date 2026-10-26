# 时间追猎开发约定

- 开始读取docs/design-v2.md、docs/progress.md、README.md和Git状态。docs/plan.md是旧版历史资料；用户选择的新规则以design-v2为准。
- 使用现有隔离checkout，不主动创建Git worktree；保留用户已有改动。
- 核心src/core必须是纯TypeScript，不导入Phaser、DOM、Sprite或浏览器计时器；战斗权威只有一个60Hz时钟。
- 每轮最多720tick，记录实际成功撤离前的真人姿态和成功攻击；最多3份敌对历史，不能重新瞄准、递归录制或修改快照。
- 手动瞄准、敌对过去、时间锚、掩体与限时撤离是当前玩法，不恢复旧版自动射击刷怪。
- 不添加React、后端、数据库、在线模型或密钥。
- 修改后执行typecheck、相关核心测试、build和浏览器检查，更新progress/qa。不得虚构真机、完整局或公开网址结果。
- 只有用户授权时提交推送与部署。本会话用户已授权完成开发、GitHub推送及Render自动部署；授权不扩展到无关远端操作。
