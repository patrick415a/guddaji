"""Create editable actions on the inspected UniRig skeleton; never replace web assets."""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

OUT = Path('E:/guddaji/artifacts/human-motion-20260927')
RIG = bpy.data.objects['UniRigArmature']
MESH = bpy.data.objects['output']
SCENE = bpy.context.scene
SCENE.render.fps = 30
SCENE.render.fps_base = 1
RIG.animation_data_create()
assert not list(bpy.data.actions), 'Use the untouched backup to generate motions.'

# Names and chains verified from this file, not from Mixamo conventions.
MAP = {
    'root': 'Bone_000', 'pelvis': 'Bone_001',
    'waist': 'Bone_005', 'spine': 'Bone_004', 'chest': 'Bone_003',
    'neck_base': 'Bone_002', 'neck': 'Bone_018', 'head': 'Bone_017',
    'L': {'clavicle': 'Bone_034', 'upper': 'Bone_033', 'fore': 'Bone_032',
          'hand': 'Bone_031', 'thigh': 'Bone_010', 'shin': 'Bone_009', 'foot': 'Bone_008'},
    'R': {'clavicle': 'Bone_026', 'upper': 'Bone_025', 'fore': 'Bone_024',
          'hand': 'Bone_023', 'thigh': 'Bone_015', 'shin': 'Bone_014', 'foot': 'Bone_013'},
}
REST = {b.name: b.matrix_local.copy() for b in RIG.data.bones}
PREV = {}
IK_ERRORS = []
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
TAU = math.tau

def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * t * (10 + t * (-15 + 6 * t))

def qrot(x=0, y=0, z=0):
    return Quaternion(Z, math.radians(z)) @ Quaternion(Y, math.radians(y)) @ Quaternion(X, math.radians(x))

def rotate(name, x=0, y=0, z=0):
    b = RIG.pose.bones[name]
    rest = REST[name].to_quaternion()
    b.rotation_quaternion = rest.inverted() @ qrot(x, y, z) @ rest

def refresh():
    bpy.context.view_layer.update()

def reset_pose():
    for b in RIG.pose.bones:
        b.rotation_mode = 'QUATERNION'
        b.matrix_basis = Matrix.Identity(4)

def root_offset(offset):
    b = RIG.pose.bones[MAP['root']]
    b.location = REST[b.name].to_3x3().inverted() @ Vector(offset)

def orient_to(name, start, end):
    rest = REST[name]
    rest_dir = (RIG.data.bones[name].tail_local - RIG.data.bones[name].head_local).normalized()
    rotation = rest_dir.rotation_difference((end - start).normalized()) @ rest.to_quaternion()
    RIG.pose.bones[name].matrix = Matrix.Translation(start) @ rotation.to_matrix().to_4x4()

def leg(side, target, pitch=0):
    """Two-link solve keeps the planted shoe in place while the hips move."""
    chain = MAP[side]
    upper, lower, foot = [RIG.pose.bones[chain[n]] for n in ('thigh', 'shin', 'foot')]
    hip = upper.head.copy()
    l1, l2 = upper.bone.length, lower.bone.length
    delta = target - hip
    raw = delta.length
    dist = max(abs(l1-l2)+0.00001, min(raw, l1+l2-0.00001))
    if raw > l1+l2:
        IK_ERRORS.append(raw-(l1+l2))
    direction = delta.normalized()
    along = (l1*l1-l2*l2+dist*dist)/(2*dist)
    bend = Vector((0, -1, 0))
    bend = (bend-direction*bend.dot(direction)).normalized()
    knee = hip + direction*along + bend*math.sqrt(max(0, l1*l1-along*along))
    ankle = hip + direction*dist
    orient_to(upper.name, hip, knee)
    refresh()
    orient_to(lower.name, knee, ankle)
    refresh()
    foot.matrix = Matrix.Translation(ankle) @ qrot(x=pitch).to_matrix().to_4x4() @ REST[foot.name].to_quaternion().to_matrix().to_4x4()
    refresh()

def arms(phase=0, run=False, idle=0, sitting=0):
    for side, sign, shift in [('L', 1, 0), ('R', -1, math.pi)]:
        chain = MAP[side]
        swing = math.cos(phase+shift)
        # Lower the A-pose arms and keep elbows softly bent.
        rotate(chain['upper'], x=((32 if run else 18)*swing)*(1-sitting)-20*sitting,
               y=sign*(23-9*sitting), z=sign*1.5*idle)
        rotate(chain['fore'], x=-((63 if run else 16)+ (10 if run else 5)*swing + 17*sitting))
        rotate(chain['hand'], x=5, y=-sign*3)

def foot_path(side, phase, run):
    p = phase % 1
    stance = 0.38 if run else 0.62
    stride = 0.105 if run else 0.070
    lift = 0.070 if run else 0.040
    rest = RIG.data.bones[MAP[side]['foot']].head_local
    if p < stance:
        u = p/stance
        y = -stride + 2*stride*u
        height = 0
        pitch = (3*(1-u)**5 - 7*u**6) if not run else -7*u**4
    else:
        u = (p-stance)/(1-stance)
        y = stride - 2*stride*(u-math.sin(TAU*u)/TAU)
        height = lift*math.sin(math.pi*u)**1.3
        pitch = -13*math.sin(math.pi*u) + 3*u**5
    return Vector((rest.x, rest.y+y, rest.z+height)), pitch

