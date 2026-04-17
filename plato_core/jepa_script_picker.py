#!/usr/bin/env python3
"""
JEPA Script Picker for PLATO-OS Edge Deploy
=============================================

Picks the optimal JEPA training/deployment script based on:
  - Hardware capability (Jetson Nano/Orin, RTX GPU, CPU-only)
  - PLATO room emotional momentum (rooms carry affective state)
  - Room tug (gravitational pull toward rooms needing attention)
  - Metadata LLM calls for adaptive script selection

Designed to run offline on edge devices (Jetson, laptops, VPS).
Zero external dependencies beyond stdlib + optional torch/cuda checks.

Usage:
  python3 jepa_script_picker.py [--profile auto|jetson_nano|jetson_orin|rtx|cpu]
                                 [--room-tug] [--momentum] [--json]

Part of SuperInstance/SmartCRDT — PR #1440 target.
"""

import json
import os
import platform
import subprocess
import sys
import argparse
import struct
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Optional


# ============================================================================
# HARDWARE PROFILES
# ============================================================================

class HardwareTier(Enum):
    JETSON_NANO = "jetson_nano"      # 4GB, 128 CUDA cores, ARM A57
    JETSON_ORIN = "jetson_orin"      # 8-64GB, 1024 CUDA cores, ARM A78AE
    RTX_DESKTOP = "rtx"             # RTX 3060+, 8GB+ VRAM, x86_64
    CPU_ONLY = "cpu"                 # No GPU, CPU fallback


@dataclass
class HardwareProfile:
    tier: HardwareTier
    cuda_available: bool = False
    cuda_device_count: int = 0
    cuda_device_name: str = ""
    vram_mb: int = 0
    ram_mb: int = 0
    arch: str = ""
    os_name: str = ""
    is_jetson: bool = False
    jetson_model: str = ""


@dataclass
class JEPAScriptConfig:
    """Configuration for a selected JEPA training/deployment script."""
    script_name: str
    model_size: str           # tiny, small, medium, large
    patch_size: int           # 8, 16
    embed_dim: int            # 192, 384, 768
    depth: int                # transformer layers
    num_heads: int
    batch_size: int
    epochs: int
    learning_rate: float
    quantization: str         # fp32, fp16, int8, int4
    runtime: str              # cuda, webgpu, wasm, cpu
    memory_budget_mb: int
    data_parallel: bool
    gradient_checkpointing: bool
    mixed_precision: bool
    offline: bool = True
    # PLATO-specific
    emotional_weight: float = 1.0   # how much emotional momentum affects training
    room_tug_enabled: bool = True   # whether room priority shapes data sampling


# ============================================================================
# SCRIPT TEMPLATES (mapped to hardware tiers)
# ============================================================================

SCRIPT_MAP = {
    HardwareTier.JETSON_NANO: JEPAScriptConfig(
        script_name="jepa_train_jetson_nano.py",
        model_size="tiny",
        patch_size=16,
        embed_dim=192,
        depth=6,
        num_heads=3,
        batch_size=4,
        epochs=30,
        learning_rate=1e-4,
        quantization="fp16",
        runtime="cuda",
        memory_budget_mb=3500,
        data_parallel=False,
        gradient_checkpointing=True,
        mixed_precision=True,
        emotional_weight=0.7,
    ),
    HardwareTier.JETSON_ORIN: JEPAScriptConfig(
        script_name="jepa_train_jetson_orin.py",
        model_size="small",
        patch_size=16,
        embed_dim=384,
        depth=8,
        num_heads=6,
        batch_size=8,
        epochs=50,
        learning_rate=5e-4,
        quantization="fp16",
        runtime="cuda",
        memory_budget_mb=7000,
        data_parallel=False,
        gradient_checkpointing=True,
        mixed_precision=True,
        emotional_weight=0.85,
    ),
    HardwareTier.RTX_DESKTOP: JEPAScriptConfig(
        script_name="jepa_train_rtx.py",
        model_size="medium",
        patch_size=8,
        embed_dim=512,
        depth=12,
        num_heads=8,
        batch_size=16,
        epochs=100,
        learning_rate=1e-3,
        quantization="fp32",
        runtime="cuda",
        memory_budget_mb=8192,
        data_parallel=True,
        gradient_checkpointing=False,
        mixed_precision=True,
        emotional_weight=1.0,
    ),
    HardwareTier.CPU_ONLY: JEPAScriptConfig(
        script_name="jepa_train_cpu.py",
        model_size="tiny",
        patch_size=16,
        embed_dim=128,
        depth=4,
        num_heads=2,
        batch_size=1,
        epochs=20,
        learning_rate=1e-4,
        quantization="int8",
        runtime="cpu",
        memory_budget_mb=2048,
        data_parallel=False,
        gradient_checkpointing=True,
        mixed_precision=False,
        emotional_weight=0.5,
    ),
}


