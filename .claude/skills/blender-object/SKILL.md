---
name: blender-object
description: Make a 3D object in Blender (or take the user's .glb) and bring it into Afterglow as a mesh object that moves with the music, optionally with a shape key it plays on the beat. Use when the user wants a new 3D model, creature or prop in the visualiser, or sends a .glb/.gltf.
---

# A Blender object

Afterglow draws any triangle mesh as glowing wire edges over dark glass (`src/render/mesh.js`). A Blender model comes in through glTF: model it, export a `.glb`, import it into a mesh file, wrap it in `meshObject()`. The manta ray (`tools/blender/manta.py`, `src/visuals/objects/manta.js`) is the worked example.

## Blender here

Blender runs in this container as the `bpy` package from PyPI (Blender's download site is blocked; PyPI isn't). Python 3.11 matches `bpy==4.2.0`:

```
python3 -m venv <scratchpad>/bpyenv && <scratchpad>/bpyenv/bin/pip install "bpy==4.2.0"
<scratchpad>/bpyenv/bin/python tools/blender/<name>.py <scratchpad>/<name>.glb
```

The venv lives in the scratchpad (about 400 MB), never in the repo.

## 1. Model it (tools/blender/<name>.py)

Copy `tools/blender/manta.py`. Build the mesh with `bmesh` from maths, in **Blender's orientation**: Z up, the model facing the front view (-Y). `E(x, y, z)` turns the visualiser's axes into Blender's. A model the user makes by hand in Blender's front view comes through the same way.

- **Parts are materials.** Name each material starting with its part number (`3_belly`). Parts take the palette's hues in turn. Parts 7 and up are dark holes; 7 glows on the downbeat (eyes).
- **Low-poly.** The wire look wants roughly 500–1,500 panes, and simple mode draws every pane (the 1,680-pane knot is already heavy there). Triangulate before export.
- **One shape key** (after `Basis`) becomes the morph. The object plays it by a weight from -1 to 1, so make it a pose that reads both ways (wings up is also wings down).
- Export: `bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_morph=True, export_morph_normal=False, export_materials='EXPORT', export_apply=False)`.

## 2. Import it

```
node tools/import-glb.mjs <file.glb> <name> [--panes 1500] [--size .6] [--morph KeyName]
```

This writes `src/visuals/objects/meshes/<name>.js`: `{pos, tri, part, morph?}`, centred and scaled to `--size`. It applies node transforms, welds the corners the exporter split, reads sparse shape keys, and with `--panes` simplifies each part (meshoptimizer, edges kept). A `.glb` the user sends is imported the same way. Check the printed pane count and parts.

## 3. The object (src/visuals/objects/<name>.js)

`meshObject({key, label, words, mesh: {pieces: [MESH], hinge: [0, 0, 0]}, motion})`. The optional `motion(U, P, x)` sets the frame's own movement:
- `U.morph`: the shape key's weight;
- `U.rot`, `U.pitch`: its turn and tip;
- `U.pos`: its position (copy it, don't mutate: it can be a world's anchor).

Drive them from the music: `SIG.barPhase` (in step with the bar while the grid holds), `S.beatPeriod`, `x.J.tension`, `P.beat`.

Then:
- A line in `TUNE` (`chance: 0, size, hinge`, plus its own feel numbers).
- An entry in `OBJECT_VISUALS` in `registry.js`.
- A manual preset in `presets.js` (`journey: false`).
- The CLAUDE.md rows (Objects table, Meshes).

It gets its slider, its key in the O group, Journey's centrepiece pool and the objects test automatically. Adding one changes Journey's draws, so re-record the golden (`npm run golden:update`).

## 4. Check it

- `node tools/look.mjs <name> --out <scratchpad>/look`, both renderers (the `check-visual` skill). Take stills a quarter of a movement apart to see the shape key working.
- `node tests/objects.mjs`: every object draws and shatters, and a model with a morph must play it both ways.
