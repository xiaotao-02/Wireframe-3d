# Blender 交付

优先在独立后台进程构建，避免占用或覆盖用户正在编辑的工程。用户明确要改当前工程时，先检查对象和路径，另存工作副本，再定向修改。MCP 是否可用、插件版本和当前文件应当场检查；本技能不要求特定 MCP 插件。

## 运行示例（PowerShell）

先按 Three.js 文档生成 `scene.json`，或只运行 `make_demo.py` 与 `validate_scene.py`。不需要为 Blender 安装 npm 依赖。

```powershell
$skillDir = 'D:\code\Wireframe-3d'
$workDir = 'D:\scratch\anatomy-demo'
$blenderExe = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python "$skillDir\scripts\build_blender.py" -- --scene "$workDir\scene.json" --out "$workDir\blender" --render
```

Blender 路径仅是已测机器的例子，先发现实际安装路径。使用 `--python-exit-code 1`，否则 Python 异常可能伴随进程退出码 0，误报成功。

输出 `.blend`、PNG 和运行检查 JSON。已在 **Blender 5.2.1 LTS** 执行；未验证其他版本。脚本使用分层 Action API 读取 FCurve；旧版要按实际 API 适配。

## 原生编辑结构

- 每个语义组一个 Collection 与 Empty，网格各自保留 `part_id`、label、description。
- `ANATOMY_CONTROLS` 自定义属性：`explode`（0–1）、`phase`（动画浮点）、`show_cover`（布尔）。
- 组位移由 driver 计算 rest + explode × offset，叶轮转动由 phase 控制。第 1 帧相位 0，第 101 帧为 0.5，第 201 帧为 1；动画插值为 LINEAR。
- 浮点动画属性赋值用 `0.0` / `1.0`。改成整数会改变 ID property 类型，导致中间帧取整；必须实际取样中间帧。
- 示例保存帧 1，前盖隐藏；勾选控制器的 `show_cover` 即可看完整外壳，调整 explode 可拆解。通过物体自定义属性编辑，不需要打开 Python 控制台才能理解工程。
- 示例有静态流程引导曲线，**没有 Blender 流体粒子动画**；网页端才有移动流向标记。两端也没有 CFD、真实工况或齿轮/刚体求解。

## 面向新主题

把示例里的 `rotor`、`cover`、相机、流线和相位测试改成目标对象的语义。保持 Collection/Empty 的编辑结构；复杂外形可改用 Curve、Geometry Nodes、Boolean 或原生建模，不必强行走 JSON 三角网格。

对于工厂：用 Collection 分楼层，用 Empty 分工位；机器人、升降机和传送载具用明确关节/路径约束。动画的输入与输出读数来自同一状态；设备工作范围依据资料，不把视觉排布宣称成产线设计。

输出视频时另做实际帧渲染和编码验证。生成一个 PNG 不代表动画导出成功。输出 GLB 时另核对坐标转换、动画和材质；当前脚本没有自动 GLB 导出。

## 验证

脚本内检查 0、0.5、1、0 拆解位置和中间帧旋转。完成后用另一个后台进程重开保存的 `.blend`，核对部件数、驱动有效性和中间帧；再查看实际渲染。几何闭合检查与碰撞/装配检查不同，不能互相替代。