def pose(kind, t):
    reset_pose()
    if kind in ('Walk', 'Run'):
        run = kind == 'Run'
        phase = TAU*t
        dz = (-0.045 + 0.027*math.sin(2*phase)) if run else (-0.026 + 0.007*math.cos(2*phase))
        root_offset((0.006*math.sin(phase), 0, dz))
        rotate(MAP['pelvis'], y=1.4*math.sin(phase), z=2.0*math.cos(phase))
        rotate(MAP['waist'], x=4 if run else 1.0)
        rotate(MAP['chest'], x=3 if run else 0.7, z=-3*math.cos(phase))
        rotate(MAP['neck'], x=-3 if run else -0.7)
        rotate(MAP['head'], x=(-3 if run else -1)+0.6*math.sin(2*phase), z=0.8*math.cos(phase))
        arms(phase, run=run)
        refresh()
        for side, shift in [('L', 0), ('R', 0.5)]:
            target, pitch = foot_path(side, t+shift, run)
            leg(side, target, pitch)
    elif kind == 'Idle':
        phase = TAU*t
        root_offset((0.0025*math.sin(phase), 0, -0.013+0.002*math.sin(phase)))
        rotate(MAP['chest'], x=0.7*math.sin(phase), z=0.5*math.sin(phase))
        rotate(MAP['head'], x=-0.5*math.sin(phase), z=-0.7*math.sin(phase))
        arms(math.pi/2, idle=math.sin(phase))
        refresh()
        for side in ('L','R'):
            leg(side, RIG.data.bones[MAP[side]['foot']].head_local.copy())
    else:
        # Transfer weight forward, lower hips backwards, then settle upright.
        sit = smooth(t) if kind == 'SitDown' else (1-smooth(t) if kind == 'StandUp' else 1)
        lean = 14*math.sin(math.pi*sit)+3*sit
        root_offset((0, 0.143*sit, -0.137*sit-0.013*(1-sit)))
        rotate(MAP['pelvis'], x=-3*sit)
        rotate(MAP['waist'], x=lean*0.5)
        rotate(MAP['chest'], x=lean*0.5)
        rotate(MAP['neck'], x=-lean*0.45)
        rotate(MAP['head'], x=-lean*0.5)
        arms(math.pi/2, sitting=sit)
        refresh()
        for side in ('L','R'):
            leg(side, RIG.data.bones[MAP[side]['foot']].head_local.copy())
    refresh()

def bake(name, frames):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    RIG.animation_data.action = action
    PREV.clear()
    before = len(IK_ERRORS)
    for f in range(frames+1):
        SCENE.frame_set(f+1)
        pose(name, f/frames)
        for b in RIG.pose.bones:
            q = b.rotation_quaternion.copy().normalized()
            if b.name in PREV and q.dot(PREV[b.name]) < 0:
                q.negate()
            b.rotation_quaternion = q
            PREV[b.name] = q.copy()
            b.keyframe_insert('rotation_quaternion', frame=f+1, group=b.name)
            if b.name == MAP['root']:
                b.keyframe_insert('location', frame=f+1, group=b.name)
    # Baked samples must not overshoot between frames.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for key in fc.keyframe_points:
                        key.interpolation = 'LINEAR'
    action['description'] = {'Idle':'Gentle breathing, planted feet', 'Walk':'In-place relaxed walk',
        'Run':'In-place light run', 'SitDown':'Stand to chair seat; feet planted',
        'StandUp':'Chair seat to standing', 'Seated':'Hold seated pose'}[name]
    action['loop'] = name in ('Idle','Walk','Run','Seated')
    return {'name': name, 'frames': frames+1, 'seconds': frames/30,
            'reach_clamps': len(IK_ERRORS)-before}

REPORT = [bake(name, frames) for name, frames in [('Idle',90),('Walk',36),('Run',24),('SitDown',42),('Seated',30),('StandUp',36)]]

# The original mesh weights are preserved. Rig names stay compatible with the source.
RIG['motion_bone_map'] = json.dumps(MAP)
RIG['motion_notes'] = 'In-place locomotion. SitDown/StandUp contain pelvis translation; position the character root at the feet in front of a seat.'
RIG.animation_data.action = bpy.data.actions['Walk']
SCENE.frame_start, SCENE.frame_end = 1, 37
SCENE.frame_set(1)
for obj in bpy.context.selected_objects:
    obj.select_set(False)
RIG.select_set(True)
MESH.select_set(True)
bpy.context.view_layer.objects.active = RIG
RIG.show_in_front = False
RIG.show_name = False
for area in bpy.context.screen.areas:
    if area.type == 'CONSOLE':
        area.type = 'VIEW_3D'
    if area.type == 'VIEW_3D':
        area.spaces.active.overlay.show_overlays = False
        region = area.spaces.active.region_3d
        region.view_location = (0,0,.86)
        region.view_distance = 3.1
        region.view_rotation = Vector((1.5,-4,1.0)).to_track_quat('Z','Y')
        region.view_perspective = 'ORTHO'
    if area.type == 'DOPESHEET_EDITOR':
        area.spaces.active.mode = 'ACTION'

blend = OUT / 'human-guddaji-motions.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))

props = bpy.ops.export_scene.gltf.get_rna_type().properties
options = dict(filepath=str(OUT / 'human-guddaji-motions.glb'), export_format='GLB',
               use_selection=True, export_animations=True, export_frame_range=False,
               export_force_sampling=True, export_skins=True, export_yup=True)
if 'export_animation_mode' in props:
    options['export_animation_mode'] = 'ACTIONS'
if 'export_all_armature_actions' in props:
    options['export_all_armature_actions'] = True
if 'export_rest_position_armature' in props:
    options['export_rest_position_armature'] = True
bpy.ops.export_scene.gltf(**options)
(OUT / 'motion-report.json').write_text(json.dumps({'actions':REPORT,'max_reach_clamp':max(IK_ERRORS,default=0),'bone_map':MAP},indent=2),encoding='utf-8')
print('HUMAN_MOTIONS_CREATED', REPORT)
