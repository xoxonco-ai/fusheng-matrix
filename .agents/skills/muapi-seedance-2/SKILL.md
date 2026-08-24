---
name: muapi-seedance-2
description: Expert Cinema Director skill for Seedance 2.0 (ByteDance) — high-fidelity video generation across Chinese, Global, and VIP tiers. Supports text-to-video, image-to-video, first-last-frame, omni reference, character training, omni-reference training, video editing, and watermark removal.
metadata:
  slug: muapi-seedance-2
  version: "0.3.0"
  acceptLicenseTerms: "true"
---

# 🎬 Seedance 2.0 Cinema Expert

**The definitive skill for "Director-Level" AI video orchestration.**
Seedance 2.0 is not a descriptive model; it is an *instructional* model. It responds best to technical cinematography, physics directives, and precise camera grammar.

## Core Competencies

1.  **Text-to-Video (t2v)**: Generate cinematic video from a Director Brief — Chinese, Global, or VIP tier.
2.  **Image-to-Video (i2v)**: Animate 1–9 reference images — Chinese, Global (smart mode), or VIP tier.
3.  **Video Extension (extend)**: Seamlessly continue an existing Seedance 2.0 video (Chinese tier).
4.  **First & Last Frame (first-last)**: Interpolate a fluid video between a start image and end image (Global/VIP).
5.  **Omni Reference (omni)**: Full multimodal reference with images + audio + character refs (all tiers).
6.  **Omni Reference Training (omni-train)**: Train a custom persistent character for identity-consistent generation.
7.  **Character Sheet (character)**: Build a reusable character from 1–3 images (Chinese tier).
8.  **Video Edit (video-edit)**: Edit an existing video with a prompt + optional reference images (Chinese tier).
9.  **Watermark Removal (watermark-remove)**: Strip Seedance 2.0 watermarks (basic or Pro).

---

## 🏷️ Tiers

| Tier | Flag | Censorship | Aspect Ratios | Duration | Quality param |
|:---|:---|:---|:---|:---|:---|
| **Chinese** (default) | `--tier chinese` | Low | 16:9, 9:16, 4:3, 3:4 | 5 / 10 / 15 s | Yes (basic/high) |
| **Global** | `--tier global` | Standard | + 21:9, 1:1 | Any 4–15 s | No |
| **VIP** | `--tier vip` | Low | + 21:9, 1:1 | Any 4–15 s | No |

Add `--fast` to any Global or VIP call to use the fast-queue variant (lower latency, same quality).

---

## 📥 Input Limits

| Input Type | Chinese i2v/omni | Global/VIP i2v/omni | Formats | Max Size |
|:---|:---|:---|:---|:---|
| Images | ≤ 9 | ≤ 9 | jpeg, png, webp | 30 MB each |
| Videos | ≤ 3 (omni only) | Not supported | mp4, mov | 50 MB each |
| Audio | ≤ 3 | ≤ 3 | mp3, wav | 15 MB each |
| **First-Last** | — | 1–2 images | jpeg, png, webp | 30 MB each |
| **Video Edit** | 1 video + ≤ 9 imgs | — | mp4 ≤ 10 MB / 15s | — |

**Output**: 4–15 seconds, auto-generated sound, 480p–720p.

---

## ⚠️ Restrictions

- **No realistic human faces** in uploaded images/videos (except character/omni-train modes).
- `--mode extend` requires a `request_id` from a prior `seedance-v2.0-t2v` or `seedance-v2.0-i2v` job.
- `--mode first-last` requires `--tier global` or `--tier vip`.
- Global/VIP omni does **not** support video references (images + audio only).
- `--quality` applies to Chinese tier only.

---

## 🔗 Core Syntax: The @ Reference System

Assign explicit roles to each uploaded asset. Tags differ by mode.

### Chinese Tier (i2v, omni)
```
@image1  @image2  ...  @image9    (images_list order)
@video1  @video2  @video3         (video_files order)
@audio1  @audio2  @audio3         (audio_files order)
```

### Global/VIP Omni (omni-reference-no-video / vip-omni-reference)
```
@image1  @image2  ...  @image9    (images_list order)
@audio1  @audio2  @audio3         (audio_files order)
```

### Character References (all tiers)
```
@character:<request_id>            — from seedance-2-character or completed t2v/i2v job
@omni-character:<character_id>     — from seedance-2-omni-reference-train output
```

