# 可执行构件与独立主题入口

本目录代码为本技能新增的原创实现，不是原 Anatomy 的几何库，也不是把历史案例完整复制为依赖。所有构件 Z-up；尺寸采用调用者统一的场景单位。`three` 由交付目录的 import map 解析到本地 Three.js 0.187.0。

## 几何 API：`assets/lib/geometry.js`

| 函数 | 输入 / 返回 | 重点与边界 |
|---|---|---|
| `slabGeometry` | `{outline:[[x,y]], holes:[polygon], thickness, bevel}` → Geometry | 真正贯通的平面孔；正 bevel 扩张边界，需自行预留净距 |
| `softenedBox` | `[w,d,h], bevel, material` → Mesh | 按实际尺寸生成，避免缩放单位倒角导致各轴半径失真 |
| `latheShell` | `{profile:[[z,r]], wall, segments}` → Geometry | z 递增，内外壁和两端环面；wall 为径向厚度，不是曲面法向厚度 |
| `revolvedSection` | `{section:[[z,r]], start, arc, segments}` → Geometry | 正半径简单截面全周或部分回转，实体切面独立法线；见 [返修约定](explosion-and-motion-repairs.md) |
| `sweptTube` | `{points:[[x,y,z]], radii:[r], wall, segments, sides}` → Geometry | 空心变径扫掠；各半径对应实际曲线控制点，在采样曲线弧长上插值；不以较短的折线长度错置变径位置。弯折处不保证无自交，需近景/间隙检查 |
| `flange` | `{outerRadius,boreRadius,thickness,boltCircle,boltRadius,boltCount}, material` → Mesh | 中心孔和螺栓孔为真实洞口；螺栓按同一孔距另建，不是物理连接求解 |
| `beam` / `box` / `solid` | 尺寸、端点、材质 → Mesh | 默认投射/接收阴影；不将复杂轮廓强行换成盒体 |
| `seeded` | 整数种子 → 随机函数 | 改模型和对照截图时保持种子不变 |
| `coilSpring` | `{radius,wireRadius,turns,length,segments,sides}, material` → `{mesh,setLength,minimumLength}` | 轴向 Z；改变螺距时保持线径，复用原几何对象以兼容轮廓；长度过短会拒绝。开口线材的示意螺旋，不计算弹力或应力 |

## 曲面 API：`assets/lib/surface-patches.js`

连续曲面产品可先用 `assets/lib/surface-patches.js` 的边界曲面、UV 轮廓裁切、孔壁与局部贴附；API 和可运行曲面试件见 [参考建模工具](reference-tools.md)。它们不自动解算参考图，也不保证曲面拼接的切向连续。

## 建筑 API：`assets/lib/architecture.js`

- `masonryWall({width,height,thickness,course,gap,relief,openings,seed},material)`：X 为宽、Y 为厚、Z 为高，底部 z=0；洞口 `[x0,z0,x1,z1]` 从核心墙体和两面砌块一起扣除。砌块为实例化盒体，有几何起伏；不自动生成拱券、结构过梁或墙转角砌法。
- `framedWindow({width,height,frame,depth,columns,rows},frameMaterial,glassMaterial)`：同一墙面坐标，独立边框/横档/竖梃和简化透明玻璃。几何开口由墙体负责；玻璃不是折射仿真。
- `riverSite({width,depth,resolution,center,halfWidth,waterLevel,bankHeight,bankSlope,baseDepth},landMaterial,waterMaterial)` → `{group,heightAt,center,waterLevel}`：同源河床、水面和渐变河岸，浅基座封底。放石块、植物或基础时采样 `heightAt`；不声称瀑布、侵蚀或水动力。

## 呈现 API：`assets/lib/presentation.js`

`palette(style)` 提供可修改材质；`studioLighting(scene,renderer,bounds,style)` 按场景尺寸配置光照和阴影；`fitOrthographic(camera,controls,bounds,{width,height,direction,insets})` 将当前装配边界放进 UI 安全区，返回可保存的镜头配置。缩放/展开时按需要更新，用户拖动观察时不持续强制复位。镜头配置不能代替和原作同机位比较。

可选 `surfaceDetail` 仅生成低幅微纹理，必须核对 UV/世界尺度与远景闪烁；它不能替代石块、接缝或真实洞口。

产品材质、实际网格锚点与保留部件分组的静态合批现有可执行模块：`materials.js`、`mesh-anchors.js`、`static-batching.js`，接入方式、检查边界及反例见 [产品实际接入](product-integration.md)。`buildScene()` 可返回 `configurePresentation({scene,renderer,camera,controls,bounds,lightRig})`，在通用光照初始化后配置环境反射与主题灯光；不以配置函数存在代替浏览器渲染。

## 新主题无需套用泵的部件名

新建 `subject.js`，导出 `buildScene()`，返回：

```js
return {
  root, // THREE.Group；模型和场地，不含无限大背景平面
  title: '对象名称', style: 'architectural', description: '说明与来源范围',
  renderStyle: 'anatomy-light', // 插画科普用；写实参考显式选 studio 并调材质灯光
  direction: [1, -1.4, 1],
  parts: [{id:'floor-1',label:'首层',description:'构造作用',node:floorGroup,explode:[0,0,1]}]
};
```

每个可拆装 node 必须是 root 的独立直接子组，初始 position 为 rest pose；其内部零件随组运动。同一节点不要重复登记，ID 非空且唯一。模板按 ID 选择、独立查看、白模、装配/展开取景；没有预设 `hub`、`rotor`、`cover`。模板已接入共享时钟与姿态恢复；复杂工况仍需自己的纯状态模型，见 [共享状态与可回放验收](motion-and-verification.md)。

```powershell
$skillDir = 'D:\code\Wireframe-3d'
python "$skillDir\scripts\prepare_web.py" --builder 'D:\scratch\subject.js' --three 'D:\scratch\deps\node_modules\three' --out 'D:\scratch\preview'
```

构建器默认支持导入 `three` 和 `./lib/*.js`；其他资产/模块应随项目明确复制并检查，工具不扫描复制任意本地依赖。已有 `--scene` 泵清单路径继续使用旧模板，保持兼容。

独立验证入口：将 `--builder ...` 换为 `--example river-pavilion` 或 `--example flanged-chamber`。两者是原创测试对象，并不表示对真实建筑或设备的还原质量已通过。

有装配/运动时增加 `assembly`、`setPose({stroke,explode})` 和可选 `strokeLabel`，读 [接口与装配检查](interfaces-and-audit.md)。需要插画表达时使用 [插画渲染](illustration-style.md)；参考外观决定是否改用 `presentation.js` 的普通受光模式或自定义呈现。`--example pneumatic-press` 示范装配与插画，不决定新题材的风格。

`setPose` 还可读取 `time`，返回 `{phase,readout,...}` 供界面与验收使用；可选 `cycleAt(time)` 给出归一化行程。`contact-switch` 演示端接、螺旋弹簧与触点/灯丝的同源状态。不要在 setPose 中不断添加新对象；几何顶点与材质需自行按状态显式恢复。

工厂可从 `--example indexed-workcell` 了解按稳定 ID 的设备构建表、独立时钟和窗口 HOME、实际载荷归属与动态缓存。其构造是原创工具开发夹具，不能替代原 HTML 的外壳/工具细节；完整 API 与 offset 符号约定见 [原显示代码与设备恢复](source-render-porting.md)。
