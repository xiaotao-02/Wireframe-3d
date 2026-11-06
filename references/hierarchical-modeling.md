# 从整体布局到可重建部件

用于包含多个相互依赖构件的产品、机械装配或建筑。简单单件、材质调整和局部返修只记录受影响范围，不强制建树、做多个候选或重做整件。该流程整理已有 Three.js / Blender 建模能力，不调用 SKY-001，也不增加制造级 CAD 承诺。

## 先定整体，再决定拆到哪一级

先用少量全局参数确定外包络、主要轴线/标高、开口与负空间、安装位置，生成完整灰模并查看关键方向。局部方法尚不确定时做小试件，随后放回整机验证。灰模不成立就修改布局或表示方法，不靠增加零件掩盖比例问题。

有明确参考图或已有设计时沿用它；只有用户要探索设计、且方向未定时才比较少量低成本候选。无需每次生成九个方案，也不把等用户挑选设为固定审批步骤。

复杂对象在现有建模记录或源码中维护一份紧凑计划：

`节点 / 所属组件 / 输入尺寸与依据 / 局部坐标和接口 / 构造函数与几何方法 / 上游依赖 / 验收方式`

- 部件按实际装配、材料边界、运动或需要独立编辑的对象划分。场景图和源码模块可以与计划不同，但必须有明确映射。
- 只拆到需要独立构造、修改或验收的粒度；重复螺钉可由阵列构造函数统一管理。不要为数量而分件，也不要把场地当产品零件遗漏在计划外。
- 不可见内部先注明依据、合理化或省略。仅在用户要求内部/剖解时补充必要结构；从照片推断不能标成原始结构或恢复出的原 CAD 历史。
- 每个节点先明确需要得到什么，再选择轮廓挤出、回转、扫掠、分片曲面或建筑构件。稳定 ID 与既有部件保持对应，不能以重新生成之名丢掉不相关细节。

## 把步骤落到代码，逐件验收再集成

全局布局计算一次，构造函数接收相应尺寸、局部基准和材质，返回实际几何/部件；接口读取同一设计基准。例如 `buildPlate(layout)` 用轮廓和孔位生成真实挤出网格，`buildSleeve(layout)` 用环形截面回转，`buildPin(layout)` 用端点定义轴线。步骤说明应能对应这些函数或实际 Blender 操作，不能用动画进度冒充执行历史。

先检查一个代表零件的真实孔、壁厚、端点和局部轴，再复制同族件。接入完整灰模后检查装配位置、相邻表面和整体轮廓；最后完成材质和必要交互。允许按需保存关键中间结果，不要求每一步截图、增加时间轴或实现通用 CAD 内核。

改一个参数时，明确它的归属节点，沿父子和上游依赖找出要重建/复查的构件。小模型直接重新调用构建器最可靠；大项目才按已有缓存设计局部重建。改变几何后重新建立 runtime 的 rest pose 和测量对象，不让旧对象、旧端口或旧证据继续作为新版本结果。修改尺寸、换形体和移装配是不同操作，不能对整组缩放来假装改变壁厚或孔距。

最终复查必须落在显示网格上：计划正确、两端口数值一致，都不能证明孔真的存在或面没有穿插。期望尺寸来自输入要求或设计参数，不从被测网格反推。使用现有 bore/surface/clearance 与灰模审图，不为计划检查另设“外观通过”。

## 可选的可检查计划（Three.js 构建器）

复杂主题可在 `buildScene()` 返回值中增加 `modelPlan`，简单主题可省略：

```js
modelPlan: {
  schema: 'wireframe-model-plan/1', root: 'fixture',
  nodes: [
    {id:'fixture', parent:null},
    {id:'base', parent:'fixture', partId:'base'},
    {id:'cover', parent:'fixture', partId:'cover', dependsOn:['base']}
  ]
}
```

`id` 是计划节点，`parent` 定义组成树，`partId` 将叶节点一一绑定到 `model.parts[].id`；每个运行时语义部件都需要绑定。`dependsOn` 表示本节点读取哪些节点的布局或尺寸，方向为上游 → 本节点。装配接触关系仍放在 `model.assembly`，它们可以成环；不要混入必须无环的构造依赖。

**计划树不改变运行时父子关系。** 当前预览的可拆部件仍是 root 的直接子组，部件内部可有层级。不要为了照搬计划树，把可拆子组嵌入另一可拆组；那会破坏现有展开、选择和 rest pose 契约。

`assets/lib/model-plan.js` 提供：

- `auditModelPlan(model)`：检查单根组成树、叶节点绑定、ID、依赖无环以及实际 root/parts 对应。缺失配置是 `unconfigured`，错误配置是 `fail`。`verify_scene.py` 已接入，老构建器无需修改。
- `affectedPartIds(plan, changedNodeIds)`：列出受影响节点及其下游绑定部件，不修改场景、不自动求解约束、不执行重建。未知 ID 或非法图会报错。

依赖清单由作者声明；工具不会发现漏写的依赖，也不会理解构造函数。因此修改后仍须检查完整相关组件，不能凭这个清单跳过装配和视觉复查。Blender 可采用同样的计划/函数/局部坐标思路，但这里的 JS 检查器不验证 Blender 对象。

## 可运行开发例与检查

[stacked-fixture.js](../assets/examples/stacked-fixture.js) 是原创双柱支撑组件：底板、上板、两只空心支撑套、两根带头定位销，共六个语义部件。单位 mm，没有指定真实产品参考，不是 SKY-001 的输出。它展示：

- `makeLayout()` 决定孔距、高度和上板标高；各构造函数显式读取这些量。
- 组成树是“组件 → 框架/销 → 零件”，实际可拆组仍平级。
- 改孔距会移动真实孔和套/销；改套高会改变上板高度和销长；重新构建后保留稳定 ID。
- 声明支撑、同轴和实际孔探针。独立测试直接检查网格位置、贯通和轴端点；故意保留旧上板高度或错移上板网格会失败。

```powershell
$skillDir = '<本次技能目录>'
$threeDir = '<已安装的 node_modules/three>'
$workDir = '<本次工作目录>'
node "$skillDir/scripts/verify_hierarchical_modeling.mjs" --three $threeDir --report "$workDir/hierarchy.json"
python "$skillDir/scripts/verify_scene.py" --builder "$skillDir/assets/examples/stacked-fixture.js" --three $threeDir --report "$workDir/scene.json"
python "$skillDir/scripts/prepare_web.py" --builder "$skillDir/assets/examples/stacked-fixture.js" --three $threeDir --out "$workDir/web"
python "$skillDir/scripts/serve_preview.py" --root "$workDir/web" --port 8875
```

网页用原有选择、独显、灰模、展开和复位查看，不新增设计参数面板。参数变体在自己的构建器中调用 `buildScene({pitch:56,standHeight:32,coverThickness:7})` 后重新打包；开发例的回归脚本覆盖默认值及两组变体。计划、网格、视觉和独立新题材分别记录，不用该开发例宣称任意产品的建模质量提升。

方法启发：[SKY-001 官方技术介绍](https://skyfall.ai/blog/introducing-sky-001)中的层级规划与逐件构造。这里落实的是工作组织、已有几何 API 与可执行校验；没有迁移其未公开模型、训练数据或评测结论，也不把生成的网格描述成参数化 CAD 特征历史。
