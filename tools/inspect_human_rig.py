import bpy, json
from pathlib import Path

out = Path('E:/guddaji/artifacts/human-motion-20260927')
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
report = {'filepath': bpy.data.filepath, 'objects': [], 'actions': [a.name for a in bpy.data.actions]}
for ob in scene.objects:
    row = {'name': ob.name, 'type': ob.type, 'matrix': [list(r) for r in ob.matrix_world]}
    if ob.type == 'ARMATURE':
        row['bones'] = [{'name': b.name, 'parent': b.parent.name if b.parent else None,
                         'head': list(b.head_local), 'tail': list(b.tail_local),
                         'matrix': [list(r) for r in b.matrix_local], 'deform': b.use_deform}
                        for b in ob.data.bones]
    if ob.type == 'MESH':
        row['vertices'] = len(ob.data.vertices)
        row['bounds'] = [[min(v.co[i] for v in ob.data.vertices), max(v.co[i] for v in ob.data.vertices)] for i in range(3)]
        row['groups'] = [g.name for g in ob.vertex_groups]
        row['modifiers'] = [(m.type, m.object.name if m.type == 'ARMATURE' and m.object else '') for m in ob.modifiers]
    report['objects'].append(row)
(out / 'rig-inspection.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
backup = out / 'human-guddaji-before-motion.blend'
if not backup.exists():
    bpy.ops.wm.save_as_mainfile(filepath=str(backup), copy=True)
print('RIG_INSPECTION_AND_BACKUP_OK', str(out))
