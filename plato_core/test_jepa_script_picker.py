#!/usr/bin/env python3
"""Tests for plato_core/jepa_script_picker.py — PR #1440"""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from jepa_script_picker import (
    HardwareTier, HardwareProfile, JEPAScriptConfig, EmotionalState, RoomTug,
    pick_script, detect_hardware, generate_training_script,
    metadata_llm_call, _offline_metadata_heuristic, SCRIPT_MAP,
)


class TestHardwareDetection(unittest.TestCase):
    def test_detect_runs(self):
        hw = detect_hardware()
        self.assertIsInstance(hw, HardwareProfile)
        self.assertIsInstance(hw.tier, HardwareTier)
        self.assertGreater(hw.ram_mb, 0)

    def test_override_tier(self):
        hw = detect_hardware()
        hw.tier = HardwareTier.RTX_DESKTOP
        config = pick_script(hardware=hw)
        self.assertEqual(config.runtime, "cuda")
        self.assertEqual(config.script_name, "jepa_train_rtx.py")


class TestScriptPicking(unittest.TestCase):
    def test_all_tiers_have_configs(self):
        for tier in HardwareTier:
            self.assertIn(tier, SCRIPT_MAP)

    def test_jetson_nano_small_model(self):
        hw = HardwareProfile(tier=HardwareTier.JETSON_NANO, is_jetson=True, jetson_model="Nano")
        config = pick_script(hardware=hw)
        self.assertEqual(config.model_size, "tiny")
        self.assertTrue(config.gradient_checkpointing)
        self.assertTrue(config.mixed_precision)

    def test_rtx_gets_bigger_model(self):
        hw = HardwareProfile(tier=HardwareTier.RTX_DESKTOP, cuda_available=True, vram_mb=8192)
        config = pick_script(hardware=hw)
        self.assertEqual(config.model_size, "medium")
        self.assertTrue(config.data_parallel)

    def test_cpu_no_mixed_precision(self):
        hw = HardwareProfile(tier=HardwareTier.CPU_ONLY)
        config = pick_script(hardware=hw)
        self.assertFalse(config.mixed_precision)
        self.assertEqual(config.batch_size, 1)

    def test_low_vram_scales_down(self):
        hw = HardwareProfile(tier=HardwareTier.RTX_DESKTOP, cuda_available=True, vram_mb=2048)
        config = pick_script(hardware=hw)
        # Should have reduced batch and/or model
        self.assertLessEqual(config.memory_budget_mb, 2048 - 512)


class TestEmotionalMomentum(unittest.TestCase):
    def test_war_room_high_tug(self):
        room = RoomTug("war", "War Room", "war",
                       staleness_s=600, pending_tasks=8,
                       emotional_state=EmotionalState(valence=-0.5, arousal=0.95, momentum=0.8),
                       active_agents=0)
        tug = room.compute_tug()
        self.assertGreater(tug, 0.05)  # tug scale is multiplicative, values are small

    def test_empty_room_low_tug(self):
        room = RoomTug("empty", "Empty Room", "brainstorm",
                       staleness_s=10, pending_tasks=0,
                       emotional_state=EmotionalState(valence=0.0, arousal=0.1, momentum=0.0),
                       active_agents=0)
        tug = room.compute_tug()
        self.assertLess(tug, 0.1)

    def test_stale_room_higher_tug(self):
        fresh = RoomTug("a", "A", "situation", staleness_s=60, pending_tasks=3,
                        emotional_state=EmotionalState(valence=0.5, arousal=0.5, momentum=0.5))
        stale = RoomTug("b", "B", "situation", staleness_s=3600, pending_tasks=3,
                        emotional_state=EmotionalState(valence=0.5, arousal=0.5, momentum=0.5))
        self.assertGreater(stale.compute_tug(), fresh.compute_tug())

    def test_rooms_affect_training(self):
        hw = HardwareProfile(tier=HardwareTier.CPU_ONLY)
        no_rooms = pick_script(hardware=hw, rooms=None)
        
        war_rooms = [RoomTug("war", "War Room", "war",
                      staleness_s=600, pending_tasks=10,
                      emotional_state=EmotionalState(valence=-0.8, arousal=0.95, momentum=0.9),
                      active_agents=0)]
        with_rooms = pick_script(hardware=hw, rooms=war_rooms)
        # War rooms should increase emotional weight and/or epochs
        self.assertTrue(
            with_rooms.emotional_weight > no_rooms.emotional_weight
            or with_rooms.epochs > no_rooms.epochs
        )


class TestMetadataLLM(unittest.TestCase):
    def test_offline_heuristic_low_memory(self):
        result = _offline_metadata_heuristic("model OOM with low memory on device")
        self.assertTrue(result["reduce_batch"])
        self.assertTrue(result["reduce_model"])

    def test_offline_heuristic_overfitting(self):
        result = _offline_metadata_heuristic("seeing overfitting in validation loss")
        self.assertTrue(result["increase_patience"])

    def test_metadata_offline_call(self):
        result = metadata_llm_call("test prompt", offline=True)
        self.assertIsInstance(result, dict)
        self.assertIn("reason", result)


class TestScriptGeneration(unittest.TestCase):
    def test_generates_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config = SCRIPT_MAP[HardwareTier.CPU_ONLY]
            path = generate_training_script(config, tmpdir)
            self.assertTrue(os.path.exists(path))
            content = open(path).read()
            self.assertIn("SmallJEPA", content)
            self.assertIn("train(", content)

    def test_generated_script_is_executable(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config = SCRIPT_MAP[HardwareTier.CPU_ONLY]
            path = generate_training_script(config, tmpdir)
            self.assertTrue(os.access(path, os.X_OK))


class TestProfileOverride(unittest.TestCase):
    def test_profile_override(self):
        config = pick_script(profile_override="jetson_orin")
        self.assertEqual(config.script_name, "jepa_train_jetson_orin.py")
        self.assertEqual(config.model_size, "small")


if __name__ == "__main__":
    unittest.main()
