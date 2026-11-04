# 共享状态与可回放验收

适用于 `prepare_web.py --builder/--example` 的 Three.js 预览。旧 `--scene` 泵预览和 Blender 未接入这些接口；不能据此宣称双引擎通过。

## 先写动作要表达什么

有运动讲解时，在编码前为关键状态或镜头写紧凑记录；已有过程状态表直接补列，不另建重复分镜：

`状态/时间段 | 操作对象与器具 | 部件的实际变化 | 文案与数值 | 观众应理解的结果 | 进入/退出条件 | 依据`

动作、说明、数值和效果读取同一状态与实际姿态。不要按独立定时器切换字幕，让“已连接/已注入/已停止”等文字早于对应几何或物流状态；纯展示的示意节奏不冒充真实工艺时间。选择正确的动作对象与器具，再设计位移、旋转和特效。

完成后在目标播放尺寸下正常连续运行完整流程（周期演示至少一个完整周期，并覆盖用户需要的启停/复位），核对状态交接、镜头停留、文字可读性和结果。保存播放范围与观察记录；关键帧用于定位，不能代替连续播放。`sample()` 和下述自动检查只覆盖声明的采样/操作，未进行全程观察时，完整播放项记录 `NOT_RUN`。静态模型无需新增动画或分镜。

## 构建器契约

在 [component-library.md](component-library.md) 的 `buildScene()` 返回值上按需增加：

```js
setPose({stroke, explode, time}) {
  // 所有量都来自当前实际姿态；stroke 在拆解期间为 0。
  // 已恢复所有初始变换和可见性；回调后才施加顶层展开位移。
  moving.position.z = -stroke * travel;
  return {phase: '当前工况', readout: '当前读数'};
},
cycleAt: t => (1 - Math.cos(t)) / 2, // 可选，纯函数，返回 0–1；时间单位为秒
strokeLabel: '机构行程'
```

预览保存根节点和子节点 rest pose 与 visible；重复调用不会积累变换。顶点数据、材质、uniform 和内部变量不自动恢复，必须按当前状态赋值。新增运动节点需在建立 runtime 前创建。分阶段展开、断开特效与真实间距检查见 [展开与动作返修](explosion-and-motion-repairs.md)。

`motion.js` 的 `createMotion()` 提供 `explode(value)`、`setStroke(value)`、`cycle(on)`、`setPaused(on)`、`setVisible(on)`、`setReduced(on)`、`sample(pose)`、`reset()`、`step(dt)` 和只读副本 `snapshot()`。拆解时启动会先归位，实际弹簧收敛后才走工况时钟；暂停/离屏冻结；reduced-motion 允许手动直接设置，关闭连续运行。它是演示控制器，不是刚体/弹性动力学求解器。

显式 `cycle(true)` 解除用户暂停并启动，仍尊重离屏与 reduced-motion。无效的行程命令不会破坏已有的合拢/启动状态。`cycle(false)` 是立即停止该简易行程循环；带余烟/卸压等尾段的设备须在自己的纯状态模块里实现“停止请求 → 尾段 → 冷态”，停止请求应解除用户暂停但不绕过离屏。不能用通用行程循环假装完成了发动机停机过程。

预览对模型渲染按需请求帧，闲置时停止 WebGL 重绘。OrbitControls 仍可操作；拖动后不会因拆解过程把视角强行切回预设机位。共享 UI 自身轻量范围控件同步仍独立运行，不把它描述为“页面零计算”。

## 浏览器检查接口

`window.__wireframe` 仅为本模板提供：

```js
__wireframe.sample({explode: .5, stroke: 0, time: 0}); // 暂停并回放指定状态
__wireframe.sample({explode: 0, stroke: 1});
__wireframe.cycle(); __wireframe.pause(false);
__wireframe.pause(true);
__wireframe.select('actuator', {isolate: true});
__wireframe.view('back'); // hero / back / top
__wireframe.reset();
__wireframe.audit(); // 仅已配置装配与网格规则
__wireframe.snapshot(); // 实际状态、读数、部件变换、镜头、绘制统计
```

