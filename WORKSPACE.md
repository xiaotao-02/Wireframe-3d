# 本机工作区

本机统一入口：`D:\code\Wireframe-3d`。当前技能源码继续保存在仓库根目录，通过现有 Git 分支和提交管理；本地历史、实测记录及批次工具放入 `_local/`。最新版本及暂停状态见 [当前工作状态](_local/CURRENT-STATE.md)。

## 目录

| 路径 | 用途 |
| --- | --- |
| `SKILL.md`、`assets/`、`references/`、`scripts/` 等 | 当前技能源码，由 Git 管理 |
| [HISTORY.md](HISTORY.md) | 历史阶段说明及证据边界 |
| [_local/history/README.md](_local/history/README.md) | 历史阶段、源码快照、哈希清单、逐版 ZIP 和差异 |
| [_local/validation/](_local/validation/) | 按日期组织的验证、候选版本、运行记录及证据 |
| [_local/experiments/web3d-m78-wireframe-ab/](_local/experiments/web3d-m78-wireframe-ab/) | M78 / Wireframe 对比批次的编排和评测工具，包括本地依赖 |
| [_local/packages/](_local/packages/) | 原始总归档 ZIP |
| [_local/organization-20261105/](_local/organization-20261105/) | 本次搬迁脚本、逐文件 SHA-256 清单及核验结果 |
| `_output/` | 当前源码生成的网页和临时预览 |

`_local/` 由 `.gitignore` 和源码快照工具排除，避免把历史副本、运行日志和依赖打包成当前技能。它不随 Git 克隆下载；备份本机资料时需要单独包含此目录。目录链接仅适用于这台 Windows 电脑。

## 旧路径映射

| 原路径 | 现在的实体位置 |
| --- | --- |
| `D:\code\Wireframe-3d-history` | `D:\code\Wireframe-3d\_local\history` |
| `D:\code\Wireframe-3d-validation` | `D:\code\Wireframe-3d\_local\validation` |
| `D:\code\web3d-m78-wireframe-ab` | `D:\code\Wireframe-3d\_local\experiments\web3d-m78-wireframe-ab` |
| `D:\code\Wireframe-3d-history-20261104.zip` | `D:\code\Wireframe-3d\_local\packages\Wireframe-3d-history-20261104.zip` |

前三个旧目录最初保留为隐藏的 NTFS Junction，2026-11-05 已按用户要求移除这些兼容入口。实体数据保留在上表的新位置；资源管理器中的 `D:\code` 不再显示这三个旧目录。旧 ZIP 路径也不保留副本。清理记录及必要时恢复兼容入口的脚本见 [链接清理记录](_local/organization-20261105/legacy-link-cleanup/README.md)。

本次整理不改写历史源码、原始提示词、运行日志、MANIFEST 或原 ZIP；其中出现的旧路径保留原样，查阅时按上表映射到新位置。新项目、命令和书签使用新路径。一次性历史采集与归档脚本是当时的操作记录，不应直接重跑。迁移核验只验证文件完整性，不代表重跑了历史模型。

## 后续维护

- 修改当前技能时使用 Git 提交和分支；不再在 `D:\code` 下创建 `Wireframe-3d-*` 兄弟副本。
- 新验证批次放在 `_local/validation/YYYYMMDD-主题/`；原始输入、冻结候选、运行输出及审核记录分别保存。
- 新对比工具放在 `_local/experiments/`，正式冻结的历史包及对应哈希继续放入 `_local/history/` 或 `_local/packages/`。
- 历史阶段保留实际来源和完整性分类，不重新编号成虚构的 Git 发布版本。2026-11-04 的总 ZIP 保留当时的 19 阶段；新增候选以实时 `history/catalog.json` 为准。
- 在仓库根目录执行 `python _local/history/tools/verify_archive.py` 可只读核验现存源码与 ZIP；可用 `--output 新报告路径` 保存新报告，不覆盖旧报告。

`D:\code\minimax-code-mcp` 是独立、已注册且正在使用的 MCP 服务，因此保留原位。它的 `workspaces/` 包含 MiniMax 会话的实际工作目录，现有会话路径也保持原样。对比批次的模型成果仍位于原来的市场项目交付目录；这里归并的是截图中相关的版本资料与测试工具。

已安装技能的入口 `C:\Users\ADMIN\.codex\skills\wireframe-3d` 仍指向 `D:\code\Wireframe-3d`。