### Role Assignment Table

| Purpose | Example Syntax |
|:---|:---|
| First frame | `@Image1 as the first frame` |
| Last frame | `@Image2 as the last frame` |
| Character appearance | `@Image1's character as the subject` |
| Scene / background | `scene references @Image3` |
| Camera movement | `reference @Video1's camera movement` |
| Action / motion | `reference @Video1's action choreography` |
| Visual effects | `completely reference @Video1's effects and transitions` |
| Rhythm / tempo | `video rhythm references @Video1` |
| Voice / tone | `narration voice references @Video1` |
| Background music | `BGM references @Audio1` |
| Sound effects | `sound effects reference @Video3's audio` |
| Outfit / clothing | `wearing the outfit from @Image2` |
| Product appearance | `product details reference @Image3` |

### Multi-Reference Combination
```
@Image1's character as the subject, reference @Video1's camera movement
and action choreography, BGM references @Audio1, scene references @Image2
```

---

## 🏗️ Technical Specification: The Director Brief

Structure prompts using this six-component hierarchy. Order matters — composition first, texture and micro-motion last:

| Component | Instruction Type | Example |
|:---|:---|:---|
| **Scene** | Environment + Lighting | "A rain-soaked cyberpunk street, magenta neon reflections on wet asphalt." |
| **Subject** | Identity + Detail | "A woman in a black trenchcoat, determined focus, cinematic skin textures." |
| **Action** | Fluid Interaction | "Walking forward through the crowd, coat billowing slightly in the wind." |
| **Camera** | Movement + Lens + Speed | "Medium tracking shot, 35mm lens, slow dolly backward over 6s. Subtle handheld jitter." |
| **Audio** | Music + SFX + Ambience | "Low ambient hum, distant traffic, single piano note at 5s. No dialogue." |
| **Pacing/Style** | Timing + Mood + Grade | "Cinematic epic, warm color grade, shallow DOF. Slow build — single action only, no scene cuts." |

> **Seedance 2.0 generates audio natively.** Always include an Audio directive — even one sentence. Without it the model generates random ambient sound that may not match your scene.

### Time-Segmented Prompts (Recommended for 10s+ videos)
Break prompts into timed segments for precise control:
```
0–3s: [opening scene, camera move, establishing action]
3–6s: [mid-section development, subject in motion]
6–10s: [climax or key action beat]
10–15s: [resolution, brand/product hold, text/tagline fade in]
```

> **Single-beat rule:** Each segment should contain one action. 4–7s = one beat. 10–15s = 3–4 beats maximum. Overloading a segment with multiple narrative changes degrades output quality.

### Negative Prompting

Seedance 2.0 supports appending negative guidance directly in the prompt. Use plain language at the end:

```
[your director brief above]
Avoid: camera shake, jump cuts, lens distortion, overexposure, watermarks, text overlays.
```

Common negative additions:
- `Avoid: abrupt cuts, scene changes, multiple locations.` (for single-take shots)
- `Avoid: human faces, realistic people.` (for product-only content)
- `Avoid: fast motion, blur, unstable framing.` (for smooth product reveals)

---

## 🎥 Camera Language Reference

### Basic Movements
| Term | Description |
|:---|:---|
| Push in / Slow push | Camera moves toward subject |
| Pull back / Pull away | Camera moves away from subject |
| Pan left/right | Camera rotates horizontally |
| Tilt up/down | Camera rotates vertically |
| Track / Follow shot | Camera follows subject movement |
| Orbit / Revolve | Camera circles around subject |
| One-take / Oner | Continuous shot with no cuts |

### Advanced Techniques
| Term | Description |
|:---|:---|
| Hitchcock zoom (dolly zoom) | Push in + zoom out — creates vertigo effect |
| Fisheye lens | Ultra-wide distorted lens |
| Low angle / High angle | Camera below/above subject |
| Bird's eye / Overhead | Top-down view |
| First-person POV (FPV) | Immersive subjective camera from character/object's eyes — GoPro-style wide angle, forward motion, no cuts |
| Drone flythrough | Cinematic aerial descent — gimbal-stabilized, sweeping lateral arc, DJI Inspire aesthetic |
| Architectural flythrough | Ground-level continuous dolly through connected spaces — one-take, practical lighting |
| Whip pan | Very fast horizontal pan with motion blur |
| Crane shot | Vertical movement like a crane arm |

