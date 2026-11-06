import os
from datetime import datetime, timezone
from bson import ObjectId
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app)

def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def json_safe(document):
    if not document:
        return document
    document["id"] = str(document.pop("_id"))
    return document

def mongo_client():
    host = os.getenv("MONGO_HOST", "localhost")
    port = int(os.getenv("MONGO_PORT", "27017"))
    username = os.getenv("MONGO_USERNAME", "")
    password = os.getenv("MONGO_PASSWORD", "")
    if username and password:
        return MongoClient(
            host=host, port=port, username=username, password=password,
            authSource=os.getenv("MONGO_AUTH_SOURCE", "admin"),
            serverSelectionTimeoutMS=2500
        )
    return MongoClient(host=host, port=port, serverSelectionTimeoutMS=2500)

client = mongo_client()
db = client[os.getenv("MONGO_DATABASE", "opspilot")]

def seed_data():
    if db.services.count_documents({}) == 0:
        db.services.insert_many([
            {"name": "customer-api", "environment": "dev", "owner": "Platform", "status": "Healthy", "version": "v1.8.2", "description": "Customer profile and account API", "created_at": utc_now()},
            {"name": "payments-worker", "environment": "staging", "owner": "Payments", "status": "Degraded", "version": "v2.4.0", "description": "Processes payment events asynchronously", "created_at": utc_now()},
            {"name": "web-portal", "environment": "prod", "owner": "Frontend", "status": "Healthy", "version": "v3.1.1", "description": "Customer-facing operations portal", "created_at": utc_now()},
            {"name": "reporting-service", "environment": "dev", "owner": "Data", "status": "Maintenance", "version": "v0.9.5", "description": "Builds daily operational reports", "created_at": utc_now()},
        ])
    if db.incidents.count_documents({}) == 0:
        db.incidents.insert_many([
            {"title": "Elevated payment queue latency", "service": "payments-worker", "severity": "High", "status": "Investigating", "assignee": "Alex Morgan", "description": "Queue processing delay is above the expected threshold.", "created_at": utc_now()},
            {"title": "Intermittent portal timeouts", "service": "web-portal", "severity": "Medium", "status": "Monitoring", "assignee": "Sam Lee", "description": "A small number of requests are timing out.", "created_at": utc_now()},
            {"title": "Missing report for dev environment", "service": "reporting-service", "severity": "Low", "status": "Open", "assignee": "Unassigned", "description": "Latest scheduled report did not appear.", "created_at": utc_now()},
        ])
    if db.deployments.count_documents({}) == 0:
        db.deployments.insert_many([
            {"service": "web-portal", "version": "v3.1.1", "environment": "prod", "status": "Succeeded", "deployer": "release-bot", "created_at": utc_now()},
            {"service": "payments-worker", "version": "v2.4.0", "environment": "staging", "status": "Succeeded", "deployer": "j.smith", "created_at": utc_now()},
            {"service": "customer-api", "version": "v1.8.2", "environment": "dev", "status": "Failed", "deployer": "release-bot", "created_at": utc_now()},
            {"service": "reporting-service", "version": "v0.9.5", "environment": "dev", "status": "Succeeded", "deployer": "a.patel", "created_at": utc_now()},
        ])

@app.get("/health")
def health():
    # Liveness: the Flask process is running; does not depend on MongoDB.
    return jsonify({"status": "alive", "service": "opspilot-api", "timestamp": utc_now()}), 200

@app.get("/ready")
def ready():
    # Readiness: only ready to serve normal traffic if MongoDB responds.
    try:
        client.admin.command("ping")
        return jsonify({"status": "ready", "database": "connected"}), 200
    except PyMongoError:
        return jsonify({"status": "not_ready", "database": "unavailable"}), 503

