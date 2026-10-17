# snowflake_client.py
#
# Purpose: Handles connecting to the Snowflake data warehouse using credentials
# stored in the project's .env file. Other scripts import get_snowflake_connection()
# from this file whenever they need to read from or write to Snowflake.
#
# Usage: Import and call get_snowflake_connection() in any script that needs
# to read from or write to Snowflake.

import getpass
import os

import snowflake.connector
from dotenv import load_dotenv


def get_snowflake_connection():
    """Creates and returns a live connection to the Snowflake data warehouse."""

    # Load the .env file so the Snowflake credentials are available as environment variables.
    load_dotenv()

    # Read each credential from the environment.
    # These values come from the .env file and are never hardcoded here.
    account = os.getenv("SNOWFLAKE_ACCOUNT")
    user = os.getenv("SNOWFLAKE_USER")
    password = os.getenv("SNOWFLAKE_PASSWORD")
    database = os.getenv("SNOWFLAKE_DATABASE")
    schema = os.getenv("SNOWFLAKE_SCHEMA")
    warehouse = os.getenv("SNOWFLAKE_WAREHOUSE")

    # Ask for the 6-digit MFA code from the authenticator app.
    # getpass hides the input so the code is not visible in the terminal.
    passcode = getpass.getpass("Enter your Snowflake MFA code: ")

    # Open the connection to Snowflake, passing both the password and the
    # TOTP passcode so Snowflake can verify both factors at once.
    conn = snowflake.connector.connect(
        account=account,
        user=user,
        password=password,
        database=database,
        schema=schema,
        warehouse=warehouse,
        authenticator="username_password_mfa",
        passcode=passcode,
    )

    return conn
