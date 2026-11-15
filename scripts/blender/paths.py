"""
Path helpers and safety gates for Blender model builds.
Builds must never write into shipped folders (public/models or 'blender').
"""

import os
import sys
import zipfile


def repo_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _is_subpath_or_equal(path: str, base: str) -> bool:
    try:
        common = os.path.commonpath([path, base])
        return common == base
    except ValueError:
        return False


def _check_forbidden(path: str) -> None:
    root = repo_root()
    public_dir = os.path.join(root, "public")
    blender_dir = os.path.join(root, "blender")
    if _is_subpath_or_equal(path, public_dir) or _is_subpath_or_equal(path, blender_dir):
        raise SystemExit(f"Refusing write target inside forbidden directory: {path}")


def out_dir() -> str:
    out = None
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1 :]
    else:
        args = sys.argv[1:]

    for i in range(len(args)):
        if args[i] == "--out" and i + 1 < len(args):
            out = args[i + 1]
            break
        elif args[i].startswith("--out="):
            out = args[i][len("--out=") :]
            break

    if not out:
        out = os.path.join(repo_root(), "scratch", "models-build")

    resolved = os.path.abspath(os.path.expanduser(out))
    _check_forbidden(resolved)
    os.makedirs(resolved, exist_ok=True)
    return resolved


def checked_write(path: str | None) -> str | None:
    if path is None:
        return None
    resolved = os.path.abspath(os.path.expanduser(path))
    _check_forbidden(resolved)
    os.makedirs(os.path.dirname(resolved), exist_ok=True)
    return resolved


def glb_path(name: str) -> str:
    filename = name if name.endswith(".glb") else f"{name}.glb"
    return checked_write(os.path.join(out_dir(), filename))


def blend_path(name: str) -> str:
    filename = name if name.endswith(".blend") else f"{name}.blend"
    return checked_write(os.path.join(out_dir(), filename))


def source(rel: str) -> str:
    prefix = "blender" + os.sep + "examples" + os.sep
    alt_prefix = "blender/examples/"
    if rel.startswith(prefix):
        rel = rel[len(prefix) :]
    elif rel.startswith(alt_prefix):
        rel = rel[len(alt_prefix) :]
    elif rel.startswith("examples" + os.sep):
        rel = rel[len("examples" + os.sep) :]
    elif rel.startswith("examples/"):
        rel = rel[len("examples/") :]
    return os.path.abspath(os.path.join(repo_root(), "blender", "examples", rel))


def extract_zip(zip_path: str, dest: str) -> None:
    dest_resolved = os.path.abspath(os.path.expanduser(dest))
    checked_write(dest_resolved)
    os.makedirs(dest_resolved, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.infolist():
            target_path = os.path.abspath(os.path.join(dest_resolved, member.filename))
            if not _is_subpath_or_equal(target_path, dest_resolved):
                raise SystemExit(
                    f"Refusing to extract zip member outside destination {dest_resolved}: {member.filename}"
                )
            checked_write(target_path)
        zf.extractall(dest_resolved)
