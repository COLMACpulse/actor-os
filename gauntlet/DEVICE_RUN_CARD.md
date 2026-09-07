# DEVICE RUN CARD

DEVICE:
OS / VERSION:
ACTOR OS BUILD:
DATE:

1. Install debug/native build.
2. Grant camera + microphone only when prompted.
3. Run G01-G07.
4. Record at least one real MASTER.
5. Note returned masterId + SHA receipt.
6. FORCE KILL the app.
7. Relaunch.
8. Verify master and receipt still exist.
9. Export/copy vault evidence.
10. Run verify_master_hashes.py on copied evidence.
11. Run CASTING landscape master.
12. Run SOCIAL portrait master.
13. Run 10-master endurance.
14. Record battery/free storage before and after.
15. Do not promote device support if any required test is FAIL.

TIGHTENING RULE:
Every FAIL must become one of:
- code defect → fix
- unsupported hardware/API → capability gate
- permission/OS policy → explicit user flow
- UNKNOWN → retain UNKNOWN until proved
