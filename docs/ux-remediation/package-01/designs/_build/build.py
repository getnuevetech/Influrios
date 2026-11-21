"""Build Package 1 boards: python3 docs/ux-remediation/package-01/designs/_build/build.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b_home_hub
BUILDERS = [b_home_hub.build_home, b_home_hub.build_hub]
try:
    import b_payout; BUILDERS += [b_payout.build]
except ImportError: pass
try:
    import b_invite; BUILDERS += [b_invite.build_invite, b_invite.build_notifications]
except ImportError: pass
try:
    import b_business; BUILDERS += [b_business.build]
except ImportError: pass
try:
    import b_misc; BUILDERS += b_misc.BUILDERS
except ImportError: pass
for b in BUILDERS:
    b()
print("built", len(BUILDERS))
