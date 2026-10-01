import bpy
from mathutils import Vector

path = 'E:/guddaji/artifacts/human-motion-20260927/human-guddaji-motions.blend'
bpy.ops.wm.open_mainfile(filepath=path)

def show_preview():
    scene = bpy.context.scene
    rig = bpy.data.objects['UniRigArmature']
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    rig.animation_data.action = bpy.data.actions['Walk']
    rig.show_in_front = False
    scene.frame_start, scene.frame_end = 1, 37
    scene.frame_set(1)
    scene.sync_mode = 'FRAME_DROP'
    for area in bpy.context.screen.areas:
        if area.type == 'CONSOLE':
            area.type = 'VIEW_3D'
        if area.type == 'VIEW_3D':
            space = area.spaces.active
            space.overlay.show_overlays = False
            space.shading.type = 'MATERIAL'
            space.region_3d.view_location = (0,0,.84)
            space.region_3d.view_distance = 3.05
            space.region_3d.view_rotation = Vector((1.5,-4,.7)).to_track_quat('Z','Y')
            space.region_3d.view_perspective = 'ORTHO'
        elif area.type == 'DOPESHEET_EDITOR':
            area.spaces.active.mode = 'ACTION'
    bpy.ops.wm.save_as_mainfile(filepath=path)
    return None

bpy.app.timers.register(show_preview, first_interval=0.8)
