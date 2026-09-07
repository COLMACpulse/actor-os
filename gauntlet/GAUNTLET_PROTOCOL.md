# ACTOR OS — PHYSICAL DEVICE GAUNTLET v1.0

PURPOSE
-------
Prove the native camera core on real hardware.

This gauntlet does not grade acting. It verifies device capability, recording,
persistence, integrity, and the truthfulness of the native bridge.

TEST ORDER
----------
G01 Permissions
G02 Hardware enumeration
G03 Lens/camera selection
G04 Focus / exposure
G05 Stabilization
G06 Cinematic capability truth
G07 Master recording
G08 Kill / relaunch persistence
G09 Hash survival
G10 Storage / battery edge states
G11 Orientation master rule
G12 10-master endurance run

PASS RULE
---------
A device is supported only if all required tests pass or are explicitly
classified UNSUPPORTED by runtime capability discovery.

UNKNOWN > fabricated support.

EVIDENCE
--------
Each device run produces:
- device_manifest.json
- capability_snapshot.json
- gauntlet_events.ndjson
- master_receipts/
- post_relaunch_verification.json
- GAUNTLET_REPORT.html
