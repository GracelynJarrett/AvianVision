from dotenv import load_dotenv
import os

load_dotenv()
token = os.getenv("HF_TOKEN")

if token:
    print(f"Token loaded successfully. Length: {len(token)} characters.")
else:
    print("Token NOT found — check the name in your .env file.")