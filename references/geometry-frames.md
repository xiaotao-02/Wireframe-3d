# 先确定坐标，再添加细节

遇到回转件横倒、挤出件偏到一侧、壳面从外侧消失、玻璃或贴花被吞没时，先核对实际顶点与局部坐标。反复加欧拉旋转或改成双面材质容易把错误藏起来。

## 原生轴与锚点

| 构造 | 默认方向与范围 |
|---|---|
| Three.js CylinderGeometry / LatheGeometry | 绕局部 Y；圆柱以中心为原点，回转体轴向位置由 profile 的第二坐标决定 |
| Three.js TorusGeometry / CircleGeometry | 位于局部 XY，法向 Z |
| slabGeometry / ExtrudeGeometry / flange | 从局部 z=0 挤出到 thickness，不以厚度中心为原点 |
| 本库 latheShell / revolvedSection | 绕局部 Z，轴向位置由传入截面决定 |

轴、螺钉、圆柱优先用 `cylinderBetween(a,b,radius,material)`。已有复杂网格或部件组用 `placeInFrame` 指定完整坐标架；不要只凭“旋转 90°”猜方向。

```js
import {solid,slabGeometry,placeInFrame} from './lib/geometry.js';
const fin=solid(slabGeometry({outline:profileXY,thickness:span}),material);
placeInFrame(fin,{
  origin:center,      // 在父组中的目标锚点
  x:[1,0,0],         // 局部 +X 变为父组 +X
  y:[0,0,1],         // 局部 +Y 变为父组 +Z；局部 +Z 因而变为父组 -Y
  anchor:[0,0,span/2] // 挤出中点落在 center，避免整件偏到一边
});
```

`x/y` 必须垂直且非零，`z=x×y` 保持右手系；覆盖 position/quaternion，保留正比例缩放。反复调用不会叠加旋转。新做的构件先在两个正交方向看一个，再复制到另一侧。镜像安装常需要旋转完整部件，而不是对整组设置负比例；两侧的可见面和文字仍需分别查看。

## 壳面、开口与覆盖层

曲面外侧由参数绕序决定。`auditSurfaceGeometry` 只检查三角面与顶点法向是否一致：二者一起朝内仍可能通过。用单面材质从外侧查看完整主体；沿已知外方向做少量射线或法线检查。非凸壳体不能把“顶点减包围盒中心”一律当成外法线。

对主壳先锁定轴线、肩线、顶线、开口边界等不同形状自由度，再选截面放样或分片曲面。不要为了曲面连续，把本来不同的面板、转折与凹腔挤进同一光滑截面。出现凹陷、折叠或不可见面时，先回到单一灰模，检查边界和绕序，修正后再叠加覆盖层。

开口与内壁共用边界；内衬位于正确轴向与深度，不能遮挡开口要露出的对象。玻璃、灯壳与标牌需要检查实际嵌合，不能以“存在一个网格”代替。

曲面偏移方向、三角绕序、纹理 UV 方向是三件事。贴花采样要覆盖自身局部范围，并足够贴合已显示主体；若两层交叉或近似重合，会闪烁或被吞没。观察实际文字后用 flipU/flipV 调整纹理；需要 90° 转向时显式变换纹理 UV。不要通过反射几何修文字。用相反侧、近景和灰模分别排查，最后恢复交付材质重看。
