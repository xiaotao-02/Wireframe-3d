# 构件接口与装配检查

用于存在配合、支撑、导向、行程或管线的真实三维主题。实现：`assets/lib/assembly.js`。单位由主题选定，所有尺寸/容差一致；示意容差不是制造公差。

## 接口与关系

`port(node,{id,position,normal,up=[1,0,0],diameter=null,pattern=null})` 在 node 的局部坐标声明接口。normal 指向安装面外；up 与 normal 不共线。node 可以是装配内真正运动的子物体。世界坐标通过实际 matrixWorld 得到；圆接口不支持非均匀世界缩放。pattern 可用 `{count,circle}` 声明螺栓数量、孔距圆半径，up 定义第一孔方向。

`assemblyPart({id,node,ports,source,label,description,explode,...})` 返回部件；source 写明原模型/图纸/推测/原创，端口必须在该部件内。预览的 parts 为 root 的平级直接子组，内部可含层级。审计会重新核对后加入端口的从属关系；重复 ID、零/镜像/非均匀缩放或无效配置不能作为通过。接口只定义配合坐标，不自动移动网格求解装配。

`auditAssembly({root,parts,relations,features,grounded},{assembled:true})` 返回 `status / passed / failed / unverified / notApplicable / results`。模型通过 `model.assembly` 接入网页“说明 → 检查连接”。不要只读取一个布尔值。无效顶层配置可能抛出错误；网页显示配置错误，位置/行程改变后旧报告立即失效。

关系例子：

```js
{id:'pipe-to-valve', type:'mate', a:'pipe.end', b:'valve.in',
 tolerance:.002, angleTolerance:.5}
```

| type | 执行检查 |
|---|---|
| `mate` / `support` | 两端距离、法向相反（`opposed:false` 可同向）、已声明口径一致、已声明孔数/孔距/相位一致 |
| `coaxial` | 轴线垂距、平行程度；不是孔径或接触验证 |
| `slider` | 同轴＋沿 a 法向测得的世界坐标轴向偏移落在 `travel:[min,max]` |
| `clearance` | a/b 为实际 Object3D；`minGap` 为最小距离。实际网格包围盒排除远对，三角形距离/相交检查近对，并用射线奇偶测试闭合物体包含关系 |

关系默认只检查合拢态，拆解为 not-applicable；`when:'always'` 用于需要始终成立的关系。`carries:false` 可排除不应计入承托连通图的关系。grounded 是底座部件 ID；通过的已声明关系生成连接图，`requiresSupport:false` 只用于明确允许自由放置的组件。它检查连通，不计算载荷、刚度或稳定性。

clearance 的 `maxPairs` 限制三角形近对预算；超限必须返回 unverified，不能当 pass。包含测试要求闭合网格；开放曲面设置 `closedA/closedB:false`，相应包含关系未证明。不支持蒙皮/顶点着色器位移；变形后先更新实际几何。检查指定关系并不代表检查了全场所有部件。

## 实际显示网格的特征检查

- `{id,type:'bore',mesh,frame,depth,expectedDiameter,tolerance,samples:8}`：frame 是孔口接口，法向朝外；从孔中段径向测真实内壁，并沿轴验证贯通。剖面中段圆孔的有限射线样本，不证明任意深度/任意角度没有缺陷。期望值应来自独立构造要求，不从被测网格反推。
- `{id,type:'surface',mesh,frame,points:[[u,v]],reach,tolerance}`：在接口平面指定位置向内投射到实际表面，检查接口并非悬空。u 沿 up，v 沿 normal×up。

孔阵列 `pattern` 仅比较声明，不能证明实际螺孔位置正确。需要检查真实法兰时，在装配基准下为关键螺孔分别配置 `bore` 探针；把实际法兰错转、保持接口声明不变，检查应该失败。探针不能随被测错误网格一起错移。

模板装饰轮廓标记 `userData.auditIgnore`，不纳入几何测量。自定义轮廓也必须如此，不能用简化代理替代真正显示网格后报告全模型通过。

`createSceneRuntime` 会核对 `model.assembly.root/parts` 与渲染对象相同。`auditAssembly` 拒绝脱离声明 root 的部件，以及不属于语义部件的测量网格/基准；`userData.auditRole='proxy'` 标记审计或点选代理，不能测作真实构件。`auditIgnore` 对整个子树生效。界面的临时隐藏不移除装配检查，以免“独立查看”跳过问题；该检查也不能自动识别被误标为实体的代理，源数据用途仍须先核对。

蒙皮、正在作用的 morph、实例 morph、显式 `auditDeformation` 或部分 `drawRange` 尚未烘焙时，返回 `unverified`，不能用未变形的完整几何判通过。管线中段净距和两端接面分开配置。变径管修正后重新验证完整扫掠网格，不仅验证中心线或端点。

## 运行与反例

主题可返回 `setPose({stroke,explode,time})` 与 `strokeLabel`（如“阀板开度”）；预览通过 `createSceneRuntime` 先恢复初始子节点变换与各部件 rest+explode，再调用该函数。stroke 是归一化 0–1 的演示行程。暂停冻结机构时钟；拆解中行程回零；不同工况需自己实现统一状态。具体回放和批量检查见 [motion-and-verification.md](motion-and-verification.md)。

新增装配至少核验初始/极值/运动中间状态，并注入与该主题有关的错误：移动接口宿主、改变实际孔的网格、偏离导向轴、进入间隙。观察具体规则失败，不能仅测试 metadata。有限状态测试不等于连续无碰撞证明。浏览器画面还要检查支撑、连接的可见形态。

完整用法见 `assets/examples/pneumatic-press.js`。它是原创教学题，接口/行程可执行，不是制造级压机设计。

运行库级回归：`python scripts/verify_assembly.py --three <node_modules/three> --report <输出JSON>`。它包含压装台有限行程样本和故意破坏的反例；新模型仍需配置自己的接口与检查，不以库测试替代。
