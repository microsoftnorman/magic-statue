"""Generate narrator MP3s using Edge TTS (Microsoft Neural voices)."""
import asyncio
import edge_tts
import os

VOICE = "en-US-AnaNeural"  # Friendly, warm female voice great for kids
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "audio", "narrator")

# All narration lines keyed by ID
LINES = {
    # ── Setup / camera ──
    "camera_ready":     "Camera is ready! I can see you!",
    "step_in":          "Step in front of the camera so I can see you!",
    "need_full_body":   "I need to see your whole body! Make sure I can see your head, arms, AND feet! Step back a little!",
    "loading_models":   "Ooh, I'm getting ready to play with you! I'm loading my super smart brain right now. "
                        "Get ready to have SO much fun! "
                        "And guess what? Everything stays right here on YOUR computer, nothing goes anywhere else! "
                        "Oh, and make sure it's okay with your mom or dad before you play. Alright, almost ready!",

    # ── Game intro ──
    "welcome":          "Hi there! Welcome to the Museum of Fun Art! I'll show you a silly pose, and you copy it with your body!",
    "rules":            "When you match the pose, freeze like a statue and hold really still! Ready? Let's go!",

    # ── Restart ──
    "play_again":       "Let's play again! Get ready!",

    # ── Auto-countdown ──
    "anyone_else":      "I can see you! Anyone else want to play? Jump in front of the camera!",
    "last_chance":      "Last chance to join!",
    "players_2":        "2 players ready! Here we go!",
    "players_3":        "3 players ready! Here we go!",
    "players_4":        "4 players ready! Here we go!",

    # ── Countdown ──
    "countdown":        "3, 2, 1, Go!",

    # ── Pose instructions (per pose) ──
    "pose_reach_high":      "Next pose: Reach for the Stars! Reach BOTH arms UP high!",
    "pose_starfish":        "Next pose: Starfish! Arms AND legs out wide!",
    "pose_tiny_mouse":      "Next pose: Tiny Mouse! Crouch down really small!",
    "pose_airplane":        "Next pose: Airplane! Arms straight out to the sides!",
    "pose_touch_toes":      "Next pose: Touch Your Toes! Bend down and reach for your toes!",
    "pose_jumping_jacks":   "Next pose: Jumping Jacks! Do jumping jacks! Arms UP and legs OUT!",
    "pose_hands_on_head":   "Next pose: Hands on Head! Put BOTH hands on top of your head!",
    "pose_flamingo":        "Next pose: Flamingo! Stand on ONE leg like a flamingo!",
    "pose_superhero":       "Next pose: Superhero Pose! Hands on your hips, stand tall and strong!",
    "pose_run_pose":        "Next pose: Run in Place! Run run run! Lift those knees UP high!",
    "pose_wave_hello":      "Next pose: Wave Hello! Wave your hand UP high! Say hello!",
    "pose_tree_pose":       "Next pose: Tree Pose! Arms UP together like branches and stand tall!",
    "pose_crab_walk":       "Next pose: Crab! Squat down low and spread your arms like crab claws!",
    "pose_ballet":          "Next pose: Ballet Dancer! Arms in a big circle above your head!",
    "pose_wide_squat":      "Next pose: Sumo Squat! Feet wide, squat down and hold your arms out!",
    "pose_disco":           "Next pose: Disco! Dance! Point one arm UP and one DOWN!",
    "pose_high_five":       "Next pose: High Five! Give your partner a HIGH FIVE up high!",
    "pose_hold_hands":      "Next pose: Hold Hands! Hold hands with your partner!",
    "pose_mirror_pose":     "Next pose: Mirror Mirror! Face your partner and copy each other with arms OUT!",
    "pose_back_to_back":    "Next pose: Back to Back! Stand BACK to BACK with your partner!",
    "pose_wave_together":   "Next pose: Wave Together! Both wave your hands UP high at the same time!",
    "pose_side_by_side":    "Next pose: Side by Side! Stand side by side and both reach UP with your outside arm!",

    # ── Matching prompts ──
    "keep_moving":      "Keep moving! You can do it!",
    "together_moving":  "Do this one together! Keep moving!",
    "together_team":    "Do this one together! Work as a team!",
    "copy_pose":        "Now copy the pose! You can do it!",
    "keep_going":       "Great! Keep going!",
    "freeze":           "Hold it! Freeze like a statue!",

    # ── Cheers (success) ──
    "cheer_1":          "Amazing! You did it!",
    "cheer_2":          "Wow, great job! You are a star!",
    "cheer_3":          "Fantastic! That was perfect!",
    "cheer_4":          "Hooray! You nailed it!",
    "cheer_5":          "Superstar! That was awesome!",

    # ── Streak combos ──
    "streak_3a":        "3 in a row! COMBO! Amazing!",
    "streak_3b":        "Streak of 3! You're on fire!",
    "streak_4a":        "4 in a row! COMBO! Amazing!",
    "streak_4b":        "Streak of 4! You're on fire!",
    "streak_5a":        "UNSTOPPABLE! 5 in a row!",
    "streak_5b":        "MEGA COMBO! 5 poses! WOW!",
    "streak_6a":        "UNSTOPPABLE! 6 in a row!",
    "streak_6b":        "MEGA COMBO! 6 poses! WOW!",
    "streak_7a":        "UNSTOPPABLE! 7 in a row!",
    "streak_7b":        "MEGA COMBO! 7 poses! WOW!",
    "streak_8a":        "UNSTOPPABLE! 8 in a row!",
    "streak_8b":        "MEGA COMBO! 8 poses! WOW!",

    # ── Timeout ──
    "times_up":         "Time's up! Let's try the next one!",

    # ── Victory ──
    "victory":          "You did ALL the poses! You are a Fun Art Superstar!",
    "victory_streak3":  "You did ALL the poses! You are a Fun Art Superstar! Best streak: 3 in a row!",
    "victory_streak4":  "You did ALL the poses! You are a Fun Art Superstar! Best streak: 4 in a row!",
    "victory_streak5":  "You did ALL the poses! You are a Fun Art Superstar! Best streak: 5 in a row!",
    "victory_streak6":  "You did ALL the poses! You are a Fun Art Superstar! Best streak: 6 in a row!",
    "victory_streak7":  "You did ALL the poses! You are a Fun Art Superstar! Best streak: 7 in a row!",
    "victory_streak8":  "You did ALL the poses! You are a Fun Art Superstar! Best streak: 8 in a row!",

    # ── No player ──
    "cant_see":         "I can't see you! Come stand in front of the camera!",

    # ── Victory play again ──
    "play_again_ask":   "Want to play again? Raise your hands up high if you want to play again!",
}


async def generate_all():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    total = len(LINES)
    for i, (key, text) in enumerate(LINES.items(), 1):
        out_path = os.path.join(OUTPUT_DIR, f"{key}.mp3")
        if os.path.exists(out_path):
            print(f"[{i}/{total}] SKIP (exists): {key}")
            continue
        print(f"[{i}/{total}] Generating: {key} — \"{text[:60]}...\"")
        communicate = edge_tts.Communicate(text, VOICE, rate="-5%", pitch="+2Hz")
        await communicate.save(out_path)
    print(f"\nDone! {total} files in {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(generate_all())
