import sys; sys.path.insert(0, sys.argv[1])
from lib import Doc
d = Doc('/path/to/osrs-like-wp/MP/docs/superpowers/specs/2026-11-14-models-pass-design.md')
d.sub("so their wire size is measured per figure at M2, not assumed (critique H5).", "so their wire size is measured, not assumed (critique H5): 3.5 S9 measured a probe body, and the pilot measures the first real figure (plan S2).")
d.sub("### 5.5 How gear tiers read at a glance\n\n", "### 5.5 How gear tiers read at a glance\n\n(The direction stands. Building the bands moves to the follow-up gear stage, decision N-2; this stage only merges gear meshes.)\n\n")
d.sub("which item is in which band is a data table, checked by a test (plan G1).", "which item is in which band is a data table, checked by a test (follow-up stage).") if "which item is in which band is a data table, checked by a test (plan G1)." in d.t else None
d.save(); print('ok')