### Shot Sizes
| Term | Description |
|:---|:---|
| Extreme close-up | Eyes, mouth, or small detail only |
| Close-up | Face fills frame |
| Medium close-up | Head and shoulders |
| Medium shot | Waist up |
| Full shot | Entire body |
| Wide / Establishing shot | Full environment |

---

## 🧠 Prompt Optimization Protocol

**The Agent MUST transform user intent into a technical "Director Brief" before execution.**

1.  **Technical Grammar**: Use camera terms: *Dolly In/Out, Crane Shot, Whip Pan, Tracking Shot, Anamorphic Lens, Shallow Depth of Field, High-Speed Dive, Orbital Arc*.
2.  **Physics Directives**: Use "caustic patterns," "volumetric rays," or "subsurface scattering" instead of "good lighting."
3.  **Timecode Notation**: For multi-beat scenes, use `[00:00-00:05s]` format to specify timing.
4.  **Tag References**: If files provided, use: *"Replicate the camera movement of @video1 while maintaining the visual style of @image1."* (lowercase, 1-based index)
5.  **ORDER MATTERS**: Tokens at the start define composition; tokens at the end define texture and micro-motion.
6.  **Multi-Image i2v**: Provide up to 9 reference images. The model blends aspects (style, identity, environment) across all inputs.
7.  **Audio is mandatory**: Seedance 2.0 generates audio natively. Always include an Audio line — music genre/tone, key SFX, ambient texture. Silent direction = random audio.
8.  **Single-beat discipline**: Each timed segment = one action. Cramming two narrative beats into 4s degrades physics and motion consistency.

---

## 🎭 Capability-Specific Patterns

12 ready-to-adapt patterns covering character consistency, camera movement replication, forward/reverse video extension, video editing, music beat-matching, dialogue/voice acting, one-take shots, e-commerce/product showcase, educational visualization, FPV first-person shots, and cinematic drone flythrough.

**Before building a prompt for any of these capabilities**: See [references/capability-patterns.md](references/capability-patterns.md) for the full worked example of each.

---

## 🎨 Prompt Templates

### Cinematic Film
```
[SCENE] Rain-soaked cyberpunk alley, neon signs reflected on wet cobblestones.
[SUBJECT] A lone figure in a weathered trench coat, face obscured by a wide-brim hat.
[ACTION] Walking slowly, each step splashing neon color into the puddles.
[CAMERA] Low-angle tracking shot, anamorphic lens, slow dolly in. Rack focus to face.
[STYLE] Denis Villeneuve aesthetic, high contrast, desaturated blues and magentas. 24fps.
```

### Product Ad (15s)
```
Reference @Video1's editing style. Replace @Video1's product with @Image1 as hero.
0–3s: Product enters with dynamic rotation, close-up on surface texture and logo.
4–8s: Multiple angle transitions — front, side, back — with highlight scanning light.
9–12s: Product in lifestyle context showing usage.
13–15s: Hero shot with brand tagline, background music builds to resolution.
Sound: Reference @Video1's BGM. Add product interaction sound effects.
```

### Short Drama (15s)
```
Scene (0–5s): Close-up on character's reddened eyes, finger pointing accusingly.
Dialogue 1: "What exactly are you trying to take from me?"
Scene (6–10s): Other character trembles, holding up evidence, steps forward.
Dialogue 2: "I'm not deceiving you! This is what he entrusted to me!"
Scene (11–15s): Evidence revealed, first character freezes — anger shifts to shock.
Sound: Urgent piano + static interference, sobbing, muffled voice blending in.
Duration: Precise 15 seconds, every frame tight, no filler.
```

### Dance / Beat-Sync (13s)
```
Have the character in @Image1 replicate the dance moves and beat-synced
music from @Video1. Generate a 13-second video. Movements should be
smooth with no stuttering or freezing.
```

### Scenery Montage (15s)
```
@Image1 @Image2 @Image3 @Image4 @Image5 @Image6 — landscape scene images.
Reference @Video1's visual rhythm, inter-scene transitions, visual style,
and music tempo for beat-synced editing.
```

