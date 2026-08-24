# Mode Protocols & Implementation Reference

CLI invocation examples for every Seedance 2.0 mode, plus the endpoint and parameter reference used by `scripts/generate-seedance.sh`.

## Mode 1: Text-to-Video (t2v)

```bash
# Chinese tier (default) — epic reveal
bash scripts/generate-seedance.sh \
  --subject "hidden Andes temple, mist through the canopy" \
  --intent epic --aspect "16:9" --duration 10 --quality high --view

# Global tier — 21:9 cinematic, 12s
bash scripts/generate-seedance.sh \
  --tier global \
  --subject "neon cyberpunk alley, rain-slicked streets" \
  --intent tense --aspect "21:9" --duration 12 --view

# VIP fast — square social format
bash scripts/generate-seedance.sh \
  --tier vip --fast \
  --subject "product rotating on a pedestal, specular highlights" \
  --intent product --aspect "1:1" --duration 6
```

## Mode 2: Image-to-Video (i2v)

```bash
# Chinese tier — animate with video/audio refs
bash scripts/generate-seedance.sh --mode i2v \
  --file character.jpg --video-file ref_motion.mp4 --audio-file bgm.mp3 \
  --subject "@image1's character walks forward, @video1's camera movement, BGM references @audio1" \
  --quality high --view

# Global tier — 1 image = first frame anchor
bash scripts/generate-seedance.sh --mode i2v --tier global \
  --file hero.jpg \
  --subject "hero strides forward, coat billowing in slow motion" \
  --duration 8 --view

# VIP fast — 3 images, omni ref mode (2-9 images switches to omni)
bash scripts/generate-seedance.sh --mode i2v --tier vip --fast \
  --file char.jpg --file env.jpg --file style.jpg \
  --subject "@image1 character walks through @image2's environment in @image3's style" \
  --duration 10
```

## Mode 3: Extend Video (Chinese tier)

```bash
# Extend naturally
bash scripts/generate-seedance.sh --mode extend \
  --request-id "abc-123-def-456" --duration 10

# Extend with directional prompt
bash scripts/generate-seedance.sh --mode extend \
  --request-id "abc-123-def-456" \
  --subject "camera continues pulling back, revealing the vast city below" \
  --intent reveal --duration 10 --quality high --view
```

## Mode 4: First & Last Frame (Global/VIP)

```bash
# One image = first frame anchor
bash scripts/generate-seedance.sh --mode first-last --tier global \
  --file opening_scene.jpg \
  --subject "smooth cinematic push into the scene" --duration 6 --view

# Two images = interpolate between first and last frame
bash scripts/generate-seedance.sh --mode first-last --tier vip --fast \
  --file start.jpg --file end.jpg \
  --subject "dramatic reveal transition between the two frames" --duration 8 --view
```

## Mode 5: Omni Reference (omni)

```bash
# Chinese tier — images + video + audio refs
bash scripts/generate-seedance.sh --mode omni --tier chinese \
  --file character.jpg --video-file ref_edit.mp4 --audio-file track.mp3 \
  --subject "@image1's character performs moves from @video1, BGM references @audio1" \
  --duration 15 --quality high --view

# Global tier — images + audio, no video refs
bash scripts/generate-seedance.sh --mode omni --tier global \
  --file portrait.jpg --audio-file bgm.mp3 \
  --subject "@image1 is the main character. Walking through a neon-lit city at night. BGM references @audio1." \
  --aspect "16:9" --duration 8 --view

# VIP tier — with trained omni character
bash scripts/generate-seedance.sh --mode omni --tier vip --fast \
  --subject "@omni-character:char_1775422630065_4vbana walks through a garden at golden hour" \
  --aspect "16:9" --duration 10 --view

# With @character ref (from character mode)
bash scripts/generate-seedance.sh --mode omni --tier global \
  --subject "@character:cab9517f-1818-4910-8d66 walks down a rain-soaked alley, cinematic tracking shot" \
  --duration 8 --view
```

## Mode 6: Train Omni Reference Character (omni-train)

