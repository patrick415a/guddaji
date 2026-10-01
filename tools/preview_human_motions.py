import bpy, math, json
from pathlib import Path
from mathutils import Vector

out = Path('E:/guddaji/artifacts/human-motion-20260927')
scene = bpy.context.scene
rig = bpy.data.objects['UniRigArmature']
mesh = bpy.data.objects['output']
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 600
scene.render.resolution_y = 660
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world.color = (0.65,0.65,0.65)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.72,0.79,0.85,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.65
scene.view_settings.view_transform = 'AgX'
for o in list(scene.objects):
    if o.type in ('LIGHT','CAMERA'):
        o.hide_render = True

def light(name, pos, power, size):
    d=bpy.data.lights.new(name,'AREA')
    d.energy=power
    d.shape='DISK'
    d.size=size
    o=bpy.data.objects.new(name,d)
    scene.collection.objects.link(o)
    o.location=pos
    o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()

light('Preview_Key',(2,-3,4),230,4)
light('Preview_Fill',(-3,-1,2),110,3)
light('Preview_Rim',(1,2,3),180,3)
d=bpy.data.cameras.new('Preview_Camera')
cam=bpy.data.objects.new('Preview_Camera',d)
scene.collection.objects.link(cam)
scene.camera=cam
d.type='ORTHO'
d.ortho_scale=1.97
def camera(pos):
    cam.location=pos
    cam.rotation_euler=(Vector((0,0,.86))-cam.location).to_track_quat('-Z','Y').to_euler()
camera((2.1,-4,1.95))

bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.007))
floor=bpy.context.object
floor.name='Preview_Floor'
mat=bpy.data.materials.new('Preview_Floor')
mat.diffuse_color=(.76,.82,.84,1)
floor.data.materials.append(mat)

checks=[]
for action in bpy.data.actions:
    if action.name not in ('Idle','Walk','Run','SitDown','StandUp','Seated'):
        continue
    rig.animation_data.action=action
    endpoints=[]
    for f in [int(action.frame_range[0]),int(action.frame_range[1])]:
        scene.frame_set(f)
        endpoints.append([list(b.matrix.translation) + list(b.matrix.to_quaternion()) for b in rig.pose.bones])
    diff=max(abs(v-w) for a,b in zip(*endpoints) for v,w in zip(a,b))
    checks.append({'action':action.name,'endpoint_difference':diff})
(out/'loop-checks.json').write_text(json.dumps(checks,indent=2))

for name, frame, label in [('Idle',1,'idle'),('Walk',7,'walk'),('Run',6,'run'),('SitDown',43,'seated'),('SitDown',22,'sitting-mid')]:
    rig.animation_data.action=bpy.data.actions[name]
    scene.frame_set(frame)
    camera((2.1,-4,1.95))
    scene.render.filepath=str(out/f'preview-{label}.png')
    bpy.ops.render.render(write_still=True)
    if label in ('walk','seated'):
        camera((4,0,1.3))
        scene.render.filepath=str(out/f'preview-{label}-side.png')
        bpy.ops.render.render(write_still=True)
print('PREVIEWS_COMPLETE')
