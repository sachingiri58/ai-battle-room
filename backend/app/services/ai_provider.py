import asyncio
import os
import random
from typing import Optional

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
USE_MOCK = not bool(ANTHROPIC_API_KEY) or os.getenv("USE_MOCK_AI", "false").lower() == "true"

MOCK_OUTPUTS = [
    """# VOID NOIR — A Cyberpunk Perfume Campaign

**Scent Profile:** Digital smoke, rain-slicked chrome, and a heart of synthetic violet.

**Tagline:** *"You were never meant to fit in the simulation."*

---

Campaign Visual: A Gen-Z protagonist floats in a neon-drenched data stream, cradling a frosted obsidian bottle. Augmented reality overlays spiral around her wrists like living tattoos.

**Social Drop Strategy:**
- NFT-locked early access for holders
- AR filter that shows your "scent aura"  
- Limited bottle morphs based on your Spotify listening

*VOID NOIR — Wear the glitch.*""",

    """# NEURALUX X — The Luxury You Can't Touch

**The Scent:** First breath of a server room at 3AM. Titanium accord. A whisper of jasmine corrupted by binary code.

**Campaign Concept:** "Inaccessible by design."

---

Six influencers received unmarked black boxes. No branding. No instructions. Just the scent and coordinates to a hidden AR experience in six cities.

The unboxing became the campaign.

**Key Assets:**
- 72-hour countdown with zero context
- Interactive AI that "knows" your aesthetic
- Bottle design: liquid metal meets shattered hologram

*You don't wear NEURALUX. It wears you.*""",

    """# GLITCH BLOOM — Chaos Couture Fragrance

**Notes:** Overloaded servers (top), midnight cherry blossom (heart), corrupted data stream (base)

**Campaign:** We sold the perfume before we named it.

---

Step 1: Drop an encrypted file on r/ARG  
Step 2: Community cracks it — reveals scent notes  
Step 3: They name it. We bottle it. They own it.

**Projected Reach:** 2.4M organic impressions before launch day

**Tagline:** *"Smell like you hacked the mainframe and grew flowers in the ruins."*

The bottle is deliberately ugly. That's the point. Ugly is the new luxury when you're too cool to care.""",

    """# PHANTOM PROTOCOL — Stealth Luxury for the Unwatched

**Premise:** In a world of surveillance, the most radical act is to be undetectable.

**Scent:** Absence. Specifically — cold air, white musk, the nothing between data packets.

---

**Campaign:** No ads. No posts. No faces.

The bottle appears in the backgrounds of 47 viral videos over 3 months. No one notices until they do. Then everyone does.

**Product Design:** Clear bottle. Clear liquid. The label is written in UV ink — visible only under blacklight.

*PHANTOM PROTOCOL: The campaign you didn't know you were watching.*""",
]


async def generate_content(prompt: str, challenge: str) -> str:
    if USE_MOCK:
        return await _mock_generate(prompt, challenge)
    return await _anthropic_generate(prompt, challenge)


async def _mock_generate(prompt: str, challenge: str) -> str:
    # Simulate realistic latency: 3-8 seconds
    delay = random.uniform(3, 8)
    await asyncio.sleep(delay)

    # Simulate ~10% failure rate
    if random.random() < 0.10:
        raise Exception("Generation service temporarily unavailable. Please retry.")

    base = random.choice(MOCK_OUTPUTS)
    return base


async def _anthropic_generate(prompt: str, challenge: str) -> str:
    try:
        import httpx
        system = (
            "You are a creative director for a luxury brand campaign competition. "
            "Generate a vivid, original, and compelling campaign concept based on the user's prompt. "
            "Format your response in markdown with a title, tagline, and creative details. "
            "Keep it under 300 words but make it punchy and memorable."
        )
        user_msg = f"Challenge: {challenge}\n\nMy campaign concept: {prompt}"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 500,
                    "system": system,
                    "messages": [{"role": "user", "content": user_msg}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]
    except Exception as e:
        raise Exception(f"AI generation failed: {str(e)}")
