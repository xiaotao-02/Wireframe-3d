"""Original illustrative centrifugal pump; generate the shared Z-up mesh manifest."""
import argparse
import json
import math
from pathlib import Path


def box(size):
    x, y, z = [v / 2 for v in size]
    v = [[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]]
    quads = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    return {'vertices':v, 'faces':[list(t) for a,b,c,d in quads for t in ((a,b,c),(a,c,d))]}


def lathe(profile, segments=64):
    # X-axis revolution; duplicate rings at profile creases to preserve hard edges.
    v, f = [], []
    for k in range(len(profile)):
        p, q = profile[k], profile[(k+1) % len(profile)]
        off = len(v)
        for x,r in (p,q):
            v.extend([[x,r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments)] for i in range(segments)])
        for i in range(segments):
            a,b = off+i, off+(i+1)%segments
            c,d = a+segments,b+segments
            f.extend([[a,b,c],[b,d,c]])
    return {'vertices':v,'faces':f}


def ring(length, outer, inner=0.001):
    return lathe([[-length/2,inner],[-length/2,outer],[length/2,outer],[length/2,inner]])


def blade(angle):
    # Curved, closed extruded blade, not a rectangular placeholder.
    yz = []
    for side, ts in ((-1,range(13)),(1,reversed(range(13)))):
        for i in ts:
            t = i/12
            r = .23+.47*t
            a = angle+.65*t + side*.035/r
            yz.append([r*math.cos(a),r*math.sin(a)])
    n=len(yz)
    v = [[x,y,z] for x in (-.085,.085) for y,z in yz]
    f = []
    # Fan triangulation works for this narrow, monotone blade strip by paired cells.
    for i in range(12):
        a,b,c,d=i,i+1,n-2-i,n-1-i
        f += [[a,c,b],[a,d,c],[a+n,b+n,c+n],[a+n,c+n,d+n]]
    for i in range(n):
        j=(i+1)%n
        f += [[i,j,j+n],[i,j+n,i+n]]
    return {'vertices':v,'faces':f}


def build():
    groups = [
      {'id':'base','label':'支架与底座','rest':[0,0,0],'explode':[0,0,0]},
      {'id':'casing','label':'泵体与出口','rest':[-.9,0,1.25],'explode':[0,0,.30]},
      {'id':'rotor','label':'叶轮与传动轴','rest':[-.9,0,1.25],'explode':[-.25,0,.30],'spin':'x'},
      {'id':'cover','label':'前盖与轴向入口','rest':[-1.26,0,1.25],'explode':[-1.35,0,.30],'cover':True},
      {'id':'motor','label':'电机与联轴器','rest':[.75,0,1.25],'explode':[.95,0,.30]},
    ]
    parts=[]
    def part(pid, label, group, mesh, pos=(0,0,0), color='#bac5c8', rotation=(0,0,0), note='', smooth=True):
        parts.append(dict(id=pid,label=label,group=group,mesh=mesh,pos=pos,rotation=rotation,color=color,smooth=smooth,note=note or label))
    part('baseplate','铸造底座','base',box([4.3,1.75,.16]),(0,0,.12),'#394c55',smooth=False)
    part('pump_foot','泵体支脚','base',box([.27,.6,.20]),(-.9,0,.30),'#738b94',smooth=False)
    for x in (.70,1.4):
        part(f'support_{x}','承力支座','base',box([.27,1,.6]),(x,0,.48),'#738b94',smooth=False)
    part('chamber','环形泵腔（简化）','casing',ring(.48,.92,.77),color='#718e98',note='保留壁厚与内部空腔；环形轮廓简化了真实蜗壳，不能用于流体或制造计算。')
    part('backplate','后侧密封端板','casing',ring(.10,.92,.13),(.29,0,0),'#90a5ab')
    part('outlet','径向出口管','casing',ring(.85,.18,.125),(0,0,1.25),'#718e98',(0,-math.pi/2,0),'真实空心管，示意液体由泵腔进入出口。')
    part('outlet_flange','出口法兰','casing',ring(.12,.28,.125),(0,0,1.68),'#d0d8d8',(0,-math.pi/2,0))
    part('impeller_back','叶轮背盘','rotor',ring(.07,.73,.115),(.12,0,0),'#c67434')
    part('hub','叶轮轮毂','rotor',ring(.30,.23,.10),color='#eaa755')
    part('shaft','传动轴','rotor',ring(1.65,.095),(.75,0,0),'#cbd1ce')
    for i in range(7):
        part(f'blade_{i}','后弯叶片 '+str(i+1),'rotor',blade(i*math.tau/7),color='#e9a759',note='叶片旋转由统一相位驱动；叶形仅作结构解释。',smooth=False)
    part('cover_plate','可移除前盖','cover',ring(.13,.94,.19),color='#8da6ad',note='移开前盖观察叶轮；这是拆盖展示，不是有封口的几何剖切。')
    part('inlet','轴向入口管','cover',ring(.72,.22,.16),(-.41,0,0),'#9db5bb')
    part('inlet_flange','入口法兰','cover',ring(.12,.34,.16),(-.82,0,0),'#cdd7d8')
    for i in range(10):
        a=i*math.tau/10
        part(f'cover_bolt_{i}','前盖螺栓 '+str(i+1),'cover',ring(.08,.055),(-.105,.84*math.cos(a),.84*math.sin(a)),'#465d67')
    part('motor_body','电机机壳','motor',ring(1.25,.51,.41),(.25,0,0),'#315869')
    part('motor_rear','电机后端盖','motor',ring(.12,.52),(.93,0,0),'#426c7b')
    part('motor_front','电机前端盖','motor',ring(.1,.52,.11),(-.43,0,0),'#87a0a7')
    part('coupling','联轴器','motor',ring(.30,.23,.10),(-.66,0,0),'#d6a359')
    for i in range(18):
        a=i*math.tau/18
        part(f'fin_{i}','散热筋 '+str(i+1),'motor',box([1.13,.055,.12]),(.25,.53*math.cos(a),.53*math.sin(a)),'#527986',(a-math.pi/2,0,0),smooth=False)
    part('terminal','接线盒','motor',box([.43,.42,.22]),(.3,0,.66),'#315869',smooth=False)
    return dict(schema='anatomy-3d/1',title='离心泵 · 结构与流向',subtitle='原创示意模型 / Z-up · 米 / 非工程仿真',groups=groups,parts=parts,
      flow=[[-2.5,0,1.25],[-1.15,0,1.25],[-.9,0,1.25],[-.9,0,1.8],[-.9,0,2.35],[-.9,0,3.05]])


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    model=build()
    args.output.write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'{len(model["parts"])} parts -> {args.output}')
