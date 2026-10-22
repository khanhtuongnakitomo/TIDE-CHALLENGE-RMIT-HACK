"""Generate the narration with edge-tts and mux it into video/ResearchVault-intro.mp4."""

import asyncio
import os
import re
import subprocess

import edge_tts
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.join(HERE, "ResearchVault-intro.mp4")
VO_DIR = os.path.join(HERE, "vo")
VOICE = "en-US-AndrewNeural"
FF = imageio_ffmpeg.get_ffmpeg_exe()

# (start second, slot length, line)
LINES = [
    (0.6, 6.2, "ResearchVault. Research together, and keep participant data under controlled access."),
    (7.4, 9.4, "Research runs on trust. Participants share personal stories, and teams need to work with them, "
               "without exposing the people behind the data."),
    (17.4, 13.4, "Today, access is all or nothing. Either assistants see the whole shared drive, identities included, "
                 "or one head researcher holds every key. Either way, participants carry the risk."),
    (31.4, 9.4, "Meet ResearchVault. Every record is sealed to a clearance tier, "
                "and broader access needs independent approval."),
    (41.6, 20.0, "Riley, a research assistant, requests exactly the scope her work needs. The head researcher approves, "
                 "but one signature isn't enough. An independent data steward co-signs, and the quorum commits the "
                 "grant. Coded responses unlock, while identities stay sealed."),
    (62.6, 21.0, "Here it is in the app. Riley is denied with a clear four-oh-three, and submits a scoped request. "
                 "The head researcher proposes the change. The data steward signs in the approval console, "
                 "and the sync confirms two of two."),
    (84.4, 10.2, "Participants see their own data. Research teams start sooner. "
                 "And institutions get accountability by design."),
    (95.4, 6.0, "ResearchVault. Scope by quorum, not by admin. Built with TideCloak."),
]


def duration(path):
    out = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


async def synth(i, text, rate, reuse=True):
    path = os.path.join(VO_DIR, f"line{i:02d}.mp3")
    if reuse and os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, VOICE, rate=rate).save(path)
            return path
        except edge_tts.exceptions.NoAudioReceived:
            if attempt == 3:
                raise
            await asyncio.sleep(1.5)
    return path


async def build():
    os.makedirs(VO_DIR, exist_ok=True)
    paths = []
    for i, (start, slot, text) in enumerate(LINES):
        path = await synth(i, text, "+4%")
        d = duration(path)
        if d > slot:
            pct = min(30, int((d / slot - 1) * 100) + 6)
            path = await synth(i, text, f"+{pct}%", reuse=False)
            d = duration(path)
        print(f"line {i}: {d:.1f}s in a {slot:.1f}s slot")
        paths.append((start, path))
    return paths


def main():
    paths = asyncio.run(build())
    cmd = [FF, "-y", "-hide_banner", "-loglevel", "error", "-i", VIDEO]
    for _, p in paths:
        cmd += ["-i", p]
    chains = []
    for k, (start, _) in enumerate(paths, start=1):
        ms = int(start * 1000)
        chains.append(f"[{k}:a]adelay={ms}|{ms},volume=1.6[a{k}]")
    mix = "".join(f"[a{k}]" for k in range(1, len(paths) + 1))
    chains.append(f"{mix}amix=inputs={len(paths)}:normalize=0:duration=longest[aout]")
    tmp = os.path.join(HERE, "_with_vo.mp4")
    cmd += ["-filter_complex", ";".join(chains), "-map", "0:v", "-map", "[aout]", "-c:v", "copy",
            "-c:a", "aac", "-b:a", "160k", "-t", f"{duration(VIDEO):.2f}", "-movflags", "+faststart", tmp]
    subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL, timeout=180)
    os.replace(tmp, VIDEO)
    print("wrote", VIDEO, os.path.getsize(VIDEO) // 1024, "KB")


if __name__ == "__main__":
    main()
