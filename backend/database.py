import json
import os
import uuid

DB_FILE = "inventory.json"


def load_items():
    if not os.path.exists(DB_FILE):
        return []

    with open(DB_FILE, "r") as file:
        return json.load(file)


def save_items(items):
    with open(DB_FILE, "w") as file:
        json.dump(items, file, default=str)


class SimpleCollection:
    def insert_one(self, doc):
        items = load_items()
        doc["_id"] = str(uuid.uuid4())
        items.append(doc)
        save_items(items)

        class Result:
            inserted_id = doc["_id"]

        return Result()

    def find(self):
        return load_items()

    def find_one(self, query):
        items = load_items()
        for item in items:
            if item.get("_id") == str(query["_id"]):
                return item
        return None

    def delete_one(self, query):
        items = load_items()
        before = len(items)

        items = [
            item for item in items
            if item.get("_id") != str(query["_id"])
        ]

        save_items(items)

        class Result:
            deleted_count = before - len(items)

        return Result()


food_items_collection = SimpleCollection()
feedback_collection = SimpleCollection()
users_collection = SimpleCollection()
predictions_collection = SimpleCollection()
