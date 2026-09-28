# help_read_yaml.py
#
# Purpose: A small, reusable helper for reading YAML configuration files into
# Python dictionaries. The project has more than one config file (model settings
# and image settings), so this gives us one consistent way to load any of them.

import yaml


def read_yaml(file_path):
    """Reads a YAML file at the given path and returns its contents as a dictionary."""
    # Open the YAML file for reading.
    with open(file_path, "r") as file:
        # Parse the file's text into a Python dictionary (safe_load ignores any
        # unsafe/executable content, so it only reads plain data).
        config = yaml.safe_load(file)
    # Hand the settings back to whoever asked for them.
    return config
