# 回响特攻开发约定

- 开始时读取 docs/plan.md、docs/progress.md 和 README.md；先核对 Git 状态并保留用户改动。
- 使用当前隔离环境的现有 checkout，未经用户明确要求不创建 Git worktree。
- 按里程碑开发，不提前生成后续阶段的空类、玩法或框架。
- src/core 必须是纯 TypeScript，不得导入 Phaser、DOM、Sprite 或浏览器计时器。
- 仿真只使用一个固定 60Hz 时钟与 completedTicks；Phaser 只负责输入、画面和声音。
- 记录成功提交的真人攻击；6秒360步、最多3分身、FIFO、快照与暂停规则见计划。
- 不添加 React、后端、物理引擎、在线服务或密钥。
- 修改后运行适用核心测试、typecheck、build，更新 progress；仅记录真实执行结果。
- 真机、公开网址未经实际核验，必须标为未验证。不自动推送或发布。
