# Three.js 交付

## 新主题起点

先按 [示例入口](starting-examples.md) 打开一个构造方法相近的完整例子。参考读图、配准或复杂外壳需要额外方法时再读 [参考建模](reference-reconstruction.md) 的相关段落。参考外形通过关键阶段检查后再扩展所需交互。

默认用独立 `buildScene()` 构建器，按 [构件库与主题接口](component-library.md) 组织几何和部件。`prepare_web.py --builder <subject.js> --three <node_modules/three> --out <web>` 复制通用预览、共享 UI、构件库与运行时。生成器导入 `./lib/*.js`，额外模块/贴图需明确打包。

参考任务可增加 `--reference <reference.json>` 生成保持比例的 `review.html`；`--extra <相对文件或通配符>` 将项目模块/贴图一起复制并纳入哈希。字段、固定相机与截图步骤见 [参考建模工具](reference-tools.md)。

找不到接近的示例时，用 [题材与构造方法](subject-workflows.md) 选择表示。视觉对照步骤集中在主流程与 [视觉对照](visual-acceptance.md)，无需为简单对象读取所有题材文档。

## 兼容的泵清单起点（PowerShell）

先选独立输出目录。变量 `skillDir` 指向本技能目录，`workDir` 是本次产物目录。首次安装依赖需要网络；生成的网页使用本地 vendor 文件，运行不依赖 CDN。

```powershell
$skillDir = 'D:\code\Wireframe-3d'
$workDir = 'D:\scratch\anatomy-demo'
New-Item -ItemType Directory -Force "$workDir\deps" | Out-Null
Copy-Item "$skillDir\assets\web\package*.json" "$workDir\deps"
npm ci --prefix "$workDir\deps" --ignore-scripts --no-audit --no-fund
python "$skillDir\scripts\make_demo.py" --output "$workDir\scene.json"
python "$skillDir\scripts\validate_scene.py" "$workDir\scene.json" --report "$workDir\geometry-verification.json"
python "$skillDir\scripts\prepare_web.py" --scene "$workDir\scene.json" --three "$workDir\deps\node_modules\three" --out "$workDir\web"
python -m http.server 8766 --bind 127.0.0.1 --directory "$workDir\web"
```

在浏览器打开 `http://127.0.0.1:8766/`。端口占用时换空闲端口，不停止其他服务。不要以双击 `file://` 验收原生模块和 fetch；如果用户需要单 HTML，另做打包并实际验证。

已锁定 Three.js **0.187.0**；`prepare_web.py` 复制该版运行时、OrbitControls、MIT 许可及本地 HTML/app/共享 UI 资源。升级时改 lockfile 和版本检查，再跑页面验证。`--scene` 的 `app.js` 仍面向泵；`--builder/--example` 使用不绑定泵部件名的 `studio.js`。新版预览布局与控件移动方式见 [预览 UI](preview-ui.md)。

## 换主题时改什么

- 保留 stable ID、rest pose、状态驱动和选择逻辑；替换 `make_demo.py` 的结构参数与几何，或按共享约定生成新清单。
- `app.js` 中的 `cover` / `rotor` / `hub` 初值、说明、流线与相机是示例绑定；主题没有这些组时必须同步改，不能只替换 JSON。
- 网格保留实际空腔、倒角、连接和局部细节；较复杂的外形使用自定义 `BufferGeometry` 或有来源的 GLB，语义索引与几何资产分开。
- 大型工厂以楼层/工位为 Group；物流沿共享曲线按弧长运动，升降机状态与载具同步。重复托盘/紧固件可 InstancedMesh，近景教学关键件仍保留选择映射。
- 真实转动用轴心层级，不旋转已经包含世界位移的顶点。混合轴旋转需遵守 [坐标约定](scene-contract.md)。

## 可视性与运行

- 遮挡使用真实深度；流线示意可选择叠加绘制，但要标成说明图层。例子有意把流线画在表面之上，不能据此判定内部流道畅通。
- 爆炸不靠透明度掩盖穿插。不要通过双面材质掩盖错误绕序；剖切若要封口，使用几何处理或正确的 stencil cap。
- 原生控件有 label、键盘操作，部件选择也能通过列表完成。提供 reduced-motion、暂停、复位，避免只支持鼠标悬停。
- 单一时钟驱动相位和读数；首帧 dt 为 0，后续 dt 非负并限幅，恢复页面不追赶长时间空档。
- 有启动、停机与装配过渡时，将纯状态独立成模块，再接 shader/网格；透明效果要在实际场景里验证遮挡，不能只检查 GLSL 语法。已有作品的相机手性、细节追溯与阶段测试见 [参考还原与动画检查](reference-fidelity.md)。
- 需要性能结论时，在目标设备测量 draw calls、可见三角形、像素比、帧时间。部件少不自动等于性能合格。

## 最少实测

页面加载 → 暂停 → 半拆 → 全拆 → 恢复前盖 → 选择部件 → 复位 → 正面/背面观察；验证流线在拆解时隐藏，暂停的相位保持稳定，复位恢复 rest pose。用 DOM 读数和截图共同核对；数据写入 DOM 本身不是画面证据。再做窄屏、错误日志检查。

新预览提供 `window.__wireframe` 的同路径回放/控制接口和 `#stage[data-state]` 只读诊断；旧泵预览仍只使用自己的诊断字段。用 `verify_scene.py` 与 `verify_preview.mjs` 保存数值结果、真实截图、键盘/窄屏/reduced-motion 验收，见 [共享状态与可回放验收](motion-and-verification.md)。不要把这些便利接口当作其他网页都具备的功能。
