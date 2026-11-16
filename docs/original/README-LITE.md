# OneDay Lite 1.3 — Rich Workspace

OneDay V10 完整版继续保留；Lite 1.3 是独立分支 `feature/lite-1.3-rich-workspace`，目标是把个人任务与长期笔记收敛成一套高信息密度、低入口重复的工作空间。

## 核心交互

- 一级入口只有 **任务 / + / 笔记**；PC 与手机共用同一套底部主 Tab。
- 任务页只保留 **日历 / 看板**。月历不再放顶部快速输入框或重复的“当日任务列表”。
- 点击日期，月历保留在后层，**Day Sheet 从底部推上来并覆盖主 Tab**。
- Day Sheet 左侧是当日时间轴，右侧是当前任务详情；新增当天任务只通过时间轴空白点击/划选。
- 任务详情直接编辑标题、实时 Markdown 内容、属性和日志，不再区分“编辑模式 / 预览模式”。
- 有子任务的主任务双击后，左侧从主轴展开成 **主任务轴 + 子任务轴**；单击只选中并更新右侧详情。
- 时间安排采用 **默认单轨、显式并行**：普通冲突不会自动叠卡；用户明确选择并行后才进入副轨。整体执行时长仍按时间并集去重。
- “便签”在 UI 中更名为 **笔记**；底层仍使用原 `notes` 表，避免线上迁移。
- 全局 `+` 打开 Creation Sheet：任务页默认“任务”，笔记页默认“笔记”；键盘 `/` 复用同一入口。Day Sheet 打开时 `/` 不抢占时间轴新建。

## 1.3 视觉体系

内置五套完整主题，不再把单一黑白灰极简风作为唯一视觉：

- `Glass Day`：明亮玻璃、柔和折射、偶发整组日历高光扫过（默认）
- `Paper`：暖白纸张和墨色阅读感
- `Night`：低亮深色玻璃
- `Color Block`：更强的状态/日期色块识别
- `Minimal`：保留克制的旧 Lite 风格

主题只改变视觉材料，不改变信息架构。日历始终是有间距的独立卡片格；窄屏不会退化成看不清边界的表格。节日/调休/周末/人工休假通过日历标记显示。`prefers-reduced-motion: reduce` 下禁用扫光和多余动效。

## 内容与附件

任务和笔记共用实时 Markdown 编辑器：标题、列表、清单、引用、代码、表格、链接与图片在同一内容面上即时渲染，不再切预览页。

- 图片：调用宿主 `uploadImage`，目标目录标识为 `TODO工作台-附件`。
- 文档：仅当真实 WorkBuddy 宿主提供并验证通用 `uploadFile` 能力时启用；否则明确提示“不支持”，不会伪造成功。
- 本机体验版的上传返回地址仅是预览替身，不能作为 WorkBuddy 云端附件通过证据。

## WorkBuddy 1.3 字段

仍只使用原七张表。任务表建议增加并由宿主能力声明：

- `最后期限`
- `预计时长`
- `允许并行`

如果真实表尚未增加这些字段，Lite 仍可读写原任务；新增属性会禁用并给出说明，不会擅自创建第八张表。

## 文件入口

- `dist/lite/OneDay-Lite-本机体验版.html`：本机示例与体验数据，不跨设备同步。
- `dist/lite/OneDay-Lite-WorkBuddy正式版.html`：宿主注入 SDK 的正式构建，不包含本地模拟数据库。
- `docs/lite/使用说明.md`：产品操作与时间/并行规则。
- `docs/lite/发布与验收.md`：正式上线与跨设备验收。
- `docs/lite/开发交接.md`：源码、字段、附件与实现边界。

## 构建与验证

```bash
python tools/build_lite.py
node --test tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs
python tools/check_lite.py
python tests/lite/experience.py
python tests/lite/screenshots.py
```

浏览器测试使用 Chromium + 模拟宿主，能验证 UI/数据契约和本地交互，**不能替代真实 WorkBuddy 权限、真实上传 API、跨设备与真机触控验收**。
