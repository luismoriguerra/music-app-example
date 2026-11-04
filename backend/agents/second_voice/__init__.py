"""Second-voice domain package (006): transpose-aware harmonic analysis.

Layering (Principle VIII): pure domain — MUST NOT import the web layer
(`app/`). Consumes the transposed chord snapshot the frontend POSTs
(validated against the immutable stored sheet) plus the stored lyrics,
runs the 19-step theory analysis via an Agno Agent, and persists the
structured `SecondVoiceOut` JSON (R9).
"""
