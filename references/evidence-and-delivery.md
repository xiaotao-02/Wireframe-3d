# 参考证据与可校验交付

用于参考还原、明确交付要求、导出或多版本交付。普通小改动按影响选择检查，不必生成完整材料包。

## 从要求到最终回读

制作前把用户要求分成四类并保留来源：**必须出现**（主体/结构/操作）、**必须保持**（比例/风格/指定文字/默认底色）、**禁止出现**（用户排除的内容或行为）、**交付格式**（文件/可编辑源/资源/目标载体）。这些是整理用户要求的栏目，不是自动增加需求。没有相应要求可注明无；不得为了验收通过静默删除或放宽要求。

用 [制作与交付检查记录](../assets/templates/quality-review.md) 或已有项目记录，把每项要求对应到真实文件、视图、状态和判断依据。记录默认入口、应用/查看器及版本、视口或播放尺寸、相机/状态、当前源码/构建或导出文件哈希。命令退出成功、文件存在与功能可用是不同结论。

交付前从保存后的实际入口重开，而非沿用仍在内存中的工作状态；需要资源包时从独立目录打开交付副本，检查模型、纹理和字体等资源。验证范围以承诺的载体为准：

| 层级（按实际交付选用） | 回读内容 | 能支持的结论 |
|---|---|---|
| 原生工程/源项目 | 保存后重开，检查几何、材质、命名、驱动/状态与可编辑性 | 源工程可用 |
| 导出文件/网页包 | 重新导入或从交付副本加载，检查尺寸/轴向、分组、材质/纹理、动画与资源路径 | 导出内容与资源完整 |
| 目标查看器/浏览器/播放器 | 默认首屏、材料差异、遮挡、文字、操作及完整播放（如有） | 在已记录观看条件下可用 |

一次目标查看器回读若同时检验了导出内容，可共用证据；不为凑三行重复打开。没有导出的任务不强制创建导出物。材料异常先定位在哪一层出现，再修源材质、导出设置或目标显示；不能凭源工程截图宣布交付物正常。

每项使用 `PASS / FAIL / NOT_RUN`，分别表示**实际检查满足 / 实际检查不满足 / 尚未检查或条件不足**。写明观察值；失败附当前画面或日志位置，未验证写具体缺失条件。通过不要求伪造量化分数，机械/科普原理的依据也不能由画面代替。已有特征记录继续用下文的 `matched/different/unverified`，不要混改脚本字段。

修复后保持相同视角、状态、视口和播放范围重查受影响项，并重开默认入口；因合理原因改变条件时记录原因，不用换角度隐藏失败。源文件改变后更新受影响的导出、构建和证据，旧失败与修后结果分开保存。四类要求中有关键 `FAIL` 时继续修复；关键 `NOT_RUN` 不能写成通过，无法完成时准确交代缺口。默认首屏主体不可见、异常遮挡或指定底色不符，不因其他测试通过而豁免。

这份记录是执行者实际观察的结论，不是自动视觉评分器。下面的哈希工具只验证证据关联，不读取此 Markdown 记录，也不替执行者审图。

## 让截图对应实际版本

把运行页面放在 `web/`，证据放在并列 `evidence/`，避免截图改变构建目录的哈希。`prepare_web.py` 的构建清单和浏览器读回 ID 用于确认打开的页面；`check_reference.py` 进一步检查已声明的对照记录。两者摘要算法/覆盖范围不同，不能混用哈希。

```powershell
python scripts/check_reference.py fingerprint D:\scratch\project\web
python scripts/check_reference.py fingerprint D:\scratch\project\evidence\actual.png
python scripts/check_reference.py check --root D:\scratch\project --record D:\scratch\project\review.json --out D:\scratch\project\evidence\review-check.json
```

记录结构示例（哈希必须由实际文件计算）：

```json
{
  "build": {"path":"web", "sha256":"BUILD_TREE_SHA256"},
  "views": [{
    "id":"tool-contact", "buildSha256":"BUILD_TREE_SHA256",
    "state":{"time":3.5,"projection":"orthographic","viewport":[1440,1000]},
    "alignment":{"status":"checked","note":"记录真实相机、缩放和状态对齐依据"},
    "reference":{"path":"evidence/reference.png","sha256":"REFERENCE_SHA256"},
    "actual":{"path":"evidence/actual.png","sha256":"ACTUAL_SHA256"}
  }],
  "features":[{
    "id":"tool-contact","critical":true,
    "source":"固定源版本、文件和函数", "implementation":"模块与部件ID",
    "views":["tool-contact"], "status":"unverified", "note":"记录观察值与差异"
  }]
}
```

特征状态是 `matched/different/unverified`。关键特征有差异返回 `needs-revision`，未审图返回 `not-reviewed`，文件改变返回 `invalid-or-stale`。非关键差异仍保留在报告里。不能把关键项改为非关键项来通过检查。

`record-complete` 只说明声明和哈希一致；`visualQuality` 始终为 `MANUAL_ASSESSMENT_ONLY`。工具不读取图像内容，不验证人工填写的状态是否真实，也不能证明截图来自该页面。必须实际读回页面版本、操作、截图并人工检查。代码变化后重新拍摄受影响状态，不能只更新记录里的哈希来继续使用旧截图。开发例不能作为原作参考图。

浏览器验证遵守当前环境的工具限制。有专用浏览器工具时用其操作和截图；若当前环境禁止直接 CDP/外部自动化，不运行 `verify_preview.mjs`，改用获准工具检查真实 UI、读回页面状态并保存证据。不能因技能附带脚本而绕过工具边界。

## 端口与源快照

```powershell
python scripts/serve_preview.py --root D:\scratch\project\web --port 8875
python scripts/project_snapshot.py --source D:\scratch\project --out D:\scratch\backups
```

服务仅绑定 loopback，独占端口；端口占用时尝试随后 50 个端口并打印真实 URL。以该 URL 验证，不终止别的项目服务，也不要继续使用旧页面地址。默认不自动打开浏览器。

快照输出必须在源目录之外。工具建立新时间戳目录与 ZIP，包含 SHA-256 清单，复查复制期间源文件是否改变，再校验压缩内容。发生并发变更时失败并保留 `.partial`；这不是可交付 ZIP，应等修改结束后重新生成。既有备份不覆盖。

快照忽略 `.git/node_modules/__pycache__` 和 `.pyc`，拒绝链接/目录联接。需要离线运行时先将运行依赖放入项目的 `vendor/`，不能依赖被忽略的 node_modules。项目根不应预存保留名 `SNAPSHOT-MANIFEST.json`。该工具验证文件完整性，不验证模型质量，也不替代 Git 历史。

工具自身回归：`python scripts/project_tools.test.py` 覆盖过期几何/图片、缺失视图、关键差异、占用端口、并发复制与旧快照保留。测试用字节夹具检查元数据；不把它称为真实截图验收。
