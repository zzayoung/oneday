# OneDay Lite 1.3 → ChatGPT Sites 部署交接

## 当前状态（请勿混淆）
本包是部署交接包，不是已上线站点。
本次 Chat 环境没有 Sites 发布工具；未创建 Sites 项目、未建立云数据库、未上传云附件，也未获得线上 URL。
原 1.3 源码及 Git bundle 完整保留在 source-package/；本包不修改应用源码。

## 用户本次目标
先让现有 OneDay 在 ChatGPT 自己的云上真正可用，用户再边用边反馈。不要再做产品设计确认、不要重新画界面、不要另外推荐云厂商。
在能调用 Sites 的 Work / Codex 环境中，读取当前 Sites 工具与运行时说明，创建独立的私有 Sites 试用部署；直接完成必要的后端适配、验证、发布。
如需要用户完成平台授权、付费确认或首次发布按钮操作，只在那个真实阻塞点停下。

## 应用与数据边界
- 1.3 的本机体验版使用 src/lite/demo.js 中的 localStorage 示例数据库，不能将其直接公开托管后称为跨设备同步。
- 1.3 的 WorkBuddy 正式版依赖 window.__SMART_PAGE__.database，换到 Sites 不会自然获得此 SDK。
- 为 Sites 创建独立适配层与构建目标，保留原 WorkBuddy 构建和 V10 文件；不覆盖原表，不自动改写 WorkBuddy 数据。
- Sites 试用分支以 Sites 的真实持久化数据库、文件存储为准；它不是 WorkBuddy 数据的实时镜像。
- 默认空白个人数据库，不自动混入 demo.js 的示例任务。旧浏览器里的记录只能经明确的导出/导入迁移，不能宣称已自动读取或迁移。

## 优先阅读的真实文件
源码根：source-package/source/
1. README-LITE.md：已完成的交互与边界。
2. src/lite/store.js：七表持久化适配、分页、写队列与字段能力。
3. src/lite/app.js：SDK 初始化、窗口焦点刷新、定期刷新与动作分发。
4. src/lite/attachments.js：图片/文档上传网关及地址规范化。
5. src/lite/demo.js：仅供了解本机 SDK 合约，禁止作为生产云数据库使用。
6. tools/build_lite.py：两个既有构建目标；新增 Sites 目标，不篡改已有产物含义。
7. src/lite/editor.js、timeline.js、board.js、themes.js：保留已有产品行为。
8. docs/superpowers/specs/2026-09-24-oneday-lite-1.3-design.md：经用户确认的完整设计基线。
Git 历史：source-package/git/OneDay-Lite-1.3.bundle；原交接标注基线提交 73471d4。

## 部署实现要求
### 访问与安全
使用 Sites 当前支持的最小访问范围，目标是用户私人使用，不选择“任何互联网用户”。
所有任务/笔记/附件 API 都要在服务端校验真实会话与数据归属，不能只在前端隐藏按钮；不得从客户端传入的 ownerId 判定所有权。
如该账号不支持所需私有发布能力，明确报告限制，不擅自降级为公开个人数据库。
不把令牌、管理员权限、原始凭据写入 HTML 或交接文档。上传文件和下载文件同样受访问控制。

### 数据与跨设备
保留 tasks/logs/notes/tags/links/sets/cal 七类原始记录语义及关系；不必照搬 WorkBuddy 特有的数据库 ID 到真实 Sites 表名。
最小改动接入真实的持久化读写，保存成功只能以服务端确认作为依据。localStorage 只用于偏好或未提交草稿，不作为唯一数据源。
服务端提供合理的分页、版本冲突检查、明确错误响应、写入幂等性；多设备编辑冲突不静默覆盖。
保留记录 ID、父子任务、标签关联、状态日志、Markdown 和附件引用。迁移不得重置用户数据。
导出备份须包含完整业务记录与附件清单；恢复代码版本不等于恢复数据库，更新前先备份数据。

### 附件
使用当前 Sites 支持的真实文件存储契约，不猜测 SDK 名称。
图片、PDF/DOCX 等文档均需上传真实字节；不得返回示例图片、伪 URL、仅存在当前进程的 blob URL。
可保留 TODO工作台-附件 作为逻辑目录前缀，并按用户、任务/笔记、随机文件 ID 组织，但不能宣称这些文件也已写回 WorkBuddy 资料库。
同一文件刷新页面、重启应用、在另一已授权设备打开后仍能访问；未授权会话不能读取。
服务端校验大小和类型、生成安全文件名；文档以附件下载，不能将用户上传的 HTML/SVG 直接作为可信脚本页面执行。

### 界面保持
不新增 Dashboard，不放任务页顶部输入框、不复制新建入口。
保留底部 任务 / + / 笔记、居中日历/看板、五套主题、独立日历格与水位、底部上推各类 Sheet。
保留 Day Sheet 左时间轴右详情、未定时区域、双击子轴、实时 Markdown 编辑、显式并行和看板挤开动画。
需要同步/错误状态时复用现有控件，禁止再堆一行状态面板。

## 验证和实际发布顺序
1. 读取当前 Sites 运行时、认证、数据库及文件 API 的真实契约，再开发适配；不能根据本交接猜 SDK。
2. 复用现有测试，并新增覆盖云持久化、权限、附件真实上传/下载与并发冲突的测试。
3. 至少两个隔离浏览器会话：会话 A 新建/编辑，已授权会话 B 可读到同一记录；未授权会话被拒绝。模拟 SDK 不算这项通过。
4. 测试任务新建、内容编辑、排期、状态计时、笔记新建、Markdown、图片和文档附件；刷新后数据不丢失。
5. 测试再次发布后记录和附件仍存在；第一次与更新发布均禁止重置数据库。
6. 保存可回退的代码版本，按平台要求完成私有发布，打开真实 HTTPS 地址验证。
7. 只有发布工具返回 URL、线上访问和保存验证成功后，才报告“已部署”。如遇首次发布审批，报告具体待点击项。
8. 返回稳定线上 URL、访问范围、存储位置、已通过与未通过的线上验收，以及今后如何在同一 Site 原地更新。

## 原版回归命令（在源码根运行）
python tools/build_lite.py
node --test tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs
python tools/check_lite.py
python tests/lite/experience.py
python tests/lite/screenshots.py

以上属于原版回归；即使全绿，也不代表 Sites 云端验收通过。

## 公开能力参考（以部署时工具和账号实际权限为准）
OpenAI Help Center, Creating and using ChatGPT Sites:
https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites
该官方说明介绍了 Work/Codex 中创建和发布 Sites、数据库与文件存储、访问范围、版本与数据恢复边界。
本包没有对当前账号的 Sites 配额、权限或运行时作出已验证承诺。
