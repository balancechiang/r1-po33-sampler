# Remaining validation

- Hardware sync: measure pulse level/width and test long-term phase, tempo changes, Swing and chain edits. User-confirmed first-start SY1 and post-FX sync are recorded below; other configurations remain unverified.
- Slave timing: calibrate the 40 ms scheduling cushion against direct audio and physical interfaces. Validate real stereo capture on target browsers.
- Sampling: threshold-triggered ARMED state is not implemented. Confirm recording-release semantics on hardware.
- Sound fidelity: compare transient slices, four-voice arbitration, same-slot choke, coloration, filter curves and all punch-in effects with identical hardware material.
- Protocol: hardware round trips after editing slice boundaries and parameter locks. Some new web parameter mappings are approximations.
- Display: meter ballistics and parameter feedback durations remain visual approximations.
- Browser lifecycle: iPhone/iPad lock/unlock, first play, route changes, microphone gain/permissions, camera orientation and PWA behavior need real-device coverage.
- Optional rabbit r1 host: verify USB stereo input/output, audio recovery and storage behavior on-device.

## User-confirmed device checks

On 2026-11-26 the user reported both previously requested checks passed:

- SY1 first start in the reported iPhone/adapter → PO-33 setup.
- Synchronization after using FX in that setup.

This confirms the reported scenarios. The report does not enumerate every FX, test duration, adapter model or other device configurations; those details are not inferred.
