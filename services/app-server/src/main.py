import json
import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
import asyncpg
import redis.asyncio as aioredis
import docker
import docker.errors
from typing import Dict, Any

load_dotenv()

SHARD0_MASTER_URL = os.environ.get("SHARD0_MASTER_URL")
SHARD0_SLAVE_URL = os.environ.get("SHARD0_SLAVE_URL")
SHARD1_MASTER_URL = os.environ.get("SHARD1_MASTER_URL")
SHARD1_SLAVE_URL = os.environ.get("SHARD1_SLAVE_URL")
REDIS_URL = os.environ.get("REDIS_URL")
SERVER_NAME = os.environ.get("APP_SERVER_NAME")

def get_infrastructure_target(task_id: int, request_type: str):
    shard_id = task_id % 2
    shard_key = f"shard{shard_id}"
    
    if request_type == "WRITE":
        if cluster_state[shard_key]["slave_promoted"]:
            return shard_key, "master" # Promoted slave is the new master
        return shard_key, "master"
    else:
        # READ request
        if cluster_state[shard_key]["slave_online"] and not cluster_state[shard_key]["slave_promoted"]:
            return shard_key, "slave"
        else:
            return shard_key, "master"

system_pools: Dict[str, Any] = {
    "shard0": {
        "master": None,
        "slave": None
    },
    "shard1": {
        "master": None,
        "slave": None
    },
    "redis": None
}

cluster_state = {
    "shard0": {
        "active_master": "db-shard0-master",
        "slave_promoted": False,
        "master_online": True,
        "slave_online": True
    },
    "shard1": {    
        "active_master": "db-shard1-master",
        "slave_promoted": False,
        "master_online": True,
        "slave_online": True
    }
}

seconds_till_redis_key_expires = 60

def get_docker_client():
    try:
        return docker.from_env()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot link to host machine Docker socket: {e}")

async def connect_with_retry(name, url, max_retries=10, delay=2):
    for attempt in range(1, 1+ max_retries):
        try: 
            pool = await asyncpg.create_pool(url, timeout=3)
            print(f"Successfully connected to {name} DB pool!")
            return pool
        except Exception as e:
            print(f"[{attempt}/{max_retries}] Waiting for {name} DB to accept connections... ({e})")
            await asyncio.sleep(delay)
    raise RuntimeError(f"Could not connect to {name} DB after {max_retries} attempts.")

