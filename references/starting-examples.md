# 从可运行示例开始

按构造方法选择一个，先看源码与实际预览，再替换为本次对象。无需把全部示例和参考文档读入上下文。所有示例是开发教学例，不是独立生成评测，也不保证新题材的外形质量。

| 任务 | 先打开 | 重点看 | 预览时应看到 |
|---|---|---|---|
| 连续曲面、局部窗口、贴花与附件 | [optical-sensor.js](../assets/examples/optical-sensor.js) | 同一曲面生成上盖/凹腔/窗口；局部 UV 域；端点轴件；贴附标记 | 完整传感器壳体，窗口内凹、孔壁连续，玻璃不折叠，铭牌正读 |
| 有接触和运动的机械讲解 | [contact-switch.js](../assets/examples/contact-switch.js) | 底座/导向/触点/弹簧/接线；setPose 同时驱动间隙、弹簧和灯态 | 按下才闭合，松开分离；拆开断路；暂停不漂移，复位重现初态 |
| 整体参数、分层计划与逐件构造 | [stacked-fixture.js](../assets/examples/stacked-fixture.js) | makeLayout → 板/套/销函数；计划树绑定平级部件；真实孔探针 | 孔距、支撑高度与销长联动；选择、展开与复位可用，见[分层建模](hierarchical-modeling.md) |
| 回转壳体、法兰和真实孔洞 | [flanged-chamber.js](../assets/examples/flanged-chamber.js) | 回转截面与孔距；语义部件 | 法兰孔透空，背视可看到壳体厚度 |
| 建筑墙板、窗洞与场地 | [river-pavilion.js](../assets/examples/river-pavilion.js) | 构件尺寸、开口与地形接合 | 墙体窗洞真实、构件有支承，远近视图均可读 |
| 多工位、载荷与阶段联锁 | [indexed-workcell.js](../assets/examples/indexed-workcell.js) | 纯状态、设备 ID、载荷归属、实际归位 | 载荷随所属设备移动，不隔空跳转，暂停与 HOME 有效 |

`curved-shell` 保留为最小曲面试件，`pneumatic-press` 保留为装配/插画试件；原有命令与文件路径兼容。它们适合定位问题，复杂产品优先看完整对象示例。

## 运行并建立自己的构建器

```powershell
$skillDir = '<本次实际 skill 目录>'
$workDir = 'D:\scratch\my-model'
New-Item -ItemType Directory -Force "$workDir\deps" | Out-Null
Copy-Item "$skillDir\assets\web\package*.json" "$workDir\deps"
npm ci --prefix "$workDir\deps" --ignore-scripts --no-audit --no-fund
python "$skillDir\scripts\prepare_web.py" --example optical-sensor --three "$workDir\deps\node_modules\three" --out "$workDir\example-preview"
python "$skillDir\scripts\serve_preview.py" --root "$workDir\example-preview" --port 8875
```

查看预览，理解 API 后，在工作目录写独立 `subject.js`，用 `--builder` 替代 `--example`。不要修改安装的技能来完成单个案例。`buildScene()` 返回 `root`、`parts`、`title`；每个可拆部件是 root 的独立子组，稳定 ID 和初始 rest pose 随源码保存。完整约定见 [构件接口](component-library.md)。

## 连续外壳的最小接入

```js
import {cylinderBetween} from './lib/geometry.js';
import {surfaceRegion,trimmedGridGeometry,recessedOpeningGeometries,
  surfaceDecalGeometry,auditSurfaceGeometry} from './lib/surface-network.js';

// point(u,v) 描述你设计的主体；u/v 都在 0..1。方向由这个参数化决定。
const windowSurface = surfaceRegion(bodySurface, {
  u:[.35,.65], v:[.3,.6], offset:-.01
});
const glassGeometry = trimmedGridGeometry(windowSurface, {uSegments:32,vSegments:24});
const opening = recessedOpeningGeometries(bodySurface, {
  hole:windowOutlineUV, depth:.04, uSegments:64,vSegments:40
});
// opening.skin / wall / back 分别赋材质，同一边界生成；back:false 表示贯通孔。
const wheelAxle = cylinderBetween(leftEnd,rightEnd,radius,metal);
const label = surfaceDecalGeometry(bodySurface, {
  u:[.4,.6],v:[.1,.2],offset:.001,flipU:false,flipV:false
});
const report = auditSurfaceGeometry(glassGeometry);
```

采样数作用于 `windowSurface` 自己的范围。不要把窗口轮廓仍当作主体全局 UV 输入；`mapUV(s,t)` 可从局部换回主体参数。贴花翻转通过 flipU/flipV 改纹理坐标，避免反射整个几何。用实际文字小样检查两侧的可读方向。

主体法向来自 `∂u × ∂v`。`reverse` 同时翻转三角绕序和光照法线；向内凹的位移沿外法向的负方向。先确保主体连续：镜像接缝如果切向不连续，沿法线偏移可能折叠，不能靠双面材质掩盖。`auditSurfaceGeometry` 检查实际三角面退化与法线冲突，但面与法线同时朝内仍可能通过；从外侧用单面材质实际查看。接缝、自交与轮廓仍需灰模和近景判断。

复杂回转件、挤出件和部件组可用 `placeInFrame(object,{origin,x,y,anchor})` 明确轴向与局部锚点。完整示例的侧旋钮演示原生 Y 轴回转体转到 X 轴，方法见[坐标与表面](geometry-frames.md)。

`recessedOpeningGeometries` 当前处理单个孔口，背板是沿实际采样边界内偏后的三角盖；不做恒定壁厚实体或高曲率内腔求解。多个孔、外壳厚度和光滑内壁按对象另构造。完整 API 与边界见 [构件接口](component-library.md) 和 [曲面工具](reference-tools.md)。
