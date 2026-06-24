#!/usr/bin/env python3
"""
KoiKatsu CharaMake list extractor using UnityPy.
Extracts TextAssets from abdata/list/characustom/*.unity3d
"""

import os
import sys
import UnityPy

KK_BASE = "/media/k/10128B6C128B559E/[ScrewThisNoise] Koikatsu BetterRepack RX22 SPLIT/[ScrewThisNoise] Koikatsu BetterRepack RX22"
CHARACUSTOM_DIR = os.path.join(KK_BASE, "abdata/list/characustom")
LIST_DIR = os.path.join(KK_BASE, "abdata/list")
OUTPUT_DIR = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/extracted"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- Task 3: list directories under abdata/list/ ---
print("=" * 60)
print("[Task 3] abdata/list/ 直下のフォルダ/ファイル一覧:")
print("=" * 60)
for entry in sorted(os.listdir(LIST_DIR)):
    full = os.path.join(LIST_DIR, entry)
    kind = "DIR " if os.path.isdir(full) else "FILE"
    print(f"  {kind}  {entry}")
print()

# --- Task 1 & 2 & 4: extract all TextAssets from characustom/*.unity3d ---
unity3d_files = sorted(f for f in os.listdir(CHARACUSTOM_DIR) if f.endswith(".unity3d"))
print(f"[Task 1] Found {len(unity3d_files)} .unity3d files in characustom/")
print()

total_text_assets = 0
format_samples = {}  # filename -> (header, first_rows)

for u3d_file in unity3d_files:
    u3d_path = os.path.join(CHARACUSTOM_DIR, u3d_file)
    bundle_name = os.path.splitext(u3d_file)[0]  # e.g. "00"

    try:
        env = UnityPy.load(u3d_path)
    except Exception as e:
        print(f"  [WARN] Failed to load {u3d_file}: {e}")
        continue

    bundle_out_dir = os.path.join(OUTPUT_DIR, "characustom", bundle_name)
    os.makedirs(bundle_out_dir, exist_ok=True)

    text_assets_in_bundle = 0
    for obj in env.objects:
        if obj.type.name == "TextAsset":
            data = obj.read()
            asset_name = data.name  # e.g. "cf_m_eyebrow_00"
            text = None

            # Try to decode as UTF-8, fallback to latin-1
            raw = data.script
            if isinstance(raw, (bytes, bytearray)):
                try:
                    text = raw.decode("utf-8")
                except UnicodeDecodeError:
                    try:
                        text = raw.decode("latin-1")
                    except Exception:
                        text = raw.decode("utf-8", errors="replace")
            else:
                text = str(raw)

            # Save to file
            out_path = os.path.join(bundle_out_dir, asset_name + ".txt")
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(text)

            text_assets_in_bundle += 1
            total_text_assets += 1

            # Store sample for format analysis
            lines = [l for l in text.splitlines() if l.strip()]
            if asset_name not in format_samples:
                format_samples[asset_name] = {
                    "bundle": u3d_file,
                    "lines": lines[:8],
                }

    print(f"  {u3d_file}: {text_assets_in_bundle} TextAsset(s) -> {bundle_out_dir}")

print()
print(f"[TOTAL] TextAssets extracted: {total_text_assets}")
print()

# --- Task 4: detailed look at 00.unity3d ---
print("=" * 60)
print("[Task 4] 00.unity3d の TextAsset 詳細:")
print("=" * 60)
u3d_00 = os.path.join(CHARACUSTOM_DIR, "00.unity3d")
env00 = UnityPy.load(u3d_00)
assets_00 = []
for obj in env00.objects:
    if obj.type.name == "TextAsset":
        data = obj.read()
        raw = data.script
        if isinstance(raw, (bytes, bytearray)):
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                text = raw.decode("latin-1")
        else:
            text = str(raw)
        assets_00.append((data.name, text))

print(f"00.unity3d contains {len(assets_00)} TextAsset(s):\n")
for name, text in assets_00:
    lines = [l for l in text.splitlines() if l.strip()]
    print(f"  --- Asset: {name} ---")
    print(f"  Total lines (non-empty): {len(lines)}")
    print(f"  First 8 lines:")
    for i, line in enumerate(lines[:8]):
        print(f"    [{i}] {line}")
    print()

# --- Task 2: Format summary ---
print("=" * 60)
print("[Task 2] フォーマット概要 (各アセットの先頭行):")
print("=" * 60)
shown = 0
for asset_name, info in sorted(format_samples.items()):
    print(f"\n  [{info['bundle']}] {asset_name}")
    for i, line in enumerate(info["lines"][:5]):
        print(f"    [{i}] {line}")
    shown += 1
    if shown >= 20:
        print(f"\n  ... (省略: 残り {len(format_samples) - shown} アセット)")
        break

print()
print("Done.")
