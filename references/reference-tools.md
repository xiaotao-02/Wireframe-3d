# 参考建模工具

配合 [参考建模与首次交付](reference-reconstruction.md) 使用。工具记录读图依据、构造可编辑曲面并提供对照；不会自动从照片恢复三维，也不自动判断视觉合格。

## 参考记录

Python 需要 Pillow，初始化仅读取原图元数据和哈希，不修改图片：

```powershell
python "$skillDir/scripts/reference_constraints.py" init --image "side=$workDir/side.png" --out "$workDir/reference.json"
```

输出 DRAFT，含 sources（id/path/size/sha256）、空 views/dimensions/features。执行者查看图片后填写；初始化成功不等于完成读图。再次初始化不会覆盖已有记录。

`views.side` 示例，数值必须替换为实际依据：

```json
{
  "source": "side", "region": [0,0,1200,800],
  "projection": "orthographic", "calibrated": true,
  "registrationBasis": "独立尺寸标定、原点与方向的具体依据",
  "camera": {"direction":[0,1,0],"up":[0,0,1],"center":[0,0,0.7],"span":1.8},
  "landmarks": [{"probe":"roof-corner","uv":[0.45,0.2],"tolerance":0.01}]
}
```

- source 引用来源 id；region 为原图像素区域 `[x,y,width,height]`，省略则使用整图。
- projection 描述参考图，取 `orthographic / perspective / unknown`。目前数值投影比较仅支持正交；投影不明仍可视觉对照，但不能声明 calibrated。
- direction 从模型指向相机，up 为画面上方。center 是世界坐标中心，span 是垂直跨度，单位米；一起提供则锁定取景，模型改大不会被自动缩小抵消。省略二者为自动取景，只用于观察。
- uv 是选定区域内的归一化位置，左上 `[0,0]`、右下 `[1,1]`；tolerance 是此空间中的欧氏距离容差。真实配准后才设 calibrated，不得为了报告通过而声明配准。
- features 可记录 `{id,source,outlineUV,construction,status}`，保存关键轮廓与建模决策；这些内容供建模与审图，不自动解算几何或评分。

独立尺寸放入 dimensions，例如：

```json
{"id":"body-width","parts":["body"],"measure":"size","axis":"y","expected":2.03,"tolerance":0.005,"source":"side","basis":"原图宽度标注，不含后视镜","evidence":"annotated"}
```

所有几何约束以米为单位。measure 为 `size/min/max`，axis 为 x/y/z；省略 parts 测整个主体，填写则测指定语义部件的合并包络。evidence 为 `annotated/measured/estimated`。测量读取可见实体的索引引用顶点及世界/实例矩阵，跳过审计装饰；蒙皮/morph 需要求值后网格，当前拒绝代测。

```powershell
python "$skillDir/scripts/reference_constraints.py" validate "$workDir/reference.json"
```

该检查只确认来源完整性和字段结构，不证明尺寸依据或配准声明本身正确。

## 曲面工具

从 `./lib/surface-patches.js` 导入：

| API | 输入与边界 |
|---|---|
| `cubicBoundary([p0,p1,p2,p3])` | 四个三维控制点，返回边界函数；修改数组后重建网格 |
| `coonsPatch({bottom,top,left,right})` | bottom/top 沿 u，left/right 沿 v，参数为 0–1；四角须吻合。仅插值边界，不保证相邻曲面切向连续或无折叠 |
| `trimmedPatchGeometry(surface,{outline,holes,subdivisions})` | UV 轮廓裁切后细分映射，生成真实孔洞；默认外界是单位正方形。轮廓不重复末端点，自交、相交/嵌套孔、退化面会被拒绝 |
| `openingWallGeometry(surface,hole,{depth,segments})` | 沿同一孔边法线向内生成孔壁；主体也须传入相同 holes。segments 设为 `2 ** subdivisions` 使曲边采样吻合；不自动封底 |
| `surfaceFrame(surface,u,v,{offset,reverse})` | 返回位置、切向、法向、姿态，offset 沿法线，局部 Z 指向法线 |
| `placeOnSurface(object,surface,{u,v,offset,spin,reverse})` | 更新附件位置与朝向；附件和曲面使用同一父级局部坐标，主体变化后重新调用 |

`assets/examples/curved-shell.js` 是可运行的原创试件：弯曲面板、贯通开口、孔壁、贴附构件。它不是车辆模板或复刻质量基准。

可用 `prepare_web.py --example curved-shell --three <three目录> --out <预览目录>` 直接生成；需要对照页时另传已填写的 --reference 记录。

曲面拼接须共享边界、采样密度和一致朝向；平滑拼接另需约束两侧切向并查看高光。用 reverse 调整法向，不用双面材质掩盖绕序错误。全局自交、厚壳闭合和制造公差未自动保证。

有孔的高曲率外壳如出现细长扇形三角面、高光尖刺，或需要独立形体轨迹，见 [连续外壳返修](vehicle-surface-repair.md) 的 `surface-network.js`。对裁切结果直接递归细分不会改善原三角形长宽比。

## 对照与截图

```powershell
python "$skillDir/scripts/prepare_web.py" --builder "$workDir/subject.js" --three "$workDir/deps/node_modules/three" --reference "$workDir/reference.json" --extra "textures/*.png" --out "$workDir/web"
python "$skillDir/scripts/serve_preview.py" --root "$workDir/web" --port 5183
node "$skillDir/scripts/verify_preview.mjs" --url http://127.0.0.1:5183/ --reference true --out "$workDir/evidence/reference"
```

--reference 校验并复制原图，生成 review.html 对照页；--extra 可重复，相对构建器目录选择文件/通配符，不能覆盖生成文件。原图、对照页、额外资源均进入构建哈希。旧目录未声明的遗留文件不自动成为当前证据。

对照页保持来源区域与模型画面的相同宽高比，提供受光灰模/交付材质、透明叠加、尺寸与关键点结果。它隐藏 UI 得到干净画面，不拉伸模型来对齐参考。

构建器可返回实际网格关键点与默认视角：

```js
referenceProbes: {'roof-corner': {part:'body', mesh:'roof-panel', vertex:0}},
referenceViews: {side: {direction:[0,1,0],up:[0,0,1]}}
```

mesh 名称在部件内须唯一，vertex 必须被索引引用；实例另填 instance。换拓扑后复核索引，不能用生成参数或代理点代替真实顶点。投影检查不判断点是否被其他面遮挡。

截图脚本逐视图捕获灰模和材质图，记录构建、来源哈希、相机、状态、视口与测量，并检查对照页比例。已配置尺寸/可比较关键点失败时退出非零；未配准结果标 not-comparable。visualReview 保持 NOT_RUN，执行者查看图片后另写视觉结论。按实际功能另跑原有不带 --reference 的交互验收。

## 工具回归

```powershell
node "$skillDir/scripts/verify_reference_tools.mjs" --three "$workDir/deps/node_modules/three" --report "$workDir/evidence/reference-tools.json"
$env:WIREFRAME_TEST_THREE = "$workDir/deps/node_modules/three"
python "$skillDir/scripts/reference_constraints.test.py"
```

这是包含错误反例的开发测试。首轮建模质量仍需用 evals/evals.json 中的未见对象任务验证。
