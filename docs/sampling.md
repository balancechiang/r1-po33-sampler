# Sampling

Hold RECORD and press a slot to arm sampling. The input meter remains live and `rec` blinks while waiting for sound. Waiting uses no sample memory and keeps the existing slot intact.

A signal crossing the fixed internal threshold begins capture and the remaining-time countdown. Silence after that point is recorded normally. Recording stops when RECORD is released or the shared sample pool fills.

- Physical RECORD: after trigger, the pad may be released while RECORD remains held.
- RECORD HOLD: releasing the pad finishes the single-finger take and exits HOLD.
- Pad release before trigger: cancel waiting without replacing the slot.
- Pointer cancellation or input failure: roll back the take.

The threshold is currently−32dBFS after the selected input gain/auto-level processing. This is an internal calibration value, not a published PO-33 specification. No fixed pre-roll duration is claimed. Hardware comparison of the threshold and release semantics remains pending. The official recording instructions are at https://teenage.engineering/guides/po-33/en.

Musical sampling uses a mono AudioWorklet. Stereo backup transfer has a separate capture pipeline and is unaffected. Raw PCM is committed only after a valid take; drum slots then run transient slicing.
