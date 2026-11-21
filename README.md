# Torrão WebAR

Four image targets reveal optimized architectural models and accompanying videos.

## Use
Open the published HTTPS page, press **开启 AR 体验**, allow camera access, then point the camera at one of the complete images in `assets/target-images/`. Video starts muted; controls allow playback and sound. Tracking and camera processing run in the browser.

`tools/targets.html` checks all four target images at three sizes without using a camera.

## Site contents
- Four optimized GLB models, about 18.1 MiB combined, with embedded material textures.
- Four 720p H.264/AAC videos.
- MindAR target database and reference images.
- Locally bundled A-Frame 1.5.0 and MindAR 1.2.5, with their license files in `vendor/`.

Static paths are relative, so the site supports a GitHub Pages repository subpath. `.nojekyll` preserves the static asset layout. The Windows runtime and Blender editing files are distributed separately and are not needed by this website.

## Material notes
Main colors and texture maps were recovered from the original Blender scenes. Missing external soil and vegetation assets use lightweight replacement materials. Dense railings and roof geometry were simplified for AR.
