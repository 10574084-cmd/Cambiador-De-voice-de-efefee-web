#!/usr/bin/env python3
"""Create a metadata-only report for an XAPK. No DEX/source is decompiled."""
import json, os, shutil, subprocess, sys, tempfile, zipfile
from pathlib import Path

MAX_APK_BYTES = 300 * 1024 * 1024
MAX_ENTRIES = 3000

def human_size(value):
    return f"{value:,} bytes ({value / 1024 / 1024:.2f} MiB)"

def run_aapt(aapt, command, apk_path):
    try:
        result = subprocess.run([aapt, "dump", command, str(apk_path)],
            capture_output=True, text=True, errors="replace", timeout=45, check=False)
        if result.returncode == 0:
            return result.stdout.strip()
        return f"[aapt returned {result.returncode}] {result.stderr.strip()[:1000]}"
    except (OSError, subprocess.TimeoutExpired) as exc:
        return f"[aapt unavailable or timed out] {exc}"

def selected_lines(text, prefixes):
    return [line.strip() for line in text.splitlines() if line.strip().startswith(prefixes)]

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: inspect_xapk.py INPUT.xapk OUTPUT_DIR")
    source, output = Path(sys.argv[1]), Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    report = ["# XAPK inspection report", "",
        "> Metadata and archive inventory only. No application code was decompiled or redistributed.",
        "", f"- File: {source.name}", f"- Size: {human_size(source.stat().st_size)}", ""]
    inventory = {"archive": source.name, "size_bytes": source.stat().st_size,
                 "entries": [], "apks": []}
    try:
        with zipfile.ZipFile(source) as archive:
            infos = archive.infolist()
            if len(infos) > MAX_ENTRIES:
                raise ValueError(f"Archive has too many entries: {len(infos)}")
            report += ["## Archive contents", "",
                "| Entry | Uncompressed size | Compressed size |", "|---|---:|---:|"]
            for info in infos:
                safe_name = info.filename.replace("|", "\\|").replace("\n", " ")
                report.append(f"| {safe_name} | {human_size(info.file_size)} | {human_size(info.compress_size)} |")
                inventory["entries"].append({"name": info.filename, "size_bytes": info.file_size,
                    "compressed_bytes": info.compress_size, "is_directory": info.is_dir()})
            manifest_info = next((i for i in infos if Path(i.filename).name.lower() == "manifest.json"), None)
            if manifest_info:
                try:
                    manifest = json.loads(archive.read(manifest_info).decode("utf-8-sig"))
                    inventory["xapk_manifest"] = manifest
                    report += ["", "## XAPK manifest", "", json.dumps(manifest, indent=2, ensure_ascii=False)[:12000]]
                except Exception as exc:
                    report += ["", f"Manifest JSON could not be parsed: {exc}"]
            apk_infos = [i for i in infos if i.filename.lower().endswith(".apk")]
            report += ["", "## APK analysis", ""]
            if not apk_infos:
                report.append("No APK files were found inside this XAPK.")
            aapt = os.environ.get("AAPT", "aapt")
            with tempfile.TemporaryDirectory(prefix="xapk-report-") as temp:
                for index, info in enumerate(apk_infos, start=1):
                    item = {"name": info.filename, "size_bytes": info.file_size}
                    inventory["apks"].append(item)
                    report += [f"### APK {index}: {info.filename}", "", f"- Size: {human_size(info.file_size)}"]
                    if info.file_size > MAX_APK_BYTES:
                        report.append("- Skipped: APK exceeds the 300 MiB safety limit.")
                        continue
                    apk_path = Path(temp) / f"part-{index}.apk"
                    with archive.open(info) as src, apk_path.open("wb") as dst:
                        shutil.copyfileobj(src, dst)
                    try:
                        with zipfile.ZipFile(apk_path) as apk:
                            names = apk.namelist()
                            dex = sorted(n for n in names if Path(n).name.startswith("classes") and n.endswith(".dex"))
                            native = sorted(n for n in names if n.startswith("lib/") and n.endswith(".so"))
                            item["dex_files"], item["native_libraries"] = dex, native
                            report += [f"- DEX files: {', '.join(dex) if dex else 'None found'}",
                                       f"- Native libraries: {len(native)}"]
                            if native:
                                report += ["", "Native library paths:"] + [f"- {n}" for n in native[:120]]
                    except zipfile.BadZipFile:
                        report.append("- APK container could not be opened as a ZIP archive.")
                    badging = run_aapt(aapt, "badging", apk_path)
                    permissions = run_aapt(aapt, "permissions", apk_path)
                    details = selected_lines(badging, ("package:", "sdkVersion:", "targetSdkVersion:",
                        "application-label", "launchable-activity:", "uses-feature:", "supports-screens:"))
                    permission_lines = selected_lines(permissions, ("package:", "uses-permission:"))
                    item["badging"], item["permissions"] = details, permission_lines
                    report += ["", "**Package and app metadata**", ""]
                    report += [f"- {line}" for line in details] if details else ["- Could not read package metadata with Android aapt."]
                    report += ["", "**Declared permissions**", ""]
                    report += [f"- {line}" for line in permission_lines] if permission_lines else ["- No permission lines were returned by aapt."]
                    report.append("")
    except (zipfile.BadZipFile, OSError, ValueError) as exc:
        report += ["", "## Inspection error", "", str(exc)]
        inventory["error"] = str(exc)
    (output / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    (output / "inventory.json").write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Report written to {output / 'report.md'}")

if __name__ == "__main__":
    main()