# ============================================================================
# PLATO ROOM EMOTIONAL MOMENTUM
# ============================================================================

@dataclass
class EmotionalState:
    """Affective state carried by a PLATO-OS room."""
    valence: float = 0.0       # -1 (negative) to +1 (positive)
    arousal: float = 0.5       # 0 (calm) to 1 (urgent)
    momentum: float = 0.0      # accumulated emotional momentum over time
    last_updated: float = 0.0  # timestamp


@dataclass
class RoomTug:
    """
    Gravitational pull of a PLATO room. Rooms needing attention 'tug'
    agents toward them. Priority = momentum * urgency * staleness.

    In PLATO-OS dojo, rooms are cognitive tools:
    - Brainstorm Room (reverse actualization)
    - Situation Room (pre-planning)
    - War Room (live crisis)
    - After-Action Room (post-mortem)
    """
    room_id: str
    room_name: str
    room_type: str             # brainstorm, situation, war, after_action
    priority: float = 0.0      # 0-1, computed from emotional state
    staleness_s: float = 0.0   # seconds since last agent visit
    emotional_state: EmotionalState = field(default_factory=EmotionalState)
    active_agents: int = 0
    pending_tasks: int = 0

    def compute_tug(self) -> float:
        """Compute gravitational pull score."""
        staleness_factor = min(self.staleness_s / 3600.0, 1.0)  # cap at 1hr
        emotion_factor = (
            abs(self.emotional_state.valence) * 0.4
            + self.emotional_state.arousal * 0.3
            + abs(self.emotional_state.momentum) * 0.3
        )
        task_factor = min(self.pending_tasks / 10.0, 1.0)
        occupancy = max(0.1, 1.0 - (self.active_agents * 0.2))  # less tug if crowded

        self.priority = emotion_factor * task_factor * staleness_factor * occupancy
        return self.priority


# ============================================================================
# METADATA LLM CALLS (offline-capable)
# ============================================================================

def metadata_llm_call(
    prompt: str,
    model: str = "glm-5.1",
    api_base: str = "",
    api_key: str = "",
    offline: bool = True,
    fallback_local: bool = True,
) -> Optional[dict]:
    """
    Make a metadata LLM call for script selection adaptation.
    
    In offline mode, uses rule-based heuristics instead.
    In online mode, queries the configured LLM API.
    
    Returns parsed JSON response or None on failure.
    """
    if offline:
        return _offline_metadata_heuristic(prompt)

    # Online: use configured API
    api_base = api_base or os.environ.get("OPENAI_BASE_URL", "https://api.z.ai/v1")
    api_key = api_key or os.environ.get("OPENAI_API_KEY", "")

    if not api_key:
        if fallback_local:
            return _offline_metadata_heuristic(prompt)
        return None

    try:
        import urllib.request
        import json as _json

        payload = _json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 500,
        }).encode()

        req = urllib.request.Request(
            f"{api_base}/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "plato-jepa-picker/1.0",
            },
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            result = _json.loads(resp.read().decode())
            content = result["choices"][0]["message"]["content"]
            # Try to parse JSON from response
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            return _json.loads(content.strip())

    except Exception as e:
        if fallback_local:
            return _offline_metadata_heuristic(prompt)
        print(f"[metadata_llm] API call failed: {e}", file=sys.stderr)
        return None


def _offline_metadata_heuristic(prompt: str) -> dict:
    """Rule-based fallback when no LLM available."""
    prompt_lower = prompt.lower()

    adjustments = {
        "reduce_batch": False,
        "reduce_model": False,
        "increase_patience": False,
        "enable_gradient_checkpointing": True,
        "reduce_epochs": False,
        "reason": "offline heuristic defaults",
    }

    if "low memory" in prompt_lower or "oom" in prompt_lower:
        adjustments["reduce_batch"] = True
        adjustments["reduce_model"] = True
        adjustments["reason"] = "detected low memory constraint"
    if "slow" in prompt_lower or "timeout" in prompt_lower:
        adjustments["reduce_batch"] = True
        adjustments["reduce_epochs"] = True
        adjustments["reason"] = "detected performance concern"
    if "overfitting" in prompt_lower:
        adjustments["increase_patience"] = True
        adjustments["reason"] = "detected overfitting risk"

    return adjustments


