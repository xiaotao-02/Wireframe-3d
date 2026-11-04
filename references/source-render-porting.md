# 从原 HTML 恢复设备与动作

用于已有 Anatomy / Factory Anatomy HTML 的 Three.js 改编。以下为五车间 V2 的实施经验，不是原作者提示词，也不代表 Blender 已通过同样验证。

## 先选一个有辨识度的工位

打开原 HTML，暂停在明确工况。保留总览、功能近景、源版本、时间和相机方向。先核对这个工位的外轮廓、工作空间、夹具、末端工具、物料和接口，再扩展同型号设备。不要用同一框架乘以工位数量替代不同机器。

设备映射使用稳定 ID 和明确表；分类应能解释形体差异。例如电驱页 `stapress`、`dyno`、`vpi` 分别需要压装头、水平测试夹具、浸漆容器。名称正则只适合检索，不能成为全部设备造型的唯一依据。

## 动态绘图代码也是几何来源

`robotSvg` / `toolSvg` 常包含 FK 之外的壳体宽厚、关节半径、护罩、电缆和工具。保留这些参数，将 `kbox`、`kcyl`、`beam`、`prism` 接入真实网格；不保留 SVG 的二维排序，改由深度测试处理。

矩形机械臂不能只用两端点定向。原 `beam(A,B,nv,w,h)` 还规定截面方向：

```js
u = normalize(B - A);
m = normalize(cross(u, nv));
n = normalize(cross(m, u));
// local X=n, Y=m, Z=u; dimensions=[w,h,length(B-A)]
```

使用 `assets/lib/source-frame.js` 的 `sourceBeamMatrix()` 写实例矩阵，或 `sourceBeam()` 建单独网格。输入与 `nv` 必须在同一坐标系。重合端点或平行参考轴应报错，不能静默生成 NaN 或任意翻滚。

```js
import {sourceBeamMatrix} from './lib/source-frame.js';
instances.setMatrixAt(index, sourceBeamMatrix(A, B, nv, width, depth));
instances.instanceMatrix.needsUpdate = true;
```

验收：两端中心回投 A/B、截面宽厚、正手性，再在肩/肘弯曲姿态看外壳方向与工具接触。该矩阵不包含全场景 Y 反射；反射放在统一父节点，勿重复应用。新 helper 从本次桥接数学提炼，不自动解析任意 HTML。

## 检查状态函数之外的条件

提取函数后继续读它在 `draw()` 中的调用，包括循环偏移、显隐、载荷交接和 HOME 门控。列“驱动时钟 → 条件 → 姿态 → 载荷 → 对应对象”。

固定来源：Factory Anatomy SHA `1b0b1e574ec144105a4c8f56bc58164b9128a786`，以下文件均在 `figures/`：

| 源文件 / 函数 | 必须保留的条件 | 验收 |
|---|---|---|
| `stamping-jier-line-light.html`：`robotSvg/ramDz/xferState/pressPart` | 壳体截面与吸盘；压机抬起后才转运，阶段板件对应压次 | 冲程/移载两时刻近景，板件形态变化 |
| `battery-pack-line-light.html`：`draw/r3State/trayPos` | 托盘为 `mod(tau-16,32)`；R3 同相位加 32；另有夹紧、捆扎、焊点与八螺栓动作 | 工具下行、模组交接、盖板与 EOL，不能只验证三只臂 |
| `bodyshop-biw-desktop-light.html`：`toolSvg/robotSvg/stationFlags` | 点焊/涂胶/测量工具不同；工序标志控制车身构件 | 总拼门架用开放构造，不能用实心板遮掉工作对象 |
| `assembly-nev-desktop-light.html`：`renderTray/flagsAt`、M2 绘制 | 托盘 32×20、Pack 20×14 为源场景单位；十轴按原时间公式动作 | 合装尺度、悬挂/滑板载具、增装零件；不是现实工程规格 |
| `edu-drive-desktop-light.html`：`MOTION` 调用处、`ROBOT_WIN` | 窗口外回 HOME；六台 AGV 各有周期和供料条件 | 窗口边界与空/载返回，不能统一为正弦平移 |

数字检查分别覆盖状态条件、真实几何矩阵；浏览器检查最终显示。源状态采样通过不证明视觉相似、连续避碰或真实工业流程正确。

