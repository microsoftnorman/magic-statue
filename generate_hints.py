"""Generate 'hint' narrator MP3s for when a pose isn't being matched."""
import asyncio
import edge_tts
import os

VOICE = "en-US-AnaNeural"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "audio", "narrator")

HINTS = {
    "hint_reach_high":      "I don't see it yet, you can do it! Try Reach for the Stars!",
    "hint_starfish":        "I don't see it yet, you can do it! Try Starfish!",
    "hint_tiny_mouse":      "I don't see it yet, you can do it! Try Tiny Mouse!",
    "hint_airplane":        "I don't see it yet, you can do it! Try Airplane!",
    "hint_touch_toes":      "I don't see it yet, you can do it! Try Touch Your Toes!",
    "hint_jumping_jacks":   "I don't see it yet, you can do it! Try Jumping Jacks!",
    "hint_hands_on_head":   "I don't see it yet, you can do it! Try Hands on Head!",
    "hint_flamingo":        "I don't see it yet, you can do it! Try Flamingo!",
    "hint_superhero":       "I don't see it yet, you can do it! Try Superhero Pose!",
    "hint_run_pose":        "I don't see it yet, you can do it! Try Run in Place!",
    "hint_wave_hello":      "I don't see it yet, you can do it! Try Wave Hello!",
    "hint_tree_pose":       "I don't see it yet, you can do it! Try Tree Pose!",
    "hint_crab_walk":       "I don't see it yet, you can do it! Try Crab!",
    "hint_ballet":          "I don't see it yet, you can do it! Try Ballet Dancer!",
    "hint_wide_squat":      "I don't see it yet, you can do it! Try Sumo Squat!",
    "hint_disco":           "I don't see it yet, you can do it! Try Disco!",
    "hint_high_five":       "I don't see it yet, you can do it! Try High Five!",
    "hint_hold_hands":      "I don't see it yet, you can do it! Try Hold Hands!",
    "hint_mirror_pose":     "I don't see it yet, you can do it! Try Mirror Mirror!",
    "hint_back_to_back":    "I don't see it yet, you can do it! Try Back to Back!",
    "hint_wave_together":   "I don't see it yet, you can do it! Try Wave Together!",
    "hint_side_by_side":    "I don't see it yet, you can do it! Try Side by Side!",
}


async def generate_all():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    total = len(HINTS)
    for i, (key, text) in enumerate(HINTS.items(), 1):
        out_path = os.path.join(OUTPUT_DIR, f"{key}.mp3")
        if os.path.exists(out_path):
            print(f"[{i}/{total}] SKIP (exists): {key}")
            continue
        print(f"[{i}/{total}] Generating: {key}")
        communicate = edge_tts.Communicate(text, VOICE, rate="-5%", pitch="+2Hz")
        await communicate.save(out_path)
    print(f"\nDone! {total} hint files in {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(generate_all())