# ============================================================================
# HARDWARE DETECTION
# ============================================================================

def detect_hardware() -> HardwareProfile:
    """Auto-detect hardware capabilities."""
    profile = HardwareProfile(
        tier=HardwareTier.CPU_ONLY,
        arch=platform.machine(),
        os_name=platform.system(),
    )

    # RAM detection
    try:
        if platform.system() == "Linux":
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal"):
                        profile.ram_mb = int(line.split()[1]) // 1024
                        break
    except Exception:
        pass

    # Jetson detection
    jetson_model_file = "/etc/nv_tegra_release"
    if os.path.exists(jetson_model_file):
        profile.is_jetson = True
        try:
            with open(jetson_model_file) as f:
                content = f.read()
                if "Nano" in content or "jetson-nano" in content.lower():
                    profile.jetson_model = "Nano"
                    profile.tier = HardwareTier.JETSON_NANO
                elif "Orin" in content:
                    profile.jetson_model = "Orin"
                    profile.tier = HardwareTier.JETSON_ORIN
                else:
                    # Generic Jetson, assume Nano-level
                    profile.jetson_model = "Unknown"
                    profile.tier = HardwareTier.JETSON_NANO
        except Exception:
            profile.tier = HardwareTier.JETSON_NANO

    # CUDA detection (try torch first, then nvidia-smi)
    if not profile.is_jetson:
        try:
            import torch
            profile.cuda_available = torch.cuda.is_available()
            if profile.cuda_available:
                profile.cuda_device_count = torch.cuda.device_count()
                profile.cuda_device_name = torch.cuda.get_device_name(0)
                profile.vram_mb = torch.cuda.get_device_properties(0).total_mem // (1024 * 1024)
                profile.tier = HardwareTier.RTX_DESKTOP
        except ImportError:
            # Fallback to nvidia-smi
            try:
                result = subprocess.run(
                    ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                    capture_output=True, text=True, timeout=5,
                )
                if result.returncode == 0:
                    parts = result.stdout.strip().split(", ")
                    profile.cuda_available = True
                    profile.cuda_device_name = parts[0]
                    profile.vram_mb = int(float(parts[1]))
                    profile.tier = HardwareTier.RTX_DESKTOP
            except Exception:
                pass

    return profile


# ============================================================================
# SCRIPT PICKER CORE
# ============================================================================