@app.get("/api/summary")
def summary():
    try:
        services = list(db.services.find({}, {"_id": 0, "status": 1}))
        incidents = list(db.incidents.find({}, {"_id": 0, "status": 1, "severity": 1}))
        deployments = list(db.deployments.find({}, {"_id": 0, "status": 1}))
        return jsonify({
            "services_total": len(services),
            "services_healthy": sum(s.get("status") == "Healthy" for s in services),
            "incidents_open": sum(i.get("status") not in ("Resolved", "Closed") for i in incidents),
            "high_severity": sum(i.get("severity") == "High" and i.get("status") not in ("Resolved", "Closed") for i in incidents),
            "deployments_total": len(deployments),
            "deployments_failed": sum(d.get("status") == "Failed" for d in deployments),
            "generated_at": utc_now()
        })
    except PyMongoError as exc:
        return jsonify({"error": "Database query failed", "detail": str(exc)}), 503

def collection_for(kind):
    mapping = {"services": db.services, "incidents": db.incidents, "deployments": db.deployments}
    return mapping.get(kind)

@app.get("/api/<kind>")
def list_records(kind):
    collection = collection_for(kind)
    if collection is None:
        return jsonify({"error": "Unknown resource"}), 404
    query = {}
    status = request.args.get("status")
    environment = request.args.get("environment")
    if status:
        query["status"] = status
    if environment and kind in ("services", "deployments"):
        query["environment"] = environment
    records = [json_safe(doc) for doc in collection.find(query).sort("_id", -1).limit(100)]
    return jsonify(records)

@app.post("/api/<kind>")
def create_record(kind):
    collection = collection_for(kind)
    if collection is None:
        return jsonify({"error": "Unknown resource"}), 404
    data = request.get_json(silent=True) or {}
    required = {
        "services": ["name", "environment", "owner", "version"],
        "incidents": ["title", "service", "severity", "assignee"],
        "deployments": ["service", "version", "environment", "deployer"],
    }[kind]
    missing = [field for field in required if not str(data.get(field, "")).strip()]
    if missing:
        return jsonify({"error": "Missing required fields", "fields": missing}), 400
    defaults = {
        "services": {"status": "Healthy", "description": ""},
        "incidents": {"status": "Open", "description": ""},
        "deployments": {"status": "Succeeded"},
    }[kind]
    record = {**defaults, **data, "created_at": utc_now()}
    result = collection.insert_one(record)
    record["_id"] = result.inserted_id
    return jsonify(json_safe(record)), 201

@app.patch("/api/<kind>/<record_id>")
def update_record(kind, record_id):
    collection = collection_for(kind)
    if collection is None:
        return jsonify({"error": "Unknown resource"}), 404
    try:
        object_id = ObjectId(record_id)
    except Exception:
        return jsonify({"error": "Invalid record ID"}), 400
    data = request.get_json(silent=True) or {}
    allowed = {
        "services": {"name", "environment", "owner", "status", "version", "description"},
        "incidents": {"title", "service", "severity", "status", "assignee", "description"},
        "deployments": {"service", "version", "environment", "status", "deployer"},
    }[kind]
    changes = {k: v for k, v in data.items() if k in allowed}
    if not changes:
        return jsonify({"error": "No supported fields supplied"}), 400
    result = collection.update_one({"_id": object_id}, {"$set": changes})
    if result.matched_count == 0:
        return jsonify({"error": "Record not found"}), 404
    return jsonify(json_safe(collection.find_one({"_id": object_id})))

@app.delete("/api/<kind>/<record_id>")
def delete_record(kind, record_id):
    collection = collection_for(kind)
    if collection is None:
        return jsonify({"error": "Unknown resource"}), 404
    try:
        object_id = ObjectId(record_id)
    except Exception:
        return jsonify({"error": "Invalid record ID"}), 400
    result = collection.delete_one({"_id": object_id})
    if result.deleted_count == 0:
        return jsonify({"error": "Record not found"}), 404
    return jsonify({"deleted": True, "id": record_id})

@app.errorhandler(500)
def server_error(_error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    seed_data()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")), debug=False)
