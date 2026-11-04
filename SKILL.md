---
name: wireframe-3d
description: 用 Three.js 或 Blender 制作可编辑三维模型、结构拆解、装配与工艺演示。适用于参考图建模和交互结构科普；按用途分别验收外形、构造与运动，不用于制造级 CAD 或物理仿真认证。
---

# Wireframe-3d

根据用户的参考和用途制作三维作品。先让主体成立，再完成所需交互；工具检查和画面质量分别验收。

## 主流程

### 1. 确定本次目标

查看实际输入，提取决定辨识度的轮廓、比例、开口、材质和必要功能。标注尺寸、图像估计与不可见结构分开。沿用用户已给的要求；没有尺寸时说明示意比例。

按图建模优先还原可见外观，不自动增加猜测的发动机、工况动画或复杂面板。结构科普优先讲清部件之间如何作用。有旧版本时先保存源码与截图，列出需保留的外形、细节和功能，作为返修基线。

### 2. 建立主体并实际看图

先验证最影响辨识、最难表达的部位，再扩展完整主体。选择能独立控制关键形体的表示：规则构件可用回转/扫掠；连续外壳可用共享边界曲面或细分网格。已有方法能表达目标就复用；不为套库而改造型，也不把增加采样数当作形体改进。

在受光灰模中核对轮廓、部件方向、开口和接合：侧视的轮组、正视的孔口等必须在实际画面成立，构造参数正确不算通过。发现错轴、折面、裂口、悬浮附件或占位形体，先修几何再做涂装。优先使用已验证的构件与裁切接口；自写替代 helper 先用小样验证原语局部轴、闭环顶点/索引与曲面映射。局部裁孔/吸附须限制作用区域，并检查输出三角面。连续外壳的具体方法见 [参考建模](references/reference-reconstruction.md) 和 [曲面返修](references/vehicle-surface-repair.md)，只读当前问题相关段落。

### 3. 完成材质和必要交互

参考与用户要求决定风格。写实产品用受光材质；明确需要插画表达时用 anatomy-light。材质、灯光与贴花应支持已经成立的形体；检查玻璃、金属、漆面、橡胶的区别及文字方向。

按语义建立部件 ID、归属和 rest pose。需要动作时让几何、动画和读数共用状态；暂停冻结所有相关变化，复位可重复，装配实际收敛后才运行工况。展开不能拉断同组构件；断开的流路不继续显示连通效果。优先复用共享 runtime，不按对象创建顺序绑定交互。

### 4. 对照、返修、交付

在真实浏览器或 Blender 中打开交付物，检查默认视图、另一观察方向和影响辨识的近景；有动作就运行完整流程。网页再检查窄屏可操作性。截图后要实际查看图片；日志、DOM、面数与 PASS 数量不评定外形质量。

有参考或旧版时，固定视角、画幅、状态，分别比较灰模形体、最终材质与原有功能。修最明显的差异，再重看受影响视图。不得用涂装/检查项增加抵消主体变差，也不删除旧功能来宣称完成同一任务。

存在能继续修正的关键外形缺陷时继续返修，不以列出差异后询问“是否继续”结束。交付可编辑源、可运行入口和关键证据，简述已验证与未验证项；确有输入或能力阻碍时说明具体限制。版本比较和技能更新使用 [质量回归](references/quality-regression.md)；它不替代实际看图。

## 实现入口：按任务选择

用户指定引擎时遵守；未指定的交互网页默认 Three.js，可编辑离线工程或镜头动画选 Blender。网页引擎不限制几何制作工具；用户要求纯程序化时保留该约束。

| 当前需要 | 入口 |
| --- | --- |
| Three.js 页面、buildScene()、语义部件、基础构件 | [Three.js 路线](references/threejs.md)、[构件接口](references/component-library.md) |
| 参考图约束、分片曲面、开口与附件 | [参考工具](references/reference-tools.md)、[产品材质与接合](references/product-integration.md) |
| 拆解、机构状态、装配与间隙 | [共享状态](references/motion-and-verification.md)、[接口检查](references/interfaces-and-audit.md)；出现展开问题再读 [展开返修](references/explosion-and-motion-repairs.md) |
| 建筑、机械、工厂选型或源作品迁移 | [题材方法](references/subject-workflows.md)、[源作品迁移](references/source-adaptation.md)；工厂设备与时序见 [显示代码恢复](references/source-render-porting.md) |
| 插画、界面或交付链问题 | [插画呈现](references/illustration-style.md)、[预览 UI](references/preview-ui.md)、[证据与交付](references/evidence-and-delivery.md) |
| Blender 工程 | [Blender 路线](references/blender.md)；Three.js 的新工具需分别实现与验证 |

使用独立 subject.js 导出 buildScene()，生成网页：

```sh
npm ci --prefix assets/web --ignore-scripts --no-audit --no-fund
python scripts/prepare_web.py --builder <subject.js> --three assets/web/node_modules/three --out <web目录>
python scripts/serve_preview.py --root <web目录> --port 8875
```

构建器导入 three 与 ./lib/*.js。额外模块/贴图通过 --extra 明确打包；Three.js 固定为 0.187.0。现有 assets/examples/ 仅供查 API 与运行验证，不替代用户参考。共享数据见 [scene-contract](references/scene-contract.md)。

## 检查的边界

- 审计引用显示树中的真实网格。接口关系、实际曲面接合、轮廓相似度是不同问题；同坐标生成的两个端口配对不能证明周围表面正确。未配置/未执行保持该状态。
- 对本次新增或修改的关键几何运行针对性检查，例如裁孔范围、退化面、接缝偏差；需要时用故意改坏的实际几何检验检查器。只测适用对象，不把封闭实体规则套到开放曲面。
- 可用 verify_scene.py --builder <subject.js> --three <three目录> --report <JSON> 检查状态与已声明关系；它不能代替网格质量和审图。verify_preview.mjs 绑定实际 build ID、相机、状态及视口，使用方式见共享状态文档，并遵守当前环境的浏览器工具限制。
- 参考来源、原创/改编、实际运行与判断分别记录。机制说明需要依据；示意动画不等于动力学，裁剪平面不等于带封口实体剖切，桌面窄屏不等于真机性能。
- Anatomy 的方法来源与本项目独立实现见 [来源映射](references/source-map.md)；[制作方法](references/anatomy-workflow.md) 按需参考。保留上游授权，不能把案例代码说成通用依赖。

修改技能后按变更选择代码回归与真实建模任务；evals/evals.json 是待运行题目。开发例、已调优案例、独立新题材分别报告，单个案例改善不代表泛化已经证明。