async def health_monitor_supervisor():
    await asyncio.sleep(10)
    docker_client = get_docker_client()
    
    urls = {
        "shard0": {"master": SHARD0_MASTER_URL, "slave": SHARD0_SLAVE_URL},
        "shard1": {"master": SHARD1_MASTER_URL, "slave": SHARD1_SLAVE_URL}
    }
    
    while True:
        for shard_key in ["shard0", "shard1"]:
            # Check Master
            try:
                temp_conn = await asyncpg.connect(urls[shard_key]["master"], timeout=2)
                await temp_conn.execute("SELECT 1;")
                await temp_conn.close()
                cluster_state[shard_key]["master_online"] = True
                
                # Recreate pool if it was missing at startup
                if system_pools[shard_key]["master"] is None:
                    system_pools[shard_key]["master"] = await asyncpg.create_pool(urls[shard_key]["master"], timeout=3)
            except Exception:
                cluster_state[shard_key]["master_online"] = False
                
            # Check Slave
            try:
                temp_conn = await asyncpg.connect(urls[shard_key]["slave"], timeout=2)
                await temp_conn.execute("SELECT 1;")
                await temp_conn.close()
                cluster_state[shard_key]["slave_online"] = True
                
                # Recreate pool if it was missing at startup
                if system_pools[shard_key]["slave"] is None:
                    system_pools[shard_key]["slave"] = await asyncpg.create_pool(urls[shard_key]["slave"], timeout=3)
            except Exception:
                cluster_state[shard_key]["slave_online"] = False

            # Failover logic
            if cluster_state[shard_key]["active_master"] == f"db-{shard_key}-master" and not cluster_state[shard_key]["slave_promoted"]:
                if not cluster_state[shard_key]["master_online"]:
                    print(f"\n[ALERT] Health Monitor detected {shard_key.upper()} MASTER CRASH")
                    print(f"[FAILOVER] Initiating automated promotion protocol for {shard_key}...")

                    try:
                        slave_container = docker_client.containers.get(f"db-{shard_key}-slave")
                        result = slave_container.exec_run("pg_ctl -D /var/lib/postgresql/data promote")
                        output = result.output
                        decoded_output = output.decode().strip() if isinstance(output, bytes) else b"".join(output).decode().strip()
                        print(f"[FAILOVER] Shell execution output: {decoded_output}")

                        print(f"[FAILOVER] Swapping system connections over to the promoted node for {shard_key}...")
                        if system_pools[shard_key]["master"]:
                            await system_pools[shard_key]["master"].close()

                        NEW_MASTER_URL = urls[shard_key]["slave"]
                        system_pools[shard_key]["master"] = await asyncpg.create_pool(NEW_MASTER_URL, timeout=5)

                        cluster_state[shard_key]["active_master"] = f"db-{shard_key}-slave"
                        cluster_state[shard_key]["slave_promoted"] = True
                        print(f"[SYSTEM INFRASTRUCTURE WARNING] Automated Failover complete. 'db-{shard_key}-slave' has been successfully promoted to MASTER.\n")

                    except Exception as failover_error:
                        print(f"[CRITICAL ERROR] Automated failover execution sequence failed for {shard_key}: {failover_error}")   
                        
            elif cluster_state[shard_key]["slave_promoted"] and cluster_state[shard_key]["master_online"]:
                print(f"[SYSTEM RECOVERY] Original {shard_key} master is back online! Manual intervention may be required to sync data.")

        await asyncio.sleep(2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Connecting to the Master and Slave DBs for all shards")
    try:
        if REDIS_URL is not None:
            system_pools["redis"] = aioredis.from_url(REDIS_URL, decode_responses=True)
            print("Successfully connected to Redis!")
        else:
            print("No redis URL found")
    except Exception as e:
        print(f"Error initializing Redis: {e}")
        
    for name, shard_key, url, role in [
        ("Shard0 Master", "shard0", SHARD0_MASTER_URL, "master"),
        ("Shard0 Slave", "shard0", SHARD0_SLAVE_URL, "slave"),
        ("Shard1 Master", "shard1", SHARD1_MASTER_URL, "master"),
        ("Shard1 Slave", "shard1", SHARD1_SLAVE_URL, "slave"),
    ]:
        try:
            system_pools[shard_key][role] = await connect_with_retry(name, url, max_retries=5)
        except Exception as e:
            print(f"Error initializing {name} pool: {e}")
        
    monitor_task = asyncio.create_task(health_monitor_supervisor())
    yield
    monitor_task.cancel()
    
    print("Closing database pools...")
    for shard in ["shard0", "shard1"]:
        if system_pools[shard]["master"]:
            await system_pools[shard]["master"].close()
        if system_pools[shard]["slave"]:
            await system_pools[shard]["slave"].close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/items")
async def create_item(name: str):
    redis_client = system_pools.get("redis")
    if not redis_client:
        raise HTTPException(status_code=500, detail="Redis client unavailable, cannot generate global ID")
        
    new_id = await redis_client.incr("global_item_id")
    shard_key, db_role = get_infrastructure_target(new_id, "WRITE")
    
    pool = system_pools[shard_key].get(db_role)
    if not pool: 
        raise HTTPException(status_code=503, detail=f"{shard_key} {db_role} Database is offline!")
        
    async with pool.acquire() as connection:
        await connection.execute(
            "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT);"
        )
        await connection.execute(
            "INSERT INTO items(id, name) VALUES($1, $2);", new_id, name
        )
        return {"status": "success", "data": {"id": new_id, "name": name}, "server": f"{shard_key}_{db_role}", "handled_by": SERVER_NAME}

async def get_redis_client():
    redis_client = system_pools.get("redis")
    if not redis_client:
        return False
    try:
        await redis_client.ping()
        return True
    except Exception:
        return False

@app.get("/redisItems")
async def get_items_in_redis():
    redis_client = system_pools.get("redis")
    if not redis_client:
        raise HTTPException(status_code=500, detail="Redis client unavailable")
    
    keys = await redis_client.keys("*")
    all_data = {}
    for key in keys:
        key_type = await redis_client.type(key)
        if key_type == "string":
            val = await redis_client.get(key)
            try:
                all_data[key] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                all_data[key] = val
        elif key_type == "hash":
            all_data[key] = await redis_client.hgetall(key)
        elif key_type == "list":
            all_data[key] = await redis_client.lrange(key, 0, -1)
        elif key_type == "set":
            all_data[key] = await redis_client.smembers(key)
        else:
            all_data[key] = f"Unsupported type: {key_type}"

    return {"count": len(all_data), "data": all_data, "handled_by": SERVER_NAME}

@app.get("/items/{item_id}")
async def get_item(item_id: int):
    redis_client = system_pools.get("redis")
    cache_key = f"item:{item_id}"
    
    if not redis_client:
        raise HTTPException(status_code=500, detail="Redis client unavailable")

    cached_data = await redis_client.get(cache_key)
    if cached_data:
        return {"status": "success", "data": json.loads(cached_data), "source": "redis_cache_hit", "handled_by": SERVER_NAME}

    shard_key, db_role = get_infrastructure_target(item_id, "READ")
    target_pool = system_pools[shard_key].get(db_role)
    
    if not target_pool:
        target_pool = system_pools[shard_key].get("master")
        db_role = "master"
        
    if not target_pool:
        raise HTTPException(status_code=500, detail=f"No active database replica available to fulfill this request for {shard_key}.")

    async with target_pool.acquire() as connection:
        try:
            row = await connection.fetchrow("SELECT id, name FROM items WHERE id=$1;", item_id)
            if not row:
                 return {"status": "error", "message": "Item not found", "handled_by": SERVER_NAME}
            
            item_data = {"id": row["id"], "name": row["name"]}
            await redis_client.setex(cache_key, seconds_till_redis_key_expires, json.dumps(item_data))
            return {"status": "success", "data": item_data, "server": f"{shard_key}_{db_role}_db_cache_miss", "handled_by": SERVER_NAME}
            
        except asyncpg.exceptions.UndefinedTableError:
            return {"status": "success", "data": [], "server": f"{shard_key}_{db_role}_db_cache_miss", "message": "No items table exists yet.", "handled_by": SERVER_NAME}

@app.get("/slaveItems")
async def get_slave_items():
    all_items = {}
    used_servers = []
    
    for shard_key in ["shard0", "shard1"]:

        if cluster_state[shard_key]["slave_online"]:
            db_role = "slave"
            print(f"slave_{shard_key} online")
        elif cluster_state[shard_key]["master_online"]:
            db_role = "master"
            print(f"master_{shard_key} online")
        else:
            print("both offline")
            continue

        target_pool = system_pools[shard_key].get(db_role)
        
        if not target_pool:
            db_role = "master"
            target_pool = system_pools[shard_key].get("master")
            
        if not target_pool:
            continue
            
        used_servers.append(f"{shard_key}_{db_role}")
            
        async with target_pool.acquire() as connection:
            try:
                rows = await connection.fetch("SELECT id, name FROM items;")
                for row in rows:
                    all_items[row["id"]] = row["name"]
            except asyncpg.exceptions.UndefinedTableError:
                pass

    return {"status": "success", "data": all_items, "server": ",".join(used_servers), "handled_by": SERVER_NAME}

@app.get("/status")
async def get_system_status():
    redis_status = await get_redis_client()
    return {
        "status": "success",
        "components": {
            "redis_cache": "online" if redis_status else "offline",
        },
        "cluster_state": cluster_state,
        "handled_by": SERVER_NAME
    }

@app.get("/chaos/status")
async def get_chaos_status():
    docker_client = get_docker_client()
    targets = ["db-shard0-master", "db-shard0-slave", "db-shard1-master", "db-shard1-slave", "redis-cache", "fastapi-app-server-1", "fastapi-app-server-2", "nginx-lb"]
    status_report = {}
    for name in targets:
        try:
            container = docker_client.containers.get(name)
            status_report[name] = container.status
        except docker.errors.NotFound:
            status_report[name] = "not_found"
    return {"status": "success", "cluster_state": status_report}

def delayed_kill(container):
    import time
    time.sleep(0.5)
    container.kill()

@app.post("/chaos/kill/{container_name}")
async def kill_container(container_name: str, background_tasks: BackgroundTasks):
    docker_client = get_docker_client()
    try:
        container = docker_client.containers.get(container_name)
        background_tasks.add_task(delayed_kill, container)
        return {"status": "success", "message": f"Successfully crashed server node: '{container_name}'"}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Server node target '{container_name}' not found.")

@app.post("/chaos/revive/{container_name}")
async def revive_container(container_name: str):
    docker_client = get_docker_client()
    try:
        container = docker_client.containers.get(container_name)
        container.start()
        return {"status": "success", "message": f"Server node '{container_name}' has booted back online."}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Server node target '{container_name}' not found.")
