#!/usr/bin/env python3
"""Entry point: `python run.py <command>` — see `python run.py --help`."""

import sys

from animator.cli import main

if __name__ == "__main__":
    sys.exit(main())
