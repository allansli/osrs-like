# Font sources

Every file in this directory is a subset of a font released under the SIL Open Font License 1.1. The licence text of each family is shipped beside it (`LICENSE-<family>.txt`, a byte-for-byte copy of the family's `OFL.txt` at the commit below). Downloaded on 2026-11-14 with a plain client, into a directory outside the repository.

## Grenze (display)

- Title: Grenze, version 1.003
- Author: Renata Polastri, Omnibus-Type (name IDs 8 and 9; copyright line: "Copyright 2019, The Grenze Project Authors (https://github.com/Omnibus-Type/Grenze)")
- Source: https://github.com/Omnibus-Type/Grenze, commit `2af38b2f951f5d2d601825c896c2be9b8b282092`, archive https://codeload.github.com/Omnibus-Type/Grenze/tar.gz/2af38b2f951f5d2d601825c896c2be9b8b282092
- Licence: SIL OFL 1.1, no Reserved Font Name (none in `OFL.txt`, `LICENSE.md`, `FONTLOG.txt` or name ID 0), so the subset keeps the name Grenze.

| File | SHA-256 |
|---|---|
| downloaded archive | `7eb3438f147de058c2f0a7bee0d77e6717d443e5e51b584747274eccb15c463d` |
| `OFL.txt` (shipped as `LICENSE-Grenze.txt`) | `55a21d1fcebfa5e02100db3ae4dcff2658e9ba63e0b64149203bf6a9d645db86` |
| `fonts/ttf/Grenze-SemiBold.ttf` | `7223d6be037bcaa62ea5db260940f5e3517b2f78cdb94823a496d83b1fc9b0f0` |
| `fonts/ttf/Grenze-Bold.ttf` | `83d006357854525c763892e9395562c6cf8345b3b2f291d91bc181bdf69b818e` |
| shipped `Grenze-SemiBold.woff2` (19,316 bytes) | `0fbad3a75cf9a5477b562999ee95c402c6f3c24065882eeb93d04e77af0053fd` |
| shipped `Grenze-Bold.woff2` (19,236 bytes) | `443b012ec8c6ce611ae0c8142895cab962ab3c32dafa695a8b9a20ea81502e5d` |

## Open Sans (text)

- Title: Open Sans, version 3.003
- Author: Steve Matteson of Ascender, originally; weight expansion by Micah Stupak (the repository's `README.md` at the commit below; name IDs 8 and 9 say "Monotype Imaging Inc." and "Monotype Design Team"); published by Google Fonts (copyright line: "Copyright 2020 The Open Sans Project Authors (https://github.com/googlefonts/opensans)")
- Source: https://github.com/googlefonts/opensans, commit `6cbc400d4855abee59d85c4ed871d510399bce7b`, files fetched one by one from https://raw.githubusercontent.com/googlefonts/opensans/6cbc400d4855abee59d85c4ed871d510399bce7b/
- Licence: SIL OFL 1.1, no Reserved Font Name (none in `OFL.txt` or name ID 0), so the subset keeps the name Open Sans.
- Figures: the default digits are already tabular (all ten advance 1171 units, in the source and in both subsets). The source has a `tnum` feature, but within this subset it has nothing to change, so the subsetter drops it; `font-variant-numeric: tabular-nums` then leaves the digits as they are, which are tabular. Open Sans has no kerning (GPOS holds only `mark` and `mkmk`, and there is no `kern` table).

| File | SHA-256 |
|---|---|
| `OFL.txt` (shipped as `LICENSE-OpenSans.txt`) | `01cd5ffb3a528c219a86e49a814c6c53bd8a69b9a3c305dd237074ba1c811af7` |
| `fonts/ttf/OpenSans-Regular.ttf` | `c53aceea2dcf5b4098099c0c4d0a061d17e178a049317b42a422b1a9f7f8eb59` |
| `fonts/ttf/OpenSans-SemiBold.ttf` | `4a413711684a9dd564ef0f1c10cb62b5d9f7eb6df2cff962f5341a6ecd5f64ae` |
| shipped `OpenSans-Regular.woff2` (15,620 bytes) | `8234619113171e7cbeadd38a1bdf509d1db67902ea23f81d6474e6e55bd85b43` |
| shipped `OpenSans-SemiBold.woff2` (15,604 bytes) | `53f6a900852c7d68d9642ca1004f87fca6d6eff9f2f741a63126bcd159db1302` |

## Subset command

fonttools 4.61.1 with brotli, run once per source file (`<in>` the `.ttf` above, `<out>` the shipped `.woff2`). The output is reproducible: a second run gives the same SHA-256.

```
python3 -I -m fontTools.subset <in> --unicodes=U+0020-007E,U+00A0-00FF --flavor=woff2 --layout-features+=tnum,lnum --name-IDs=0,1,2,3,4,5,6,13,14,16,17 --output-file=<out>
```

Basic Latin (U+0020 to U+007E) and Latin-1 (U+00A0 to U+00FF). Hinting is kept. Name IDs 0, 13 and 14 keep the copyright notice and the licence reference inside every file (OFL condition 2). Grenze has no glyph for U+00AD (soft hyphen); every other code point in the range is present in all four files.

Total shipped: 69,776 bytes, against a limit of 120,000.

## Evaluated, not shipped: Alegreya Sans

The design's text candidate. Fails design 7.1: the family has no 600 weight (its romans have weight classes 250, 300, 400, 500, 700, 800 and 900). Its licence files disagree: `LICENSE.md` opens "Copyright (c) 2013, Juan Pablo del Peral (juan@huertatipografica.com), with Reserved Font Names 'Alegreya Sans'", while `OFL.txt` and name ID 0 ("Copyright 2013 The Alegreya Sans Project Authors (https://github.com/huertatipografica/Alegreya-Sans)") name no Reserved Font Name; a subset would have to be renamed to be safe.

- Source: https://github.com/huertatipografica/Alegreya-Sans, commit `b19cf06866bb153cc0ed3ea9d9131b180c48fee4`, archive https://codeload.github.com/huertatipografica/Alegreya-Sans/tar.gz/b19cf06866bb153cc0ed3ea9d9131b180c48fee4 (SHA-256 `1e829cb1ae141ebc4d0f1e0f86796e227d955703989cf852e6a21e2b0950e455`)
- `OFL.txt` `6222b580f51d93a72ea22ff97eec4b03279016545b5b2bebb2ea76519372eb85`; `LICENSE.md` `9f87fce4ec8796ca6a0a45464490d40c24d5c2a7ddce4bfd09a62f14e53d9732`
- `AlegreyaSans-Regular.ttf` `6786f1ec32180b3cd6dd241a52496316eff61f3d7136e25396819434e3891926`, subset 19,768 bytes; `AlegreyaSans-Bold.ttf` `33283cbec2caaf0310086b6c12a792ff25331271d63b3e74c567a135e1af12b9`, subset 19,888 bytes (same command; used only for the sample pictures)
