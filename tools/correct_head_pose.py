"""Run inside the open Blender file. Only head rotation keys are changed.

The untouched scene is saved separately before this script is run.
"""
import bpy
import math
from mathutils import Vector, Quaternion, Matrix

rig = bpy.data.objects['target_character']
head = rig.pose.bones['mixamorig:Head']
scene = bpy.context.scene
assert not rig.get('guddaji_head_corrected'), 'Already corrected; use the backup to retry.'
assert all(track.mute for track in rig.animation_data.nla_tracks), 'Isolate actions first.'
original_action = rig.animation_data.action
original_frame = scene.frame_current
rest_inverse = head.bone.matrix_local.inverted()
actions = ['Running', 'Walking', 'Stand_to_Sit_Transition_M']
report = []

for name in actions:
    action = bpy.data.actions[name]
    rig.animation_data.action = action
    start, end = (int(x) for x in action.frame_range)
    samples = []
    # Capture every original pose before inserting corrected keys.
    for frame in range(start, end + 1):
        scene.frame_set(frame)
        forward = ((head.matrix @ rest_inverse).to_3x3() @ Vector((0, -1, 0))).normalized()
        pitch = math.asin(max(-1.0, min(1.0, forward.z)))
        samples.append((frame, head.matrix.copy(), forward, pitch))
    average = sum(s[3] for s in samples) / len(samples)
    previous = None
    for frame, pose, forward, pitch in samples:
        scene.frame_set(frame)
        if name == 'Stand_to_Sit_Transition_M':
            t = (frame - start) / max(1, end - start)
            baseline = samples[0][3] * (1 - t) + samples[-1][3] * t
            # Keep a small natural nod during sitting; endpoints look forward.
            target_pitch = (pitch - baseline) * 0.4
        else:
            target_pitch = pitch - average
        flat = Vector((forward.x, forward.y, 0)).normalized()
        target = flat * math.cos(target_pitch) + Vector((0, 0, math.sin(target_pitch)))
        correction = forward.rotation_difference(target).to_matrix().to_4x4()
        desired = Matrix.Translation(pose.translation) @ correction @ Matrix.Translation(-pose.translation) @ pose
        local = rig.convert_space(pose_bone=head, matrix=desired, from_space='POSE', to_space='LOCAL')
        rotation = local.to_quaternion().normalized()
        if previous is not None and rotation.dot(previous) < 0:
            rotation.negate()
        head.rotation_quaternion = rotation
        head.keyframe_insert(data_path='rotation_quaternion', frame=frame, group=head.name)
        previous = rotation.copy()
    values = []
    for frame in (start, (start + end) // 2, end):
        scene.frame_set(frame)
        forward = ((head.matrix @ rest_inverse).to_3x3() @ Vector((0, -1, 0))).normalized()
        values.append(round(math.degrees(math.asin(max(-1, min(1, forward.z)))), 1))
    report.append((name, 'head pitch start/middle/end', values))

rig['guddaji_head_corrected'] = True
rig.animation_data.action = bpy.data.actions['Stand_to_Sit_Transition_M']
scene.frame_set(1)
print('HEAD_CORRECTION_OK', report)
bpy.ops.wm.save_as_mainfile(filepath='E:/guddaji/guddaji-head-corrected-20260920.blend')
