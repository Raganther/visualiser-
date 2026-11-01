# Backups of the artifacts' databases

What the published pages keep in their databases, copied here so it can be restored into a new artifact (on another
account, say), since each artifact's database is its own and a new one starts empty.

- `studio/<collection>/<doc id>.json`: the Studio (https://claude.ai/artifact/Sh5taBdvs5HZZej4d4qKV2): feedback,
  snaps, likes, songs (your versions of Claude's songs), ideas (the rounds), versions (your DAW versions, saved with
  `putBig`: a document whose id ends `~1`, `~2` … is a part of a big one), sounds (your own sounds), and later projects,
  takes and notes.
- `afterglow/<collection>/<doc id>.json`: the visualiser (https://claude.ai/artifact/RVGKQgxeH9VnoQBLXorKYJ): moments
  (your 👍 / 👎) and comments.

A `:` in a document's id is written `%3A` in its file name (Windows can't have `:` in a name); restoring turns it back.

**To back up:** in a Claude session on the account that owns the artifact, ArtifactData `list` each collection with
`out_dir` set here. **To restore** into a new artifact: publish the page from this repo, then ArtifactData `batch` `set`
each file's document under its id, 50 at a time.

Settings kept only in a browser (`localStorage`) aren't here: they're on the device that set them.
