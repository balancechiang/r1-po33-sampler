# Remaining validation

- Hardware sync: first-start USB output on iPhone, pulse level/width, long-term phase, tempo changes, Swing, chain edits and FX release alignment. Browser tests are not hardware certification.
- Slave timing: calibrate the 40 ms scheduling cushion against direct audio and physical interfaces. Validate real stereo capture on target browsers.
- Sampling: threshold-triggered ARMED state is not implemented. Confirm recording-release semantics on hardware.
- Sound fidelity: compare transient slices, four-voice arbitration, same-slot choke, coloration, filter curves and all punch-in effects with identical hardware material.
- Protocol: hardware round trips after editing slice boundaries and parameter locks. Some new web parameter mappings are approximations.
- Display: meter ballistics and parameter feedback durations remain visual approximations.
- Browser lifecycle: iPhone/iPad lock/unlock, first play, route changes, microphone gain/permissions, camera orientation and PWA behavior need real-device coverage.
- Optional rabbit r1 host: verify USB stereo input/output, audio recovery and storage behavior on-device.
