# Visual asset manifest

The food on the builder is **real 3D**: photogrammetry scans and modelled props
from Sketchfab, cut, scaled and compressed by `npm run models`
(`scripts/prepare_models.ts`) into `public/assets/models/`. No photo cut-outs
are used. The restaurant's own photos and the reference video (in
`assets-src/references/`) were used only to match portion, colour and layout.

## 3D models (all CC BY 4.0 — attribution required, shown in the site footer)

| Used as | Source model | Author | Changes made |
| --- | --- | --- | --- |
| Wok-fried rice in the bowl, carrot shreds (Veggie) | [Fried rice scan](https://sketchfab.com/3d-models/cc3f316d13fc4d60ad09e6519a8ad25b) | EGFoodScans | Cut the rice dome off its plate; carrot garnish cut by texture colour; tinted to the restaurant's darker soy rice |
| Fried egg (extra), egg bits (Egg chaofan) | [fried eggs](https://sketchfab.com/3d-models/b5526cdddd194459be920b866b481cf9) | truekit | One egg cut from the pair; small bits cut around the yolk edge |
| Chicken leg (extra) | [Fried Chicken Leg/Wing](https://sketchfab.com/3d-models/38312e045dc2488ebd99971f4cef9d66) | blenderguppy | Drumstick only; tinted and glazed to look roasted |
| Chicken pieces (Chicken chaofan), beef strips (Beef chaofan) | [Grilled Chicken Steak](https://sketchfab.com/3d-models/9797e54671094233bcfa469f616bd7df) | usefulspunforsup | Diced into chunks / sliced into strips; beef is the same grilled meat tinted dark and glazed |
| Coca-Cola and Sprite cans | [Simple Cola Can](https://sketchfab.com/3d-models/aaa11e57064848268d701a3586792d0d) | Blender3D | Sprite label repainted at runtime on the same atlas |
| Mojito garnish | [Mint Leaves](https://sketchfab.com/3d-models/25837c82537c46e3ade674e0b8e99864), [Lime Slice 3D Scan](https://sketchfab.com/3d-models/9a1c7a00013745ab8b79be940e77f824) | Zinaida.Kovrova, Arkify 3D | Scaled only |
| Spoons (sauce station, dine-in) | [Metal cutlery](https://sketchfab.com/3d-models/8f59435c14c74e9dbe82a4c488882df9) | Okayest | Spoon only |

The raw downloads are not committed (`assets-src/models/` is git-ignored, ~64 MB).
To rebuild: set a Sketchfab API token as `SKETCHFAB` and run `npm run models`,
then `npm run dev` and `npm run tiles` to re-render the rail pictures from the models.

## Modelled in code (real geometry, no external asset)

Black ceramic bowl, olive-wood board, legs tray, sauce cup and sauce surface
(colour sampled from the restaurant's sauce photo), mojito glass/liquid/ice,
takeaway box with hinged lid, order stamp and name tag.

## Still worth commissioning for launch

1. **Scans of the restaurant's own dishes**, especially beef: the beef is retinted grilled chicken, not real beef.
2. **The real takeaway box and logo** — the box is plain kraft and the logo is a wordmark.
3. **Sprite**: the label is a repaint, not official artwork; get brand-approved assets if needed.
4. A **real house-sauce cup** scan (currently modelled).
