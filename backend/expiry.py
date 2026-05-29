import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import os

# Base rule-based shelf life defaults (in days)
SHELF_LIFE_RULES = {
    "milk": 5,
    "bread": 7,
    "eggs": 21,
    "apple": 14,
    "banana": 5,
    "carrot": 14,
    "broccoli": 5,
    "orange": 21,
    "pizza": 3,
    "sandwich": 2,
    "cake": 4,
    "donut": 2,
    "hot dog": 3,
    "meat": 4,
    "fish": 3,
    "cooked food": 4
}

STORAGE_LOC_MAP = {
    "fridge": 0,
    "freezer": 1,
    "pantry": 2,
    "countertop": 3,
    "outside": 4
}

CLIMATE_ZONE_MAP = {
    "hot": 1,
    "moderate": 2,
    "cold": 3
}

STORAGE_MULTIPLIERS = {
    0: 1.0,  # Fridge
    1: 3.0,  # Freezer
    2: 0.8,  # Pantry
    3: 0.6,  # Countertop
    4: 0.4   # Outside
}

DATASET_PATH = "synthetic_feedback.csv"

def generate_synthetic_data():
    # If file exists, check columns
    if os.path.exists(DATASET_PATH):
        try:
            df = pd.read_csv(DATASET_PATH)
            if "storage_location" in df.columns and "climate_zone" in df.columns:
                return  # Columns match
        except Exception:
            pass
            
    # Write new or regenerated dataset
    data = {
        "food_type": ["apple", "banana", "pizza", "apple", "carrot", "broccoli", "sandwich", "donut", "milk", "meat"],
        "storage_location": [0, 3, 0, 0, 2, 0, 0, 2, 4, 0], # 0=fridge, 2=pantry, 3=countertop, 4=outside
        "days_already_stored": [1, 2, 1, 0, 3, 1, 1, 1, 1, 0],
        "is_perishable": [0, 0, 1, 0, 0, 0, 1, 0, 1, 1],
        "climate_zone": [2, 2, 2, 1, 2, 3, 2, 2, 1, 2], # 1=hot, 2=mod, 3=cold
        "user_feedback_score": [0, -1, 1, -2, 0, -1, 0, 1, -1, 0], # -1=early, 0=normal, 1=extra
        "adjusted_expiry_days": [14, 2, 4, 10, 8, 4, 2, 2, 1, 4] # target variable (adjusted shelf life)
    }
    df = pd.DataFrame(data)
    df.to_csv(DATASET_PATH, index=False)

generate_synthetic_data()

# Initialize ML Model
rf_model = RandomForestRegressor(n_estimators=50, random_state=42)
label_encoder = LabelEncoder()

# Fit initial label encoder on known classes
known_classes = list(SHELF_LIFE_RULES.keys())
label_encoder.fit(known_classes)

def train_model():
    """Train the model on accumulated feedback data."""
    if os.path.exists(DATASET_PATH):
        try:
            df = pd.read_csv(DATASET_PATH)
            
            # Handle unseen labels by adding them to classes
            unseen = set(df['food_type'].str.lower()) - set(label_encoder.classes_)
            if unseen:
                label_encoder.classes_ = np.append(label_encoder.classes_, list(unseen))
                
            df['food_type_encoded'] = label_encoder.transform(df['food_type'].str.lower())
            
            features = ['food_type_encoded', 'storage_location', 'days_already_stored', 'is_perishable', 'climate_zone', 'user_feedback_score']
            X = df[features]
            y = df['adjusted_expiry_days']
            
            rf_model.fit(X, y)
            print("Model retrained successfully with features:", features)
        except Exception as e:
            print(f"Failed to train model: {e}")

train_model()

def predict_expiry(
    food_type: str, 
    storage_location: int = 0, 
    days_already_stored: int = 0, 
    is_perishable: int = 0, 
    climate_zone: int = 2, 
    feedback_score: int = 0
) -> float:
    """
    Hybrid expiry prediction.
    Calculates rule-based shelf life with storage multiplier and refines it with ML.
    Returns predicted total shelf life in days.
    """
    food_type_lower = food_type.lower()
    base_days = SHELF_LIFE_RULES.get(food_type_lower, 5) # default to 5 if unknown
    
    # Calculate rule-based shelf life
    storage_mult = STORAGE_MULTIPLIERS.get(storage_location, 1.0)
    rule_shelf_life = base_days * storage_mult
    
    try:
        # ML prediction
        if food_type_lower in label_encoder.classes_:
            encoded_food = label_encoder.transform([food_type_lower])[0]
            X_new = pd.DataFrame(
                [[encoded_food, storage_location, days_already_stored, is_perishable, climate_zone, feedback_score]], 
                columns=['food_type_encoded', 'storage_location', 'days_already_stored', 'is_perishable', 'climate_zone', 'user_feedback_score']
            )
            ml_prediction = rf_model.predict(X_new)[0]
            
            # Weighted average: 60% rule-based, 40% ML output
            final_prediction = 0.6 * rule_shelf_life + 0.4 * ml_prediction
            return max(1.0, float(final_prediction))
    except Exception as e:
        print(f"ML prediction failed: {e}")
        
    return max(1.0, float(rule_shelf_life))
