---
name: wireframe-3d
description: 用 Three.js 或 Blender 制作可编辑三维模型、结构拆解、装配与工艺演示。适用于参考图建模和交互结构科普；按用途分别验收外形、构造与运动，不用于制造级 CAD 或物理仿真认证。
---

# Wireframe-3d

把用户的参考与用途变成可编辑三维作品。引擎沿用用户要求；交互网页默认 Three.js，离线工程可选 Blender。一次建模请求包含制作、实际审图和必要返修，完成它们后交付。

## 主流程

### 1. 定形与选例

查看实际输入，确定单位、世界轴、少数关键轮廓、开口和所需功能。标注尺寸优先约束对应测量项，图像估计与不可见部分另记。有旧版就保存关键视图与源码，列出必须保留的形体与功能。

多个相互依赖构件先确定整体包络、主轴/标高和安装位置，再按“整体 → 组件 → 独立编辑或运动的部件”写紧凑计划，注明尺寸依据、局部基准、构造方法和依赖。方法与可执行示例见[分层建模](references/hierarchical-modeling.md)。只有设计方向未定才探索少量候选；明确参考、简单单件和局部返修不强制做多方案或建树。

Three.js 从[示例入口](references/starting-examples.md)选一个构造接近的完整例子，只读相关代码和接口，然后写自己的 subject.js。借用接口组织与构造方法，造型取自本次参考。Blender 走[对应路线](references/blender.md)。复杂外壳按实际面板与特征线分片；不要把所有转折强塞入同一光滑截面。按图建模不自动增加猜测的内部机构。

### 2. 灰模成立，再完成细节

先搭完整灰模，在正交与斜视画面中确认整体比例、负空间和连接。关键局部构造不确定时先做小试件，随后放回主体核对。各部件用读取整体布局的独立构造函数生成；轴件用端点，复杂构件用明确坐标架，复制前先验证一个。原生几何的轴与挤出原点见[坐标与表面](references/geometry-frames.md)。

改尺寸或结构后沿依赖重建受影响部件，再检查完整相关组件；期望值取自参考/设计要求，测量落在实际显示网格。计划树与运行时父子关系分开：现有可拆部件仍是 root 的直接子组。步骤说明须对应实际构造代码或建模操作，不以爆炸动画冒充建模历史。

主体仍有不可见面、折叠、轮廓错误或附件遮挡时留在这一步修正。采样数、参数表、PASS 数量不能代替灰模判断。参考配准与分片建模按需读[参考建模](references/reference-reconstruction.md)。

形体成立后，完成必要的开口、嵌入件、材质和图案。写实产品使用 `renderStyle:'studio'` 与受光材质；明确需要插画才用 anatomy-light。检查玻璃、金属、漆面、橡胶的区别，以及两侧文字的实际阅读方向。

### 3. 接入必要交互

部件用稳定语义 ID 和 rest pose，接入共享 runtime。动作、几何与读数共用状态；暂停冻结变化，复位重现初态，归位后才运行工况。只做用户需要的查看、拆装或演示，接口见[共享状态](references/motion-and-verification.md)。

### 4. 看图、修正、完成

打开实际交付物，查看默认、相反方向和关键近景；有参考/旧版时固定画幅、视角与状态，分别对照灰模和最终材质。实际操作旋转缩放、选择、拆装与复位；有动作就运行周期和极限位置，检查窄屏取景、遮挡与可操作性。截图后必须查看图片。

把最明显的差异转成下一步几何或呈现修改，重新构建并复看。**发现可继续修正的关键缺陷就继续做，不以缺陷清单或“要我继续吗”结束已经授权的建模任务。** 调参无改善时换构造方法；确实缺少必要输入或能力时说明具体阻碍与未完成项，不宣称通过。

最终交付可编辑源、可运行入口、当前版本的关键证据，以及验证范围。保留旧版本和首次生成结果；外部反馈后的返修另记，不覆盖失败记录。

## 运行入口

在独立工作目录写 `subject.js`，导出 `buildScene()`，返回 root、parts、title。导入 `three` 与 `./lib/*.js`。将本次实际 skill 路径下 `assets/web/package*.json` 复制到工作目录的 deps，再执行：

```sh
npm ci --prefix <deps> --ignore-scripts --no-audit --no-fund
python <skill>/scripts/prepare_web.py --builder <subject.js> --three <deps>/node_modules/three --out <web>
python <skill>/scripts/serve_preview.py --root <web> --port 8875
```

使用锁定的 Three.js 0.187.0；额外模块和贴图用 `--extra` 打包。不要修改安装的技能来完成单个案例。完整接口见 [scene-contract](references/scene-contract.md)。

## 按需查阅

| 需要解决的问题 | 入口 |
|---|---|
| 第一个可运行模型与几何接口 | [示例入口](references/starting-examples.md)、[构件库](references/component-library.md)、[Three.js](references/threejs.md) |
| 复杂装配的整体布局、分件、构造顺序与改动传播 | [分层建模](references/hierarchical-modeling.md) |
| 配准、分片曲面、开口、贴附与材质 | [参考工具](references/reference-tools.md)、[坐标与表面](references/geometry-frames.md)、[产品接合](references/product-integration.md) |
| 装配、接触、工况与展开 | [共享状态](references/motion-and-verification.md)、[接口检查](references/interfaces-and-audit.md)、[展开返修](references/explosion-and-motion-repairs.md) |
| 建筑、工厂、已有作品迁移 | [题材方法](references/subject-workflows.md)、[源作品迁移](references/source-adaptation.md)、[显示代码恢复](references/source-render-porting.md) |
| 界面、插画与交付证据 | [预览 UI](references/preview-ui.md)、[插画呈现](references/illustration-style.md)、[证据交付](references/evidence-and-delivery.md) |
| 方法来源、技能回归 | [Anatomy 方法](references/anatomy-workflow.md)、[来源映射](references/source-map.md)、[质量回归](references/quality-regression.md) |

针对实际修改运行检查：`verify_scene.py --builder <subject.js> --three <three目录> --report <JSON>` 验状态与已声明关系；曲面工具验真实三角面。它们不证明轮廓相似、全局外法向、自交或外观质量。未配置/未执行保持原状态；同源端口配对不能证明周围曲面正确。

浏览器证据绑定当前源文件、资源、build ID、相机、状态和视口，遵守当前环境的浏览器工具限制。示意动画不等于动力学，截面裁剪不等于实体封口，窄屏桌面测试不等于真机性能。技能改动分别报告代码检查、开发例、已调优案例和独立新题材；evals/evals.json 是待执行题目，不是通过记录。
