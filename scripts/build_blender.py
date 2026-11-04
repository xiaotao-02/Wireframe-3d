"""Run in a separate Blender: --background --factory-startup --python ... -- ..."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

parser=argparse.ArgumentParser()
parser.add_argument('--scene',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
if not bpy.app.background:
    raise RuntimeError('Use a separate background Blender process; this script replaces its scene.')
data=json.loads(args.scene.read_text(encoding='utf-8'))
if data['schema']!='anatomy-3d/1':raise ValueError('Unsupported manifest')
args.out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.render.fps=30;scene.frame_start=1;scene.frame_end=201
scene.world.color=(.35,.35,.35)
scene.view_settings.view_transform='AgX'

def empty(name):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.empty_display_size=.15;return o

def driver(obj,path,index,expression,prop):
    f=obj.driver_add(path,index) if index is not None else obj.driver_add(path)
    d=f.driver;d.type='SCRIPTED';d.expression=expression
    v=d.variables.new();v.name='v';v.type='SINGLE_PROP';v.targets[0].id=control;v.targets[0].data_path=f'["{prop}"]'

control=empty('ANATOMY_CONTROLS')
for name,value in [('explode',0.0),('phase',0.0),('show_cover',False)]:control[name]=value
control.id_properties_ui('explode').update(min=0,max=1,description='0 = assembled, 1 = exploded')
control.id_properties_ui('phase').update(min=0,max=1,description='Shared rotation phase, one full cycle')
control['phase']=0.0;control.keyframe_insert(data_path='["phase"]',frame=1)
control['phase']=1.0;control.keyframe_insert(data_path='["phase"]',frame=201)
if control.animation_data:
    for layer in control.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for k in fc.keyframe_points:k.interpolation='LINEAR'
groups={};collections={}
for g in data['groups']:
    c=bpy.data.collections.new(g['id']+' | '+g['label']);scene.collection.children.link(c);collections[g['id']]=c
    o=empty(g['id']);o.parent=control;o['label']=g['label'];groups[g['id']]=o
    for axis in range(3):driver(o,'location',axis,f'{g["rest"][axis]}+v*{g["explode"][axis]}','explode')
    if g.get('spin'):driver(o,'rotation_euler','xyz'.index(g['spin']),'v*6.283185307179586','phase')
materials={}
def material(color):
    if color in materials:return materials[color]
    rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
    # sRGB source palette to linear, matching Three.js Color management.
    linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m=bpy.data.materials.new(color);m.diffuse_color=(*linear,1);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*linear,1);bsdf.inputs['Metallic'].default_value=.25;bsdf.inputs['Roughness'].default_value=.43
    materials[color]=m;return m

for p in data['parts']:
    mesh=bpy.data.meshes.new(p['id']);mesh.from_pydata(p['mesh']['vertices'],[],p['mesh']['faces']);mesh.update()
    obj=bpy.data.objects.new(p['id'],mesh);collections[p['group']].objects.link(obj);obj.parent=groups[p['group']]
    obj.location=p['pos'];obj.rotation_euler=p['rotation'];obj.data.materials.append(material(p['color']))
    obj['label']=p['label'];obj['description']=p['note'];obj['part_id']=p['id']
    for face in mesh.polygons:face.use_smooth=p['smooth']
    if p['group']=='cover':
        driver(obj,'hide_render',None,'not v','show_cover');driver(obj,'hide_viewport',None,'not v','show_cover')

# A static guide curve: flow animation is implemented in the web starter only.
curve=bpy.data.curves.new('FLOW_GUIDE_SCHEMATIC','CURVE');curve.dimensions='3D';curve.bevel_depth=.013;curve.bevel_resolution=3
spline=curve.splines.new('POLY');spline.points.add(len(data['flow'])-1)
for p,co in zip(spline.points,data['flow']):p.co=(*co,1)
guide=bpy.data.objects.new('FLOW_GUIDE_SCHEMATIC',curve);scene.collection.objects.link(guide);guide.data.materials.append(material('#35a49b'))
driver(guide,'hide_render',None,'v>0.001','explode');driver(guide,'hide_viewport',None,'v>0.001','explode')
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.005));floor=bpy.context.object;floor.name='STUDIO_FLOOR';floor.data.materials.append(material('#e8eae4'))

def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,position,power,size):
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size
    obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=position;aim(obj,(0,0,1));return obj
area('KEY',(-3,-4,7),1600,5);area('FILL',(3,2,5),1100,4);area('RIM',(-1,4,4),800,3)
camdata=bpy.data.cameras.new('CAM_HERO');cam=bpy.data.objects.new('CAM_HERO',camdata);scene.collection.objects.link(cam);cam.location=(-7,-9,6);aim(cam,(-.15,0,1.4));camdata.type='ORTHO';camdata.ortho_scale=7.5;scene.camera=cam
scene.frame_set(1)
bpy.context.view_layer.objects.active=control
for obj in bpy.context.selected_objects:obj.select_set(False)
control.select_set(True)
for screen in bpy.data.screens:
    for area_ui in screen.areas:
        if area_ui.type=='VIEW_3D':area_ui.spaces.active.region_3d.view_perspective='CAMERA'

# Verify evaluated driver poses at assembled / intermediate / exploded states.
checks=[]
for t in (0.0,.5,1.0,0.0):
    control['explode']=t;control.update_tag();bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    for g in data['groups']:
        actual=list(groups[g['id']].evaluated_get(deps).location)
        expected=[a+t*b for a,b in zip(g['rest'],g['explode'])]
        assert max(abs(a-b) for a,b in zip(actual,expected))<1e-5,(g['id'],t,actual,expected)
    checks.append({'explode':t,'passed':True})
scene.frame_set(101);bpy.context.view_layer.update()
phase_angle=groups['rotor'].evaluated_get(bpy.context.evaluated_depsgraph_get()).rotation_euler.x
assert abs(phase_angle-math.pi)<1e-4, {'phase':control['phase'],'angle':phase_angle,'expected':math.pi}
scene.frame_set(1)
mesh_parts=[o for o in scene.objects if o.get('part_id')]
assert len(mesh_parts)==len(data['parts'])
report={'blender':bpy.app.version_string,'parts':len(mesh_parts),'pose_checks':checks,'phase_midpoint_passed':True,'flow':'static schematic guide','blend':'anatomy-demo.blend'}
(args.out/'blender-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(args.out/'anatomy-demo.blend'))
if args.render:
    scene.render.filepath=str(args.out/'anatomy-demo.png');bpy.ops.render.render(write_still=True)
print(json.dumps(report))
