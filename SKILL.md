---
name: wireframe-3d
description: 用 Three.js 或 Blender 制作可编辑三维模型、结构拆解、装配与工艺演示。适用于参考图建模和交互结构科普；按用途分别验收外形、构造与运动，不用于制造级 CAD 或物理仿真认证。
---

# Wireframe-3d

根据用户参考和用途制作可编辑三维作品。参考建模以轮廓、比例和辨识特征为准；结构讲解以真实连接和可理解的动作为准。引擎沿用用户要求，交互网页默认 Three.js，离线工程或镜头动画可选 Blender。

## 主流程

### 1. 选对构造起点

查看实际输入，提取决定辨识度的轮廓、比例、开口和所需功能。尺寸标注、图像估计和不可见结构分开。有旧版时保留源码与关键视图，明确哪些形体和功能必须保留。

Three.js 任务先从 [示例入口](references/starting-examples.md) 选择一个构造方法接近的完整示例，查看构建器、使用的接口和预期画面，再写独立 subject.js。沿用它的接口组织，造型由本次参考决定；不要把示例零件数量、外观或题材参数带入新对象。Blender 直接走 [Blender 路线](references/blender.md)。

规则机械件适合回转/扫掠/端点轴件；连续外壳用可控截面或共享边界曲面；装配机构另列部件之间的支承、接触与运动关系。网页引擎不限制几何制作工具，用户要求纯程序化时保留该约束。按图建模不自动增加猜测的内部机构。

### 2. 建立主体并实际看图

先做最影响辨识、最难表达的局部原型，检查实际灰模后扩展主体。轮组方向、窗面、孔腔和附件连接在画面中成立后再做涂装。构造参数正确、增加采样数都不能代替外形判断。

优先复用示例中适用的构件：轴件由端点定位，开口与孔壁共享边界，局部窗口先建立自己的参数域再采样。自写替代 helper 先验证小样的轴向、闭环索引、朝向和贴图。曲面工具提供真实三角面检查；未覆盖的折叠、接缝与轮廓仍需看图。具体接口见 [构件库](references/component-library.md)，参考配准或复杂外壳再读 [参考建模](references/reference-reconstruction.md)。

### 3. 完成材质和必要交互

参考与用户要求决定风格。写实产品用受光材质；明确需要插画表达时用 anatomy-light。材质、灯光与贴花应支持已经成立的形体；检查玻璃、金属、漆面、橡胶的区别及文字方向。

按语义建立部件 ID、归属和 rest pose，使用共享 runtime 完成查看与拆装。需要动作时让几何、动画和读数共用状态；暂停冻结相关变化，复位可重复，实际归位后才运行工况。展开按装配分组；断开的流路不继续显示连通效果。接口与例子见 [共享状态](references/motion-and-verification.md)。

### 4. 对照、返修、交付

在真实浏览器或 Blender 中打开交付物，检查默认视图、另一观察方向和影响辨识的近景；有动作就运行完整流程。网页再检查窄屏可操作性。截图后要实际查看图片；日志、DOM、面数与 PASS 数量不评定外形质量。

有参考或旧版时，固定视角、画幅、状态，分别比较灰模形体、最终材质与原有功能。修最明显的差异，再重看受影响视图。不得用涂装/检查项增加抵消主体变差，也不删除旧功能来宣称完成同一任务。

存在能继续修正的关键外形缺陷时继续返修。交付可编辑源、可运行入口和关键证据，说明已验证与未验证项。评估 skill 改动时使用 [质量回归](references/quality-regression.md)，把首次交付、模型内部自检和外部反馈后的返修分别记录。

## 实现入口：按任务选择

| 当前需要 | 入口 |
| --- | --- |
| 第一个可运行模型、选择构造示例 | [示例入口](references/starting-examples.md) → 相关构建器；[Three.js 打包](references/threejs.md) |
| 参考图约束、分片曲面、开口与附件 | [参考工具](references/reference-tools.md)、[产品材质与接合](references/product-integration.md) |
| 拆解、机构状态、装配与间隙 | [共享状态](references/motion-and-verification.md)、[接口检查](references/interfaces-and-audit.md)；出现展开问题再读 [展开返修](references/explosion-and-motion-repairs.md) |
| 建筑、机械、工厂选型或源作品迁移 | [题材方法](references/subject-workflows.md)、[源作品迁移](references/source-adaptation.md)；工厂设备与时序见 [显示代码恢复](references/source-render-porting.md) |
| 插画、界面或交付链问题 | [插画呈现](references/illustration-style.md)、[预览 UI](references/preview-ui.md)、[证据与交付](references/evidence-and-delivery.md) |
| Blender 工程 | [Blender 路线](references/blender.md)；Three.js 的新工具需分别实现与验证 |

使用独立 subject.js 导出 buildScene()。先复制 assets/web/package*.json 到本次工作目录的 deps/，在 deps/ 安装锁定依赖，再生成网页：

```sh
npm ci --prefix <deps目录> --ignore-scripts --no-audit --no-fund
python scripts/prepare_web.py --builder <subject.js> --three <deps/node_modules/three> --out <web目录>
python scripts/serve_preview.py --root <web目录> --port 8875
```

构建器导入 three 与 ./lib/*.js，输出目录由 prepare_web 提供这些依赖。额外模块/贴图通过 --extra 明确打包；Three.js 固定为 0.187.0。示例展示完整接入方式，不替代用户参考。共享数据见 [scene-contract](references/scene-contract.md)。

## 检查的边界

- 审计引用显示树中的真实网格。接口关系、实际曲面接合、轮廓相似度是不同问题；同坐标生成的两个端口配对不能证明周围表面正确。未配置/未执行保持该状态。
- 对本次新增或修改的关键几何运行针对性检查，例如裁孔范围、退化面、接缝偏差；需要时用故意改坏的实际几何检验检查器。只测适用对象，不把封闭实体规则套到开放曲面。
- 可用 verify_scene.py --builder <subject.js> --three <three目录> --report <JSON> 检查状态与已声明关系；它不能代替网格质量和审图。verify_preview.mjs 绑定实际 build ID、相机、状态及视口，使用方式见共享状态文档，并遵守当前环境的浏览器工具限制。
- 参考来源、原创/改编、实际运行与判断分别记录。机制说明需要依据；示意动画不等于动力学，裁剪平面不等于带封口实体剖切，桌面窄屏不等于真机性能。
- Anatomy 的方法来源与本项目独立实现见 [来源映射](references/source-map.md)；[制作方法](references/anatomy-workflow.md) 按需参考。保留上游授权，不能把案例代码说成通用依赖。

修改技能后按变更选择代码回归与真实建模任务；evals/evals.json 是待运行题目。开发例、已调优案例、独立新题材分别报告，单个案例改善不代表泛化已经证明。