```bash
# Train from a single portrait
bash scripts/generate-seedance.sh --mode omni-train \
  --file portrait.jpg \
  --character-name "Alex" \
  --character-desc "A brave explorer with piercing blue eyes"

# Use in omni prompts after training completes:
# @omni-character:<character_id returned>
```

## Mode 7: Character Sheet (character, Chinese tier)

```bash
# Build character from 1–3 reference images
bash scripts/generate-seedance.sh --mode character \
  --file ref1.jpg --file ref2.jpg \
  --character-name "Hero" \
  --subject "red leather jacket with black jeans and white sneakers"

# Use the returned request_id in t2v/i2v/omni:
# @character:<request_id>
```

## Mode 8: Video Edit (video-edit, Chinese tier)

```bash
# Replace subject in an existing video
bash scripts/generate-seedance.sh --mode video-edit \
  --video-url "https://example.com/input.mp4" \
  --file replacement_character.jpg \
  --subject "Replace the running man with @image1. Preserve exact motion, speed, and camera shake." \
  --quality high --view

# Edit with watermark removal in one step
bash scripts/generate-seedance.sh --mode video-edit \
  --video-file source.mp4 \
  --subject "Subvert the plot — the character's expression shifts from warmth to cold determination." \
  --remove-watermark --view
```

## Mode 9: Watermark Removal (watermark-remove)

```bash
# Basic watermark removal
bash scripts/generate-seedance.sh --mode watermark-remove \
  --video-url "https://example.com/seedance_output.mp4" --view

# Pro watermark removal (100MB limit, better quality)
bash scripts/generate-seedance.sh --mode watermark-remove \
  --video-file my_video.mp4 --pro --view
```

## Async Pattern

```bash
# Submit and get request_id immediately
RESULT=$(bash scripts/generate-seedance.sh --tier vip --fast --subject "..." --async --json)
REQUEST_ID=$(echo "$RESULT" | jq -r '.request_id')

# Check status later
bash ../../../../core/media/generate-video.sh --result "$REQUEST_ID"
```

## Endpoint Reference

| Mode | Tier | Endpoint |
|:---|:---|:---|
| `t2v` | chinese | `seedance-v2.0-t2v` |
| `t2v` | global | `seedance-2-text-to-video{-fast}` |
| `t2v` | vip | `seedance-2-vip-text-to-video{-fast}` |
| `i2v` | chinese | `seedance-v2.0-i2v` |
| `i2v` | global | `seedance-2-image-to-video{-fast}` |
| `i2v` | vip | `seedance-2-vip-image-to-video{-fast}` |
| `extend` | chinese | `seedance-v2.0-extend` |
| `first-last` | global | `seedance-2-first-last-frame{-fast}` |
| `first-last` | vip | `seedance-2-vip-first-last-frame{-fast}` |
| `omni` | chinese | `seedance-2.0-omni-reference` |
| `omni` | global | `seedance-2-omni-reference-no-video{-fast}` |
| `omni` | vip | `seedance-2-vip-omni-reference{-fast}` |
| `omni-train` | any | `seedance-2-omni-reference-train` |
| `character` | any | `seedance-2-character` |
| `video-edit` | chinese | `seedance-v2.0-video-edit` |
| `watermark-remove` | — | `seedance-2.0-watermark-remover` / `seedance-2-video-watermark-remover-pro` |

## Parameter Differences by Tier

| Parameter | Chinese | Global | VIP |
|:---|:---|:---|:---|
| `aspect_ratio` | 16:9, 9:16, 4:3, 3:4 | + 21:9, 1:1 | + 21:9, 1:1 |
| `duration` | 5 / 10 / 15 (enum) | 4–15 (any int) | 4–15 (any int) |
| `quality` | basic / high | — (not supported) | — (not supported) |
| `video_files` (omni) | ✅ up to 3 | ❌ | ❌ |
| `audio_files` (omni) | ✅ up to 3 | ✅ up to 3 | ✅ up to 3 |
| Fast variant | ❌ | ✅ (`--fast`) | ✅ (`--fast`) |