### 独立时钟与边界采样

`assets/lib/process-timing.js` 统一处理正模、偏移、窗口与采样，不自动恢复原 HTML 的工艺条件：

```js
import {cycleClock, sampleClocks, boundaryTimes} from './lib/process-timing.js';
const tray = cycleClock(time, {period:32, offset:-16}); // 明确 time + offset
const robot = cycleClock(time, {period:32, windows:[[4,12]]}); // 示意窗口，必须换成源值
const pose = robot.active ? sourceRobotPose(robot.phase) : HOME;
const samples = boundaryTimes({period:32, offset:-16, boundaries:[0,8], from:0, to:64});
// 多台 AGV 用 sampleClocks(time, {idA:{period,offset,...}, idB:{...}})，不要共用某一台的 phase。
```

窗口为 `[进入,退出)`；跨零窗口如 `[28,4]` 支持，`null` 始终启用，`[]` 始终关闭，零长窗口拒绝。每个工具/载荷依然需要显式条件，不能把“机器人在窗口内”当作载荷已经在手。`boundaryTimes` 给出边界前、恰好边界、边界后三个样本以及首尾；还要保留中段与完整循环抽样。`node --test scripts/process-timing.test.mjs` 验证这些数学约定，不能替代新项目的源状态对照。

本适配层复用 `factory-process.js` 的时钟/窗口运算。注意两者参数含义：`cycleClock` 的 offset 是源公式中的加数；`cycleTime/createProcessSampler` 的 offset 是启动延迟，使用 `time-offset`。迁移时明确符号，不原样混传。设备构建映射、实际采样函数与物料归属使用 `factory-process.js`；边界采样用于测试这些项目条件。

## 配色、线条与遮挡

### 将条件落实为可检查的对象

`factory-process.js` 提供 `buildStations(definitions, builders)`：每个定义有稳定 `id/kind`，每种 `kind` 对应明确构建函数。未知种类、重复 ID、复用同一个 Object3D 会报错；它不会判断两个不同对象的造型是否过于相似，仍须看功能近景。

`createProcessSampler(tracks)` 按每条轨道的 `period/offset/windows` 采样；offset 表示延迟，局部时间为正模 `time-offset`，保留完整循环编号（包括负编号）。每个有窗口的轨道必须提供 `home(local,cycle)`，窗口外调用它；窗口内调用 `sample(local,cycle)`。跨零窗口用 `[5,1]`，整周期用 `[0,period]`，相同端点拒绝。需要源代码的加法偏移时使用上文 `cycleClock` 适配层。

`auditMaterialOwners(items,{expectedIds})` 检查实际可见载荷记录的 ID 唯一、归属存在、位置有限及期望物料是否缺失。由当前可见网格产生记录，不能复制一份永远正确的静态列表；它不能发现未登记的副本，也不证明连续避碰或产能。

`--example indexed-workcell` 是压装、检测、缓存三类设备的原创开发例，用于检查独立周期、明确 HOME、物料交接、实例增减和配色恢复。`verify_migration.py` 同时注入错投影、重复载荷和无效时序。开发例通过不等于五个原车间已重新复刻或新题材盲测通过。

先沿用原语义：白色结构、蓝灰夹具/区域、深色电机/输送件、有限暖色接触点；检查受光后的最终颜色。边线 shader 要正确输出色彩空间。地板格线、栅栏和公用管线应弱于设备轮廓，避免给每根细杆相同的黑轮廓。

公用管线与物流轨道分别建模。总装总览需要贯通的管线秩序，但不能把每条线都扩成全宽传送带。局部密集结构须通过近景判断，不能只看总览。

新项目统一画风按 [插画渲染](illustration-style.md)；这五例 V2 实际使用中性受光材质、细边线和接触阴影，不冒称已采用该独立 shader 或达到逐像素一致。

## 记录仍然不同的地方

每例交付“来源原样继承 / 参考重建 / 仍有差异”及实际截图。烘焙 SVG 的 `SOLIDS` 数字可能只是数量，不是完整网格。没有原资产时不要把新建静态机器说成原始资产恢复。

本机实例：`D:/code/LeoWang-Wiki/local/factory-anatomy-five-3d-v2-20261103/README.md`。源副本、桥接代码和状态/浏览器证据位于该目录，路径只作可审计示例，不是技能运行依赖。
