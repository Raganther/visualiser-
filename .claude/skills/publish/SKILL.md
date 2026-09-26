---
name: publish
description: Build Afterglow into one self-contained page, test the bundle, and republish it to the user's claude.ai Artifact. Use whenever a change should reach the published page ("publish", "republish", "update the artifact", "so I can try it").
---

# Publish the Artifact

The published copy is https://claude.ai/artifact/RVGKQgxeH9VnoQBLXorKYJ. It's built from the working tree, not from `main`.

1. **Tests first.** Run `npm test` if it hasn't passed since the last code change. It takes about 10 minutes; run it in the background.
2. **Build and test the bundle.** Run `npm run test:dist`. It builds `dist/afterglow.html` with esbuild (`npm install` first if `node_modules` is missing), then runs the whole suite against the bundle. Every file must pass. A failure here that `npm test` didn't show usually means a test imports `/src/...` modules, which the bundle doesn't serve. Make that test read the DOM instead.
3. **Republish.** Call the Artifact tool with `file_path: dist/afterglow.html` and `url` set to the address above. Don't pass `icon` on a republish.
   - If the publish is refused because this session hasn't read the live version, read it with `action: "read"` on that URL, then publish again. Never pass `force`.
4. **Report.** Give the user the link and the new version number from the result. Name the things they should look at, and how to reach them (a preset, a Solo button, a lab switch or key).

Notes:
- `dist/` is build output. Don't commit it unless the repo already tracks it (`git ls-files dist`).
- Never put the user's tracks in the bundle or the repo.