### Advertising / Product Motion
```
[SCENE] Minimalist white studio, single product on a rotating pedestal.
[ACTION] Subtle 360° rotation, product details catching specular highlights.
[CAMERA] Tight medium shot, macro lens pass over surface texture, slow orbit.
[STYLE] Commercial grade, perfect exposure, zero background distraction.
```

### Action / Physics
```
[SCENE] Desert canyon at sunrise, sandy terrain, long shadows.
[SUBJECT] High-performance sports car accelerating through a turn.
[ACTION] Rear wheels spinning with dust plume, chassis flexing under g-force.
[CAMERA] Low hero angle dolly tracking alongside, then whip pan to lead car.
[STYLE] Hollywood racing film, warm golden grade, motion blur on wheels. 24fps.
```

### Character Consistency (Martial Arts)
```
[SUBJECT] Same fighter throughout: young woman, white gi, black belt, determined expression.
[ACTION] Fluid kata sequence — rising block, stepping side kick, spinning back fist.
[CAMERA] Full-body wide shot, then cut to close-up of fist impact in slow motion.
[STYLE] Maintain identical lighting, clothing, and facial features in every frame. Zero flicker.
```

---

## 🎚️ Style & Quality Modifiers

### Visual Style
- `Cinematic quality, film grain, shallow depth of field`
- `2.35:1 widescreen, 24fps`
- `Ink wash painting style` / `Anime style` / `Photorealistic`
- `High saturation neon colors, cool-warm contrast`
- `4K medical CGI, semi-transparent visualization`

### Mood / Atmosphere
- `Tense and suspenseful` / `Warm and healing` / `Epic and grand`
- `Comedy with exaggerated expressions`
- `Documentary tone, restrained narration`

### Audio Direction
- `Background music: grand and majestic`
- `Sound effects: footsteps, crowd noise, car sounds`
- `Voice tone reference @Video1`
- `Beat-synced transitions matching music rhythm`

---

## ❌ Common Mistakes to Avoid

1. **Vague references**: Don't say "reference @Video1" — specify WHAT to reference (camera? action? effects? rhythm?)
2. **Conflicting instructions**: Don't ask for "static camera" and "orbit shot" in the same segment.
3. **Overloading**: Don't pack too many scenes into 4–5 seconds — keep it physically plausible.
4. **Missing @ assignments**: If you upload 5 images, make sure each one is referenced with a clear purpose.
5. **Ignoring audio**: Sound design dramatically improves output — always include audio direction.
6. **Forgetting duration**: Match prompt complexity to the selected generation length.
7. **Real faces**: Don't upload real human photos — the system will block them.
8. **Keyword soup**: DO NOT use "8k, masterpiece, trending." Use technical descriptions instead.
9. **Discontinuous action**: Avoid "The man runs and then he stops." Use fluid transitional language.
10. **Missing audio direction**: Seedance 2.0 generates audio natively — always specify music tone, SFX, or ambience. Skipping it produces random sound.
11. **Narrative overload per segment**: Each timed segment should contain one action beat. Multiple scene changes in 4s produce degraded physics and motion artifacts.
12. **FPV without continuous motion**: FPV requires a motion-rich environment to work — a static room with FPV intent will not trigger the immersive effect. Pair FPV with corridors, streets, natural terrain, or product flyovers.
13. **Drone without a destination**: Drone shots need a resolve point — specify what the camera descends toward or arrives at. "Drone shot" alone produces aimless floating.

---

## 🚀 Protocol: All Modes

All 9 modes (`t2v`, `i2v`, `extend`, `first-last`, `omni`, `omni-train`, `character`, `video-edit`, `watermark-remove`) are invoked via `scripts/generate-seedance.sh` with mode-specific flags (`--mode`, `--tier`, `--fast`, `--file`, `--video-file`, `--audio-file`, `--request-id`, `--subject`, `--duration`, `--aspect`, `--quality`), plus an `--async`/`--json` pattern for polling long-running jobs.

**Before invoking any mode, read [references/mode-protocols.md](references/mode-protocols.md)** — it has the exact CLI invocation for each of the 9 modes, the async submit/poll pattern, the endpoint each mode+tier resolves to, and the full parameter-differences-by-tier table (aspect ratios, duration limits, quality support, fast-variant availability).

---

This skill acts as a **Cinematographic Wrapper** that translates creative intent into high-fidelity technical instructions for the `muapi` core.