回放和 UI 使用同一运行路径。`snapshot()` 不证明画面正确；`drawCalls/triangles` 是绘制统计，不是 FPS。检查器需等待浏览器完成绘制后截图。

## 可复现命令（PowerShell）

使用独立目录保存生成页面和证据；技能目录只保存可复用代码。以下 `threeDir` 指向已经安装的 Three.js 0.187.0；首次安装方法见 [threejs.md](threejs.md)。

```powershell
$skillDir = 'D:\code\Wireframe-3d'
$threeDir = 'D:\scratch\deps\node_modules\three'
$workDir = 'D:\scratch\wireframe-check'
node --test "$skillDir\scripts\motion.test.mjs"
python "$skillDir\scripts\verify_scene.py" --example contact-switch --three $threeDir --report "$workDir\evidence\geometry.json"
python "$skillDir\scripts\prepare_web.py" --example contact-switch --three $threeDir --out "$workDir\web"
python "$skillDir\scripts\serve_preview.py" --root "$workDir\web" --port 8874
```

服务打印实际 URL（占用时自动选择后续端口）。仅在当前环境允许直接浏览器自动化时，在另一个终端运行以下脚本并替换真实端口；有专用浏览器工具且禁止直接 CDP 时，改用获准工具操作 UI、检查错误与截图，不能运行此脚本绕过限制。

```powershell
$buildId = (Get-Content -Raw "$workDir\web\preview-manifest.json" | ConvertFrom-Json).id
node "$skillDir\scripts\verify_preview.mjs" --url 'http://127.0.0.1:8874/' --out "$workDir\evidence\browser" --part actuator --expect-build $buildId
```

自定义主题将 `--example` 换为 `--builder <subject.js>`；省略或改成自己的 `--part`。构建器只自动携带 `three` 和 `./lib`，额外资源由项目打包。

数值脚本检查真实顶点/变换、重复姿态、9 个行程样本与 3 个展开样本、已声明装配和可适用反例。未配置的装配仍标为 `unconfigured`。这不是连续无碰撞证明。

浏览器脚本需要 Node 22+ 与本机 Chrome/Chromium，可用 `--chrome` 或 `CHROME_PATH` 指定。它创建隔离的临时浏览器配置，只访问给定的 loopback 页面，不操作用户登录浏览器，不使用 CDN、不依赖 Playwright。输出 1440×1000 和 390×844 的真实截图、错误日志与 JSON；检查加载、半拆/全拆、归位等待、暂停、键盘调节、复位、装配、窄屏和 reduced-motion。静态主题跳过工况测试；没有装配的主题记录未配置。

`browser-report.json` 的 `visualReview/referenceFidelity` 初始为 `NOT_RUN`。打开截图后，在独立验收记录中逐项评价；不要把自动脚本默认改成美观通过。参考匹配仍按 [visual-acceptance.md](visual-acceptance.md) 做同机位对照。

当前脚本要求重新用 `prepare_web.py` 生成预览；它校验清单所列文件的实际 HTTP 内容、页面读取的 buildId 和可选 `--expect-build`。每张截图记录目标 ID、URL、像素尺寸、浏览器读回视口、相机/姿态与 PNG 哈希；截取前要求固定姿态已绘制，窄屏明确验证 390×844。报告保留浏览器版本和执行时间。清单只覆盖列出的文件，自定义额外资源需纳入项目清单；这不是全资源自动打包器。性能固定标为 `NOT_MEASURED`，需另行前台稳定采样才能报告 FPS。

库回归：`npm test` 跑状态与时序；`verify_components.py` 额外核验截面方向、投影手性、载具随动、曲线变径及轮廓实例同步；`verify_assembly.py` 注入代理替换、离树基准和变形未烘焙等错误。失败报告也会保存，不能以旧的通过 JSON 覆盖本轮失败。
