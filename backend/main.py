import base64
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import datetime
from database import load_items, save_items
from detection import process_image
from expiry import predict_expiry, STORAGE_LOC_MAP, CLIMATE_ZONE_MAP, train_model
from recipes import suggest_recipes

app = FastAPI(title="FreshTrack API")

# Allow CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request bodies
class InventoryItem(BaseModel):
    item_name: str
    quantity: int = 1
    confidence_score: float
    storage_location: str  # fridge, freezer, pantry, countertop, outside
    days_already_stored: int = 0
    is_perishable: bool = False
    climate_zone: str = "moderate"  # hot, moderate, cold

class Feedback(BaseModel):
    item_id: str
    feedback_score: int # -1, 0, 1

# Helper to serialize MongoDB object IDs
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

# Dynamic calculations based on storage room-temp special rules
def calculate_item_status(
    date_added: datetime.datetime,
    effective_start_date: datetime.datetime,
    adjusted_shelf_life: float,
    days_already_stored: int,
    storage_location: str,
    is_perishable: bool,
    item_name: str
):
    # Calculate days elapsed since item was added
    today = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Ensure added date and effective start date are comparable (timezone naive)
    if date_added.tzinfo:
        date_added = date_added.replace(tzinfo=None)
    if effective_start_date.tzinfo:
        effective_start_date = effective_start_date.replace(tzinfo=None)
        
    days_since_added = (today - date_added.replace(hour=0, minute=0, second=0, microsecond=0)).days
    days_since_added = max(0, days_since_added)
    
    total_days_stored = days_already_stored + days_since_added
    remaining_days = int(round(adjusted_shelf_life - total_days_stored))
    
    warning = None
    if storage_location in ["outside", "countertop"]:
        warning = "Storing this item outside a fridge significantly reduces its shelf life. Consider refrigerating."
        
    # Check outside room temp rules
    if storage_location == "outside":
        if is_perishable:
            if total_days_stored <= 1:
                status = "use_immediately"
                remaining_days = min(remaining_days, 1)
            else:
                status = "expired"
                remaining_days = min(remaining_days, -1)
        else:
            if total_days_stored <= 2:
                status = "fresh"
            elif total_days_stored <= 4:
                status = "expiring_soon"
            else:
                status = "expired"
                remaining_days = min(remaining_days, -1)
    else:
        # Standard rules
        if remaining_days >= 5:
            status = "fresh"
        elif remaining_days >= 2:
            status = "expiring_soon"
        elif remaining_days >= 0:
            status = "use_immediately"
        else:
            status = "expired"
            
    return remaining_days, status, warning

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")
    
    contents = await file.read()
    
    try:
        detected_items, annotated_image = process_image(contents)
        return {
            "detected_items": detected_items,
            "annotated_image": f"data:image/jpeg;base64,{annotated_image}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.websocket("/ws/track")
async def websocket_track(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            if "," in data:
                data = data.split(",")[1]
            try:
                image_bytes = base64.b64decode(data)
                detected_items, annotated_image = process_image(image_bytes)
                await websocket.send_json({
                    "detected_items": detected_items,
                    "annotated_image": f"data:image/jpeg;base64,{annotated_image}"
                })
            except Exception as e:
                await websocket.send_json({"error": str(e)})
    except WebSocketDisconnect:
        print("Client disconnected from tracking WebSocket")

@app.post("/add-to-inventory")
async def add_to_inventory(item: InventoryItem):
    try:
        # Mapping
        storage_loc_encoded = STORAGE_LOC_MAP.get(item.storage_location.lower(), 0)
        climate_zone_encoded = CLIMATE_ZONE_MAP.get(item.climate_zone.lower(), 2)
        
        # Calculate shelf life
        adjusted_shelf_life = predict_expiry(
            food_type=item.item_name,
            storage_location=storage_loc_encoded,
            days_already_stored=item.days_already_stored,
            is_perishable=1 if item.is_perishable else 0,
            climate_zone=climate_zone_encoded
        )
        
        now = datetime.datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        effective_start_date = today - datetime.timedelta(days=item.days_already_stored)
        predicted_expiry_date = effective_start_date + datetime.timedelta(days=adjusted_shelf_life)
        
        # Dynamic status checking on entry
        remaining_days, status, warning = calculate_item_status(
            date_added=now,
            effective_start_date=effective_start_date,
            adjusted_shelf_life=adjusted_shelf_life,
            days_already_stored=item.days_already_stored,
            storage_location=item.storage_location.lower(),
            is_perishable=item.is_perishable,
            item_name=item.item_name
        )
        
        expired_on_entry = remaining_days <= 0
        
        doc = {
            "item_name": item.item_name,
            "quantity": item.quantity,
            "confidence": item.confidence_score,
            "storage_location": item.storage_location,
            "days_already_stored": item.days_already_stored,
            "is_perishable": item.is_perishable,
            "climate_zone": item.climate_zone,
            "date_added": now,
            "effective_start_date": effective_start_date,
            "adjusted_shelf_life": float(adjusted_shelf_life),
            "predicted_expiry_date": predicted_expiry_date,
            "expired_on_entry": expired_on_entry
        }
        
        items = load_items()

doc["id"] = len(items) + 1

# convert datetime objects to string before saving JSON
doc["date_added"] = now.isoformat()
doc["effective_start_date"] = effective_start_date.isoformat()
doc["predicted_expiry_date"] = predicted_expiry_date.isoformat()

items.append(doc)

save_items(items)

return {
    "item_id": str(doc["id"]),
    "effective_start_date": effective_start_date.isoformat(),
    "adjusted_shelf_life": float(adjusted_shelf_life),
    "predicted_expiry_date": predicted_expiry_date.isoformat(),
    "remaining_days": remaining_days,
    "status": status,
    "warning": warning
}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-inventory")
async def get_inventory():
    items = list(food_items_collection.find())
    serialized = []
    now_fallback = datetime.datetime.utcnow()
    
    for item in items:
        date_added = item.get("date_added", now_fallback)
        effective_start = item.get("effective_start_date", date_added)
        adjusted_life = item.get("adjusted_shelf_life", 5.0)
        already_stored = item.get("days_already_stored", 0)
        storage_loc = item.get("storage_location", "fridge")
        is_perish = item.get("is_perishable", False)
        name = item.get("item_name", "Unknown")
        
        remaining_days, status, warning = calculate_item_status(
            date_added=date_added,
            effective_start_date=effective_start,
            adjusted_shelf_life=adjusted_life,
            days_already_stored=already_stored,
            storage_location=storage_loc.lower(),
            is_perishable=is_perish,
            item_name=name
        )
        
        doc = serialize_doc(item)
        doc["storage_location"] = storage_loc
        doc["days_already_stored"] = already_stored
        doc["is_perishable"] = is_perish
        doc["adjusted_shelf_life"] = adjusted_life
        doc["remaining_days"] = remaining_days
        doc["status"] = status
        doc["warning"] = warning
        
        # Ensure dates are serialized nicely as ISO strings
        doc["date_added"] = date_added.isoformat() if isinstance(date_added, datetime.datetime) else str(date_added)
        doc["effective_start_date"] = effective_start.isoformat() if isinstance(effective_start, datetime.datetime) else str(effective_start)
        
        predicted_expiry = item.get("predicted_expiry_date", effective_start + datetime.timedelta(days=adjusted_life))
        doc["predicted_expiry_date"] = predicted_expiry.isoformat() if isinstance(predicted_expiry, datetime.datetime) else str(predicted_expiry)
        
        serialized.append(doc)
    return serialized

@app.get("/get-recipes")
async def get_recipes():
    items = list(food_items_collection.find())
    return suggest_recipes(items)

@app.get("/get-alerts")
async def get_alerts():
    items = list(food_items_collection.find())
    alerts = []
    now_fallback = datetime.datetime.utcnow()
    
    for item in items:
        date_added = item.get("date_added", now_fallback)
        effective_start = item.get("effective_start_date", date_added)
        adjusted_life = item.get("adjusted_shelf_life", 5.0)
        already_stored = item.get("days_already_stored", 0)
        storage_loc = item.get("storage_location", "fridge")
        is_perish = item.get("is_perishable", False)
        name = item.get("item_name", "Unknown")
        
        remaining_days, status, warning = calculate_item_status(
            date_added=date_added,
            effective_start_date=effective_start,
            adjusted_shelf_life=adjusted_life,
            days_already_stored=already_stored,
            storage_location=storage_loc.lower(),
            is_perishable=is_perish,
            item_name=name
        )
        
        # 1. Outside Storage Alert (immediate, regardless of days remaining)
        if storage_loc.lower() == "outside":
            alerts.append({
                "id": str(item["_id"]),
                "item_name": name,
                "days_remaining": remaining_days,
                "alert_type": "outside",
                "message": f"⚠️ {name} is stored outside. Its shelf life is significantly reduced. Please refrigerate or consume soon."
            })
            continue  # Don't duplicate alert
            
        # 2. Expired on Entry Alert
        if item.get("expired_on_entry", False):
            alerts.append({
                "id": str(item["_id"]),
                "item_name": name,
                "days_remaining": remaining_days,
                "alert_type": "expired_on_entry",
                "message": f"🚨 {name} was added but appears to already be expired based on storage duration."
            })
            continue

        # 3. Standard Alerts
        if remaining_days <= 2:
            alert_type = "red"
            message = f"🚨 {name} expires soon! Use immediately." if remaining_days >= 0 else f"⚫ {name} has expired."
            alerts.append({
                "id": str(item["_id"]),
                "item_name": name,
                "days_remaining": remaining_days,
                "alert_type": alert_type,
                "message": message
            })
        elif remaining_days <= 5:
            alert_type = "yellow"
            alerts.append({
                "id": str(item["_id"]),
                "item_name": name,
                "days_remaining": remaining_days,
                "alert_type": alert_type,
                "message": f"🟡 {name} is expiring soon."
            })
            
    return alerts

@app.post("/submit-feedback")
async def submit_feedback(feedback: Feedback):
    try:
        obj_id = ObjectId(feedback.item_id)
        item = food_items_collection.find_one({"_id": obj_id})
        
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        now = datetime.datetime.utcnow()
        
        # Fallback date added
        date_added = item.get("date_added", now)
        days_since_added = (now - date_added).days
        
        # Calculate actual shelf life to retrain ML model
        adjusted_life = item.get("adjusted_shelf_life", 5.0)
        already_stored = item.get("days_already_stored", 0)
        
        actual_shelf_life = adjusted_life
        if feedback.feedback_score == -1:
            actual_shelf_life = max(1.0, float(days_since_added + already_stored))
        elif feedback.feedback_score == 1:
            actual_shelf_life = float(adjusted_life + 3)
            
        # Append to CSV
        import csv
        storage_loc = item.get("storage_location", "fridge")
        climate_zone = item.get("climate_zone", "moderate")
        is_perish = item.get("is_perishable", False)
        name = item.get("item_name", "Unknown")
        
        storage_loc_encoded = STORAGE_LOC_MAP.get(storage_loc.lower(), 0)
        climate_zone_encoded = CLIMATE_ZONE_MAP.get(climate_zone.lower(), 2)
        
        with open("synthetic_feedback.csv", "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                name.lower(),
                storage_loc_encoded,
                already_stored,
                1 if is_perish else 0,
                climate_zone_encoded,
                feedback.feedback_score,
                actual_shelf_life
            ])
            
        # Retrain the ML model online
        train_model()
        
        # Save feedback in DB
        feedback_doc = {
            "item_id": feedback.item_id,
            "food_type": name,
            "storage_location": storage_loc,
            "days_already_stored": already_stored,
            "is_perishable": is_perish,
            "climate_zone": climate_zone,
            "user_feedback_score": feedback.feedback_score,
            "adjusted_expiry_days": actual_shelf_life,
            "timestamp": now
        }
        feedback_collection.insert_one(feedback_doc)
        
        return {"message": "Feedback submitted and ML model retrained successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/remove-item/{item_id}")
async def remove_item(item_id: str):
    try:
        result = food_items_collection.delete_one({"_id": ObjectId(item_id)})
        if result.deleted_count == 1:
            return {"message": "Item removed successfully."}
        else:
            raise HTTPException(status_code=404, detail="Item not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
