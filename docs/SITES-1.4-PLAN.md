# OneDay Sites 1.4 Implementation Plan

**Goal:** 将既有 OneDay Lite 1.3 原地迭代为可以私人跨设备使用的 Sites 云版本。
**Architecture:** 保留原前端、增加 SDK 兼容适配器；Vinext 路由承载页面与鉴权 API；D1/R2 提供持久化。
**Tech Stack:** 原生 JS/CSS、Python 拼装、Vinext、Cloudflare D1/R2。
**Spec:** `docs/SITES-1.4-DESIGN.md`

## Global Constraints

- 保留原七表记录语义与现有视觉、交互及 WorkBuddy 构建。
- 私人权限；没有真实请求身份的业务 API 返回 401。
- 不装入样例数据、不自动覆盖旧记录、不静默覆盖跨端编辑。
- 原任务计划是墙钟字符串，执行时长使用 UTC instant。
- 无需用户再次确认已授权开发及发布；原始交接有明确指令。

## Review Focus

- 同一记录由两个设备修改：陈旧版本必须被拒绝，草稿可恢复。
- 网络中断时新增/上传/导入：不重复创建，不覆盖期间输入，不谎报成功。
- 旧 Markdown 表格、中文输入、光标位置：编辑不能损坏原内容。
- 他人/未登录访问附件或猜测记录 ID：必须隔离或拒绝。
- 旧 JSON 七表/未知字段/重复 ID：保留关系；冲突导入不得覆盖。

## Task 1: 云服务

Files: `server/api.mjs`, `app/api/oneday/[...path]/route.ts`, `db/schema.ts`, `tests/cloud/backend*.mjs`.
Interfaces: `handleOneDay(request, env)`；API 合约见源码及各测试。
- [x] 写入并运行权限、并发与导入安全测试，先确认失败。
- [x] 实现记录分页、CAS、幂等、状态事务、R2 附件、备份/导入。
- [x] 运行后端完整测试，生成 schema-only Drizzle 迁移并检查 SQL。

## Task 2: 兼容适配与云入口

Files: `src/lite/cloud.js`, `src/lite/store.js`, `src/lite/app.js`, `src/lite/panels.js`, `tools/build_lite_sites.py`, `app/route.ts`.
Interfaces: `OneDayCloud.createDatabase({fetch})` 提供原 SDK query/addRecord/updateRecord/deleteRecord/uploadImage/uploadFile；增量 getRecord/transitionStatus/exportBackup/importBackup/checkRevision。
- [x] 为版本传递、错误不降级、重试 ID、分页和导入保护写行为测试。
- [x] 创建独立 Sites 构建；服务端注入当前用户草稿命名空间。
- [x] 云数据设置、导入预检及分批合并、服务端备份；复用已有同步控件。
- [x] 保留原 WorkBuddy 构建回归，运行适配器及原核心测试。

## Task 3: 内容编辑可靠性

Files: `src/lite/editor.js`, `src/lite/timeline.js`, `src/lite/dialogs.js`, `src/lite/ui.js`, `tests/cloud/editor*.cjs`.
Interfaces: `L.flushDrafts()` 同步持久化；`L.hasUnsavedChanges()` 报告未提交变化。
- [x] 建立表格往返、上传期间输入、草稿恢复行为回归。
- [x] 修复编辑器序列化和光标、Sheet 草稿、明确并行入口一致性。
- [x] 运行针对性测试及原核心回归。

## Task 4: 集成验证与发布

Files: `.openai/hosting.json`, `docs/SITES-1.4-VERIFICATION.md`.
- [x] 检查源代码安全、原功能回归与真实 D1/R2 API 集成。
- [x] 使用支持的浏览器预览核验桌面/手机界面；记录登录能力限制。
- [ ] 执行正式构建、独立代码审查并修复重大问题。
- [ ] 由 Sites source helper 推送精确源码并打包；发布到 owner-private Site。
- [ ] 等待终态成功，交付真实线上 URL 和未完成验收边界。
