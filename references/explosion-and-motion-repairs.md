# 展开、剖面与动作返修

适用于 Three.js 构建器遇到“滑块能动但零件没分开”“背面黑片”“动画读数对但实体位置不对”的情况。来自实际案例返修；不是上游作者的原始提示词，也不是制造检修顺序。

## 展开是装配设计

先列可拆模块、从属零件、共同轴线、必须先移开的壳体和固定基座。叶片、轮毂、导叶归属同一模块时一起移动；不要把全部内部登记为一个大组，也不要按创建顺序均分距离。

`scene-runtime.js` 顺序为：恢复全部节点 position/quaternion/scale/visible → `setPose` → 顶层展开位移 → 隐藏断开的效果 → 更新世界矩阵。`setPose` 不再读取已展开坐标，也不自行重复添加展开量；迁移旧构建器时检查这一差异。顶点、材质与 uniform 仍由构建器显式重放。

```js
parts: [
  {id:'casing', node:casing, explode:[0,0,3], explodeRange:[0,.3]},
  {id:'stage-a', node:stageA, explode:[-2,0,0], explodeRange:[.3,1]},
  {id:'stage-b', node:stageB, explode:[ 2,0,0], explodeRange:[.3,1]},
  {id:'flow', node:flow, explode:[0,0,0], hideOnExplode:true}
] // 实际构建器同时填写 label、description。
```

- `explodeRange` 是实际展开量中的起止区间，局部使用 smoothstep；省略时兼容旧的线性位移。距离由真实尺寸和观察需求决定，示例数值不是默认要求。
- offset 使用父节点坐标；嵌套转轴由自己的局部坐标驱动。
- 嵌套特效可标 `node.userData.hideOnExplode=true`；不硬编码部件 ID。独显与运行时可见性取交集，不重新开启断开的效果。
- 复用 `motion.js` 已有的装配等待和暂停；实际 amount 收敛为零才走工况时钟，不以目标值为零代替零件归位。

## 用真实间距补上按钮测试的缺口

构建器按需返回有序部件对与世界方向：

```js
explosionChecks: [
  {id:'stage-gap', a:'stage-a', b:'stage-b', axis:[1,0,0], minGap:.4, at:[.5,1]},
  {id:'casing-clear', a:'stage-b', b:'casing', axis:[0,0,1], minGap:.2, at:[1]}
]
```

`auditExplosion(model,{amount})` 读取当前世界矩阵与真实 mesh 顶点（含实例），检查 `min(B)-max(A)`。axis 从 A 指向 B，单位沿用模型；装饰节点排除。蒙皮/形变目标需专用测量，当前明确拒绝。不要另造理想审计代理。

`verify_scene.py` 经过 UI 的 runtime，采样规则声明的 `at`。未配置为 `unconfigured`，非指定姿态为 `not-applicable`。故意把一个模块移回相邻模块内部，报告必须失败，修回后再验证。正投影间距是充分分离条件；负值不单独证明碰撞。本工具不求解全路径避碰或装配可达性。

预览用 `visibleGeometryBounds()` 排除隐藏子树、`auditIgnore` 装饰与 `noFrame` 特效，按当前范围适配安全区。展开时保留观察方向、重新适配缩放。至少查看装配/半拆/全拆、背面和窄屏；数值通过不代替画面中各模块可辨认。

## 剖面与薄片

- `revolvedSection({section:[[z,r]],start,arc,segments})` 生成有实体封口的环形回转截面。输入为简单闭合多边形（不重复首点）、半径为正，支持两种绕序；切面用独立顶点保留平法线。轴上尖端、复杂孔洞和自交截面不在此 helper 范围。
- 核验不同 arc 和两种绕序的正体积、外向切面法线与管口负空间，再看正反视图。不要用 DoubleSide 掩盖封口绕序错误。
- 薄叶片标 `thinSurface=true` 或使用双面材质时不生成反向外扩壳；插画转换保留原 side，避免把整片背面填黑。
- 动态 geometry 更新 attribute/bounds；替换 geometry 时装饰须同步。`dynamicGeometry=true` 可跳过频繁折线重建，轮廓仍跟随真实几何。
- 自定义特效按输出目标处理色域；直接屏幕输出路径包含 `colorspace_fragment`，已有后处理转换时不重复转换。实际编译并观察火焰/流体亮度、透明遮挡和停机帧。

## 动作测量落到实体

| 实际问题 | 实施与验收 |
|---|---|
| 液位沿错轴缩放 | 确认几何局部轴；改变液位后测世界底面固定、顶面与读数一致 |
| 倾转液面随容器倾斜 | 核对世界法线；反向抵消容器旋转时，容器交线仍需另验，可能只是近似 |
| 锤头/压头穿入工件 | 比较真实接触面与工件面；注入过深行程应失败，只验滑块参数不够 |
| 电弧/液柱偏离工具 | 端点取自工具世界变换，检查到目标面的间隙和启停门控 |
| 回放残留/漂移 | 采样 0 → 1 → .5 → 0 和重复状态，比较嵌套姿态、可见性、顶点与读数 |

上述是按题材配置的测量；skill 不自动识别哪个面是锤头、液面或切口。

## 回归与证据来源

运行 `verify_explosion.py --three <0.187.0路径> --report <JSON>`、受影响构件的 `verify_components.py` 和实际构建器的 `verify_scene.py`，随后浏览器操作与审图。数值脚本不证明 shader 编译、画风等效、Blender 或连续碰撞。

历史工程 `D:\code\LeoWang-Wiki\local\anatomy-webgl-ten-3d-20261103` 中的具体对应：

- `web/models-propulsion.js`：涡扇模块；`web/lib/case-pose.js`：案例姿态；`tools/explosion-checks.mjs`：间距反例与归位。
- `web/models-pump.js`、`web/models-thermal.js`、`tools/functional-checks.mjs`：液位、锻锤、倾转液面与工具端点。
- `evidence/visual-review.md`、`evidence/explode-fix/README.md`：原作差异与返修记录。

这些是历史证据位置，不是运行依赖。烘焙 SVG 与部分公开状态函数不等于完整三维资产；按 [来源迁移](source-adaptation.md) 记录边界。通用库以独立回归试件验证，不复制十案例专属 ID、叶片数量或全部工况为通用规则。
