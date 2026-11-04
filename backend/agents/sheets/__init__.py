"""Sheets domain package (004): lyrics+chords generation pipeline.

Layering (Principle VIII): pure domain — MUST NOT import the web layer
(`app/`). Pipeline stages (R0): candidates → charts / lyrics → fallback
(model chords on chart miss only) → normalize → sources → persist.
"""
