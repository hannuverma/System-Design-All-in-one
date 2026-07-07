import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

MASTER_DB_URL = os.environ.get("MASTER_DB_URL")
SLAVE_DB_URL = os.environ.get("SLAVE_DB_URL")


app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "System Design Sandbox App Layer is Alive!"}
