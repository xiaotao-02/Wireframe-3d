# Wireframe-3d

用于制作可交互三维结构科普、机械拆解、装配演示与工厂工艺可视化的 AI Agent Skill。默认使用 Three.js 交付交互网页，也提供 Blender 工作流和共享泵模型示例。

技能入口：[SKILL.md](SKILL.md) · 调用标识：`$wireframe-3d` · [版本演变](HISTORY.md)

## 能做什么

- 用真实三维几何组织部件、装配关系、孔洞、管壁和结构细节。
- 制作旋转观察、分阶段爆炸视图、部件选择、暂停与复位等交互。
- 以共享状态驱动几何、动画和读数，检查接口、间隙、行程与工序交接。
- 根据参考图开展建模、固定相机对照与返修，并保留来源和交付证据。
- 使用可编辑构件库、示例和验证脚本作为新主题的起点。

结构与交互检查通过，不代表外观已经匹配参考。此项目面向三维表达和机制讲解；制造级 CAD、工程精度和物理仿真需要另外的工具与验证。

## 获取项目

```sh
git clone https://github.com/xiaotao-02/Wireframe-3d.git
cd Wireframe-3d
```

使用技能时，将完整仓库提供给支持 `SKILL.md` 的 Agent，保留 `references/`、`scripts/` 和 `assets/` 的相对位置。具体工作流和按需阅读入口见 [SKILL.md](SKILL.md)。

## 快速运行网页示例

准备 Python 3、Node.js 与 npm，在仓库根目录执行：

```sh
npm ci --prefix assets/web --ignore-scripts --no-audit --no-fund
python scripts/prepare_web.py --example pneumatic-press --three assets/web/node_modules/three --out _output/pneumatic-press
python scripts/serve_preview.py --root _output/pneumatic-press --port 8875
```

打开终端显示的本机地址（默认 `http://127.0.0.1:8875/`；端口占用时会选择后续空闲端口）。不要直接双击生成的 HTML 运行模块页面。

Three.js 固定为 **0.187.0**，依赖版本由 `assets/web/package-lock.json` 锁定。生成器会将运行时和授权文件复制到输出目录，生成的页面不依赖 CDN。

可用示例：`pneumatic-press`、`contact-switch`、`indexed-workcell`、`river-pavilion`、`flanged-chamber`、`curved-shell`。这些示例用于开发和工具验证，不是任意参考对象的复刻成果。

自定义主题使用 `--builder <subject.js>`，由模块导出 `buildScene()`；接口见 [构件库与主题接口](references/component-library.md)。Blender 路线见 [Blender 工作流](references/blender.md)。

## 目录

| 路径 | 内容 |
| --- | --- |
| `SKILL.md` | 技能说明、工作流与验收要求 |
| `agents/` | Agent 展示信息和默认提示 |
| `assets/lib/` | Three.js 几何、装配、运动、材质与验证辅助库 |
| `assets/examples/` | 可编辑的主题构建器 |
| `assets/web/` | 交互预览、参考对照页面与依赖锁文件 |
| `scripts/` | 网页准备、场景生成、审计与回归工具 |
| `references/` | 主题指南、数据约定、来源映射与验收方法 |
| `evals/` | 待执行的技能评测任务 |
| `licenses/` | 上游授权通知 |

## 检查与验收

现有状态与项目工具回归可直接运行：

```sh
npm test
python scripts/project_tools.test.py
```

参考约束测试需要 Pillow；安装后运行 `python scripts/reference_constraints.test.py`。设置环境变量 `WIREFRAME_TEST_THREE` 为已安装的 `node_modules/three` 路径，可同时运行该测试文件中的打包回归。

几何、装配、展开及浏览器验收按改动范围执行，详见 [共享状态与可回放验收](references/motion-and-verification.md)。数值测试不能替代真实浏览器画面检查；Three.js 测试也不代表 Blender 验证通过。

`evals/evals.json` 是评测提示集合，不是执行报告。部分参考文档保留本机历史证据路径，仅用于追溯，不是运行依赖，也不表示这些证据文件包含在本仓库中。

## 来源与授权通知

本项目借鉴 [Anatomy](https://github.com/wheresryan22/anatomy) 的部件语义与状态驱动方法，以及 [factory-anatomy](https://github.com/Sentheecode/factory-anatomy) 的工艺表达方法。Three.js / Blender 的实现范围和对应来源见 [来源与迁移映射](references/source-map.md)。

两项上游来源的 MIT 通知分别保留在 [ANATOMY-LICENSE.txt](licenses/ANATOMY-LICENSE.txt) 和 [FACTORY-ANATOMY-LICENSE.txt](licenses/FACTORY-ANATOMY-LICENSE.txt)。Three.js 的授权文件随生成页面复制。上游授权通知不等同于本仓库新增内容的统一许可证。