def pick_script(
    hardware: Optional[HardwareProfile] = None,
    profile_override: Optional[str] = None,
    rooms: Optional[list[RoomTug]] = None,
    offline: bool = True,
) -> JEPAScriptConfig:
    """
    Pick the optimal JEPA training script for the current hardware + PLATO context.
    
    Args:
        hardware: Pre-detected hardware profile (auto-detects if None)
        profile_override: Force a specific tier (jetson_nano, jetson_orin, rtx, cpu)
        rooms: PLATO room tug data for emotional momentum weighting
        offline: Whether to use offline heuristics vs LLM metadata calls
    
    Returns:
        JEPAScriptConfig with the selected configuration
    """
    # Hardware detection
    if hardware is None:
        hardware = detect_hardware()

    # Override if specified
    if profile_override:
        tier_map = {t.value: t for t in HardwareTier}
        if profile_override in tier_map:
            hardware.tier = tier_map[profile_override]

    # Base config from hardware tier (deep copy to avoid mutation)
    base = SCRIPT_MAP[hardware.tier]
    config = JEPAScriptConfig(**asdict(base))

    # Adjust based on actual VRAM/RAM
    if hardware.vram_mb > 0 and hardware.vram_mb < config.memory_budget_mb:
        config.memory_budget_mb = hardware.vram_mb - 512  # reserve 512MB
        # Scale batch size down if memory is tight
        mem_ratio = config.memory_budget_mb / SCRIPT_MAP[hardware.tier].memory_budget_mb
        if mem_ratio < 0.5:
            config.batch_size = max(1, config.batch_size // 2)
            config.model_size = "tiny" if config.model_size == "small" else config.model_size

    # PLATO emotional momentum adjustments
    if rooms:
        config.room_tug_enabled = True

        # Compute total emotional weight from active rooms
        total_tug = sum(r.compute_tug() for r in rooms)
        max_tug_rooms = sorted(rooms, key=lambda r: r.priority, reverse=True)[:3]

        # High-tug war rooms increase training urgency (more epochs, faster LR)
        war_rooms = [r for r in max_tug_rooms if r.room_type == "war"]
        if war_rooms:
            config.epochs = int(config.epochs * 1.3)
            config.learning_rate *= 1.2
            config.emotional_weight = min(1.0, config.emotional_weight + 0.2)

        # Stale brainstorm rooms suggest exploration (lower LR, more diversity)
        stale_brainstorm = [r for r in rooms if r.room_type == "brainstorm" and r.staleness_s > 1800]
        if stale_brainstorm:
            config.learning_rate *= 0.8
            config.emotional_weight *= 0.9

    # Metadata LLM call for final tuning
    meta_prompt = (
        f"Hardware: {hardware.tier.value}, VRAM: {hardware.vram_mb}MB, RAM: {hardware.ram_mb}MB. "
        f"Model size: {config.model_size}, batch: {config.batch_size}, "
        f"memory budget: {config.memory_budget_mb}MB. "
        f"Adjust for optimal JEPA training on this device. "
        f"Return JSON with: reduce_batch, reduce_model, increase_patience, "
        f"enable_gradient_checkpointing, reduce_epochs, reason."
    )

    metadata = metadata_llm_call(meta_prompt, offline=offline)
    if metadata:
        if metadata.get("reduce_batch"):
            config.batch_size = max(1, config.batch_size // 2)
        if metadata.get("reduce_model") and config.model_size != "tiny":
            size_order = ["tiny", "small", "medium", "large"]
            idx = size_order.index(config.model_size)
            config.model_size = size_order[max(0, idx - 1)]
        if metadata.get("increase_patience"):
            config.epochs = int(config.epochs * 1.2)
        if metadata.get("reduce_epochs"):
            config.epochs = int(config.epochs * 0.7)

    return config


# ============================================================================
# SCRIPT GENERATION
# ============================================================================

def generate_training_script(config: JEPAScriptConfig, output_dir: str = ".") -> str:
    """Generate a ready-to-run JEPA training script from the picked config."""
    output_path = Path(output_dir) / config.script_name

    script = f'''#!/usr/bin/env python3
"""
Auto-generated JEPA Training Script
Hardware: {config.runtime} | Model: {config.model_size} | Quantization: {config.quantization}
Generated by plato_core/jepa_script_picker.py
"""

import torch
import torch.nn as nn
import math

# ---- Config ----
PATCH_SIZE = {config.patch_size}
EMBED_DIM = {config.embed_dim}
DEPTH = {config.depth}
NUM_HEADS = {config.num_heads}
BATCH_SIZE = {config.batch_size}
EPOCHS = {config.epochs}
LR = {config.learning_rate}
QUANTIZATION = "{config.quantization}"
GRADIENT_CHECKPOINTING = {config.gradient_checkpointing}
MIXED_PRECISION = {config.mixed_precision}
EMOTIONAL_WEIGHT = {config.emotional_weight}
ROOM_TUG_ENABLED = {config.room_tug_enabled}
OFFLINE = {config.offline}
MEMORY_BUDGET_MB = {config.memory_budget_mb}


class PatchEmbed(nn.Module):
    """Image to patch embedding."""
    def __init__(self, img_size=224, patch_size=PATCH_SIZE, in_chans=3, embed_dim=EMBED_DIM):
        super().__init__()
        self.num_patches = (img_size // patch_size) ** 2
        self.proj = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)

    def forward(self, x):
        return self.proj(x).flatten(2).transpose(1, 2)


class JEPAEncoder(nn.Module):
    """Vision Transformer encoder for JEPA."""
    def __init__(self, embed_dim=EMBED_DIM, depth=DEPTH, num_heads=NUM_HEADS):
        super().__init__()
        self.blocks = nn.ModuleList([
            nn.TransformerEncoderLayer(
                d_model=embed_dim, nhead=num_heads,
                dim_feedforward=embed_dim * 4,
                dropout=0.1, activation="gelu", batch_first=True,
            )
            for _ in range(depth)
        ])
        self.norm = nn.LayerNorm(embed_dim)

    def forward(self, x):
        for blk in self.blocks:
            x = blk(x)
        return self.norm(x)


class JEPAPredictor(nn.Module):
    """Predictor network: given context representation, predict target representation."""
    def __init__(self, embed_dim=EMBED_DIM, predictor_depth=6):
        super().__init__()
        self.blocks = nn.ModuleList([
            nn.TransformerEncoderLayer(
                d_model=embed_dim, nhead=max(1, NUM_HEADS // 2),
                dim_feedforward=embed_dim * 2, dropout=0.1, batch_first=True,
            )
            for _ in range(predictor_depth)
        ])
        self.norm = nn.LayerNorm(embed_dim)

    def forward(self, x):
        for blk in self.blocks:
            x = blk(x)
        return self.norm(x)


class SmallJEPA(nn.Module):
    """Small JEPA model for edge training."""
    def __init__(self):
        super().__init__()
        self.patch_embed = PatchEmbed()
        self.context_encoder = JEPAEncoder()
        self.target_encoder = JEPAEncoder()
        self.predictor = JEPAPredictor()
        # EMA update for target encoder
        self.momentum = 0.996

    def update_target_encoder(self):
        """EMA update target encoder from context encoder."""
        for param_t, param_c in zip(self.target_encoder.parameters(),
                                     self.context_encoder.parameters()):
            param_t.data = self.momentum * param_t.data + (1 - self.momentum) * param_c.data

    def forward(self, x_context, x_target, mask_context, mask_target):
        z_context = self.context_encoder(self.patch_embed(x_context))
        with torch.no_grad():
            z_target = self.target_encoder(self.patch_embed(x_target))
        pred = self.predictor(z_context)
        # VICReg-style loss: variance, invariance, covariance
        return pred, z_target


def train(model, dataloader, device, epochs=EPOCHS):
    """Main training loop."""
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.04)
    scaler = torch.amp.GradScaler("cuda", enabled=MIXED_PRECISION)

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for batch_idx, (x_ctx, x_tgt, mask_ctx, mask_tgt) in enumerate(dataloader):
            x_ctx, x_tgt = x_ctx.to(device), x_tgt.to(device)
            optimizer.zero_grad()

            with torch.amp.autocast(device_type="{config.runtime}", enabled=MIXED_PRECISION):
                pred, target = model(x_ctx, x_tgt, mask_ctx, mask_tgt)
                # Smooth L1 loss between prediction and target
                loss = torch.nn.functional.smooth_l1_loss(pred, target.detach())

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item()

        avg_loss = total_loss / max(1, len(dataloader))
        model.update_target_encoder()
        print(f"Epoch {{epoch+1}}/{{epochs}} | Loss: {{avg_loss:.4f}}")

    # Save checkpoint
    torch.save({{
        "model_state_dict": model.state_dict(),
        "config": {{
            "model_size": "{config.model_size}",
            "embed_dim": EMBED_DIM,
            "depth": DEPTH,
            "quantization": QUANTIZATION,
            "emotional_weight": EMOTIONAL_WEIGHT,
        }}
    }}, "jepa_checkpoint_{{config.model_size}}.pt"))
    print(f"Checkpoint saved: jepa_checkpoint_{config.model_size}.pt")


if __name__ == "__main__":
    device = torch.device("{config.runtime}" if torch.cuda.is_available() else "cpu")
    print(f"JEPA Training | Device: {{device}} | Model: {config.model_size}")
    print(f"Memory budget: {{MEMORY_BUDGET_MB}}MB | Batch: {{BATCH_SIZE}} | Epochs: {{EPOCHS}}")

    model = SmallJEPA().to(device)

    # Apply quantization for edge
    if QUANTIZATION == "int8":
        model = torch.quantization.quantize_dynamic(model, {{nn.Linear}}, dtype=torch.qint8)

    # Dummy dataloader for testing — replace with real data
    print("WARNING: Using dummy data. Replace with real JEPA dataset.")
    dummy_data = [(torch.randn(BATCH_SIZE, 3, 224, 224),
                    torch.randn(BATCH_SIZE, 3, 224, 224),
                    torch.ones(BATCH_SIZE, 196, dtype=torch.bool),
                    torch.ones(BATCH_SIZE, 196, dtype=torch.bool))
                   for _ in range(10)]

    train(model, dummy_data, device)
'''

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(script)
    os.chmod(output_path, 0o755)
    return str(output_path)


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="PLATO JEPA Script Picker — select optimal JEPA training for edge devices"
    )
    parser.add_argument(
        "--profile", choices=["auto", "jetson_nano", "jetson_orin", "rtx", "cpu"],
        default="auto", help="Hardware profile (default: auto-detect)"
    )
    parser.add_argument("--room-tug", action="store_true",
                        help="Show room tug analysis")
    parser.add_argument("--momentum", action="store_true",
                        help="Show emotional momentum analysis")
    parser.add_argument("--generate", action="store_true",
                        help="Generate the training script file")
    parser.add_argument("--output-dir", default=".",
                        help="Directory for generated scripts")
    parser.add_argument("--online", action="store_true",
                        help="Use online LLM metadata calls (default: offline)")
    parser.add_argument("--json", action="store_true",
                        help="Output as JSON")
    args = parser.parse_args()

    # Detect hardware
    hardware = detect_hardware()
    if args.profile != "auto":
        hardware.tier = HardwareTier(args.profile)

    # Demo room tugs for PLATO context
    demo_rooms = [
        RoomTug("war_room", "War Room", "war",
                staleness_s=600, pending_tasks=5,
                emotional_state=EmotionalState(valence=-0.3, arousal=0.9, momentum=0.7),
                active_agents=1),
        RoomTug("brainstorm_room", "Brainstorm Room", "brainstorm",
                staleness_s=3600, pending_tasks=2,
                emotional_state=EmotionalState(valence=0.6, arousal=0.4, momentum=0.2),
                active_agents=0),
        RoomTug("situation_room", "Situation Room", "situation",
                staleness_s=120, pending_tasks=3,
                emotional_state=EmotionalState(valence=0.1, arousal=0.6, momentum=0.5),
                active_agents=2),
    ]

    # Pick script
    config = pick_script(
        hardware=hardware,
        rooms=demo_rooms if (args.room_tug or args.momentum) else None,
        offline=not args.online,
    )

    # Output
    if args.json:
        output = {
            "hardware": {
                "tier": hardware.tier.value,
                "cuda": hardware.cuda_available,
                "vram_mb": hardware.vram_mb,
                "ram_mb": hardware.ram_mb,
                "is_jetson": hardware.is_jetson,
                "jetson_model": hardware.jetson_model,
                "arch": hardware.arch,
            },
            "config": asdict(config),
        }
        if args.room_tug:
            output["room_tugs"] = [
                {"room": r.room_name, "type": r.room_type, "tug": r.compute_tug(), "priority": r.priority}
                for r in demo_rooms
            ]
        print(json.dumps(output, indent=2))
    else:
        print(f"🔮 PLATO JEPA Script Picker")
        print(f"   Hardware: {hardware.tier.value} "
              f"({'Jetson ' + hardware.jetson_model if hardware.is_jetson else hardware.cuda_device_name or 'CPU'})")
        print(f"   VRAM: {hardware.vram_mb}MB | RAM: {hardware.ram_mb}MB")
        print(f"   Selected: {config.script_name}")
        print(f"   Model: {config.model_size} (dim={config.embed_dim}, depth={config.depth})")
        print(f"   Batch: {config.batch_size} | Epochs: {config.epochs} | LR: {config.learning_rate}")
        print(f"   Runtime: {config.runtime} | Quant: {config.quantization}")
        print(f"   Memory budget: {config.memory_budget_mb}MB")
        print(f"   Emotional weight: {config.emotional_weight} | Room tug: {config.room_tug_enabled}")

        if args.room_tug:
            print(f"\n📍 Room Tug Analysis:")
            for r in demo_rooms:
                tug = r.compute_tug()
                bar = "█" * int(tug * 20) + "░" * (20 - int(tug * 20))
                print(f"   {r.room_name:20s} [{bar}] {tug:.3f} "
                      f"(pending={r.pending_tasks}, stale={r.staleness_s:.0f}s)")

        if args.momentum:
            print(f"\n🎭 Emotional Momentum:")
            for r in demo_rooms:
                es = r.emotional_state
                emoji = "🔥" if es.arousal > 0.7 else "❄️" if es.arousal < 0.3 else "🌊"
                val_sign = "+" if es.valence >= 0 else ""
                print(f"   {emoji} {r.room_name:20s} "
                      f"valence={val_sign}{es.valence:.1f} arousal={es.arousal:.1f} "
                      f"momentum={es.momentum:.2f}")

    # Generate script if requested
    if args.generate:
        path = generate_training_script(config, args.output_dir)
        print(f"\n📝 Generated: {path}")


if __name__ == "__main__":
    main()
