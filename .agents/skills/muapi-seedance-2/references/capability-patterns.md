# Capability-Specific Patterns

## 1. Character Consistency
```
The man in @Image1 walks tiredly down the hallway, slowing his steps,
finally stopping at his front door. Close-up on his face — he takes a
deep breath, replaces the weariness with a relaxed expression.
Maintain high character consistency, zero facial flicker, persistent clothing details.
```

## 2. Camera Movement Replication
```
Reference @Image1's male character. He is in @Image2's elevator.
Completely reference @Video1's camera movements and facial expressions.
Hitchcock zoom during the fear moment, then orbit shots of the interior.
Elevator doors open, follow shot walking out.
```

## 3. Video Extension (Forward)
```
Extend @Video1 by 10 seconds.
1–5s: Light and shadow slowly slide across table through venetian blinds.
6–10s: A coffee bean drifts down. Camera pushes in toward it until screen goes black.
English text gradually appears — "Lucky Coffee", "Breakfast", "AM 7:00-10:00".
```

## 4. Video Extension (Reverse / Prepend)
```
Extend backward 10s. In warm afternoon light, the camera starts from
the corner with awning fluttering in the breeze, slowly tilting down
to flowers peeking out at the wall base, building anticipation for the main scene.
```

## 5. Video Editing (Modify Existing)
```
Subvert @Video1's plot — the character's expression shifts from warmth to
cold determination. The action is decisive, without hesitation.
Maintain all other visual elements (scene, lighting, timing).
```

## 6. Music Beat-Matching
```bash
bash scripts/generate-seedance.sh \
  --mode i2v \
  --file img1.jpg --file img2.jpg --file img3.jpg \
  --video-file reference_edit.mp4 \
  --audio-file track.mp3 \
  --subject "@Image1 @Image2 @Image3 — match the keyframe positions and rhythm of @Video1 for beat-synced cuts. BGM references @Audio1. More dynamic movement, dreamlike visual style." \
  --duration 15 --quality high
```

## 7. Dialogue / Voice Acting
```
In the "Cat & Dog Roast Show" — emotionally expressive comedy segment:
Cat host (licking paw, rolling eyes): "Who understands my suffering?"
Dog host (head tilted, tail wagging): "You're one to talk? You sleep 18 hours a day..."
Sound: lively studio ambience, audience laughter, punchy transitions.
```

## 8. One-Take / Long Take
```
@Image1 @Image2 @Image3 — one-take tracking shot following a runner
from the street up stairs, through a corridor, onto a rooftop,
finally overlooking the city. No cuts throughout.
```

## 9. E-commerce / Product Showcase
```bash
bash scripts/generate-seedance.sh \
  --mode i2v \
  --file product.jpg \
  --subject "Deconstruct the product. Static camera. Hamburger suspended mid-air, rotating slowly. Ingredients separate and reassemble. Cheese continues to melt and drip. Ultimate food aesthetics." \
  --intent "product" \
  --aspect "9:16" \
  --duration 15 --quality high
```

## 10. Science / Educational Visualization
```bash
bash scripts/generate-seedance.sh \
  --subject "15-second health educational clip. 0–5s: Transparent blue human upper body, camera pushes into a clear artery, blood flows smoothly. 5–10s: Sugar and fat particles enter bloodstream, lipid deposits form on vessel walls. 10–15s: Vessel narrows, before/after comparison. 4K medical CGI, semi-transparent visualization." \
  --intent "educational" \
  --duration 15 --quality high
```

## 11. FPV First-Person Shot
```bash
bash scripts/generate-seedance.sh \
  --subject "Immersive first-person POV shot. Camera glides at eye level through a narrow mountain trail,
trees rushing past in peripheral blur, rocky terrain below. Slight natural stabilization with wide-angle lens.
Continuous forward motion, no cuts throughout. Trail opens into a clearing — mountain peak visible ahead.
Sound: wind, footsteps on gravel, distant birds. Natural ambient audio, no music." \
  --intent "fpv" \
  --aspect "9:16" --duration 10 --quality high
```

## 12. Cinematic Drone Flythrough
```bash
bash scripts/generate-seedance.sh \
  --subject "Cinematic aerial drone shot. Camera starts at 150m altitude above a coastal city at golden hour.
Smooth gimbal-stabilized descent along a sweeping lateral arc, dropping toward a rooftop terrace.
Long shadows cast across building tops, warm light on ocean surface. High-speed dive closes in
to product on the terrace — final frame settles into a medium close-up.
Sound: gentle wind, distant city hum, soft cinematic score building to resolve." \
  --intent "drone" \
  --aspect "16:9" --duration 10 --tier global --view
```
