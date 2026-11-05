# 来源与迁移映射

核验日期：2026-11-03。来源只证明其自身实现；以下 Three.js / Blender 方法是本技能重新实现的迁移方案。

| 来源与固定版本 | 已读文件/函数 | 继承的思想 | 本技能实现与验收 |
|---|---|---|---|
| [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy/tree/1482e8469b0a9e0d8cc18ea2740a01423d29ae80) | `SKILL.md`：物理对象、part inventory、状态驱动和 reduced-motion | 功能性细节解释机制；同一状态驱动读数与视觉 | 部件表 + 语义 ID；检查相位与几何、暂停、复位 |
| 同上 | `kit/iso-kit.mjs`；`kit/lathe.mjs`；`kit/tube.mjs` | 在世界坐标描述形状，回转/管路不是随意屏幕形状 | 真实 3D mesh，统一坐标和单位；检查空腔、壁厚及背视图。**不使用其 SVG 投影作为 Three.js 建模依赖** |
| 同上 | `kit/audit.mjs`：`clearances`、`terminals`、`supports`、`solidClearances`、`explodeStates`、`audit` | 在装配和拆解状态检查接触、支撑、间隙 | V5 的 assembly.js 独立实现端口世界坐标、配合/导向/支承图、实际网格孔/表面探针与指定零件对三角形间隙；不宣称移植整个 audit |
| 同上 | `kit/turn*.mjs` 与技能 3D beta 描述 | 观察方向变化后重新投影对象 | Three.js 原生相机 + z-buffer；Blender 原生场景。上游可旋转 SVG 不是这两个引擎 |
| [Sentheecode/factory-anatomy](https://github.com/Sentheecode/factory-anatomy/tree/1b0b1e574ec144105a4c8f56bc58164b9128a786) | README；`figures/paintshop-3f-desktop-light.html`：`bodyState`、`computeEntities`、`applyEnts`、`robotPose`、`draw`、`tick` | 多层车间、工艺路线、设备与载具按状态协作 | 初始泵示例仅提炼分组规范；后续指定案例测试继承公开 DATA 与纯状态函数，重建三维设备，完成完整周期和浏览器验收；见 source-adaptation.md |
| 同上 | `figures/edu-drive-unit-light.html`：`setApart`、`select`、`steerSpring`、`place`、`tour` | 拆解、选中说明、导览与运动状态分离 | 爆炸参数、部件选择、相位控制；核对半拆/全拆/复位。示例未移植弹簧或自动导览 |

## 当前名称与兼容

本次继续学习同一固定版本，新增迁移：

| 上游来源 | 采用的方法 | 当前独立实现 |
|---|---|---|
| `references/craft.md`：parts vocabulary / contacts / curved pipes | 细节来自构造用途；端点正确不能代替中途净距 | `references/anatomy-workflow.md`；按钮六个端面与三条真实导线对底板检查 |
| `references/motion.md`：arming / reduced motion / pure time functions | 等实际归位才启动；读数与姿态同源；手动接管 | `assets/lib/motion.js`、`scene-runtime.js` 与新版 `studio.js`；独立时钟及嵌套 rest pose |
| `references/verify.md`、`scripts/capture.mjs` / `drive.mjs` | 实际浏览器截图、状态动作、窄屏和错误日志共同验收 | `scripts/verify_preview.mjs`，原创 Node/CDP 工具；不依赖或复制上游浏览器脚本 |
| `examples/push-button/build.mjs` | 弹簧按钮、触片、电源与灯构成可观察的闭合回路 | `assets/examples/contact-switch.js` 的独立 Three.js 几何与接口；没有复制 SVG 资产，不继承其额定电压/电流 |
| `evals/evals.json` | 用任务提示和预期行为验证技能效果 | 本技能 `evals/evals.json` 的 5 个独立任务，题目列表不等于执行通过 |

这些新增运行时、几何与验证脚本为重新实现。`contact-switch` 属于开发验证例；压装台/建筑例属于回归；独立评测题尚需新输入和独立运行。共享 Three.js 状态功能未接入 Blender 或旧泵页面。

本技能现名 **Wireframe-3d**，调用标识 `$wireframe-3d`，源码目录 `D:\code\Wireframe-3d`。原名 anatomy-3d 的历史验证目录保留；`anatomy-3d/1` 场景格式、`ANATOMY_CONTROLS` 控制节点与 `anatomy-light` 风格预设保持兼容。这些历史标识和 Anatomy 上游署名不是未完成改名。

## 项目定位

`anatomy` 含可安装 SKILL 与 SVG/可选 WebGL 辅助工具。`factory-anatomy` 是使用该思路制作的工厂 HTML/SVG 作品集，当前固定版本没有独立 `SKILL.md`；不能将两者都描述为已存在的 3D 引擎技能。

附带泵示例没有将上游源码模块嵌入运行时，也没有导入其作品资产，代码和模型为原创。后续 Raptor / 涂装案例明确复用源几何记录、坐标与纯状态逻辑，渲染和部分几何重建；案例实现保存在独立验证目录，不是泵模板的新增运行依赖。未继承上游固定时长、固定部件数量或与本任务无关的审批流程。

## 授权

2026-11-05 的重构继续依据同一 Anatomy 固定版本：将“先打开最接近的完整示例”落实为 `starting-examples.md` 和 `optical-sensor.js`，保留 `contact-switch` 的状态/连接示范。端点圆柱、局部曲面域、共享显示孔边的凹腔、贴花 UV 与实际三角面审计均为本库独立实现；浮点裁切交点合并修复来自本次真实预览失败。没有移植 SVG painter order、固定部件数量、统一画风或禁止按参考复刻的规则。开发示例、故障注入和 mcode 独立任务验收分别记录。

两来源均为 MIT：Anatomy 为 Copyright (c) 2026 Ryan；factory-anatomy 为 Copyright (c) 2026 Senthee Wu。完整通知见 `licenses/`。如果后续复制其代码或资产，连同原通知分发；示例使用的 Three.js MIT 由准备脚本复制到 `web/vendor/THREE-LICENSE.txt`。

## 当前验证范围

工厂问题复盘后的 `factory-process.js`、投影控制点检查、证据记录检查和源码快照工具为本技能独立实现；时序约定参考固定源 `draw()` 的调用条件，具体映射见 [source-render-porting.md](source-render-porting.md)。`indexed-workcell` 是原创压装/检测/缓存开发例，不是原五车间资产或独立评测。它不依赖原案例目录，验证不能外推到旧案例或 Blender。

2026-11-03 的 V4 补充：`assets/lib/` 的建筑、机械和呈现工具、`buildScene()` 通用入口以及两个原创试件均为独立新增实现；不依赖 Raptor、涂装或流水别墅案例源文件。构件脚本检查孔/壁厚/确定性和镜头安全区，浏览器检查另行记录。新 JS 工具未迁移到 Blender；流程改进不能视作任意参考模型的复刻验收。

已创建双引擎泵示例；实际验证记录存于本次产物目录，不把这份文档当作自动执行证据。库版本固定为 Three.js 0.187.0；Blender 首次验证环境为 5.2.1 LTS。后续 Raptor 与三层涂装车间已完成 Three.js 实际运行，证据入口见 source-adaptation.md；不同机器、移动端 GPU、实体剖切、GLB 导出、视频成片，以及这两例的 Blender 工程仍需单独验证。

2026-11-03 的 V5 补充：`references/craft.md` 的 tone/浅色细线层次，以及 `paintshop-3f-desktop-light.html` 的纸面/面色/描边 tokens，成为 `illustration.js` 的来源。片元法线明暗、屏幕尺度轮廓壳、深度测试折线、接触晕影和接口检查器均为本技能新增实现；保留两源 MIT 通知。压装台为开发验证，另以独立制作的蝶阀管段验证新主题 API，实际截图与测试保存在该次交付包，不作为任意对象成功的保证。
