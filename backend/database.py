import json
import os

DB_FILE = "inventory.json"


def load_inventory():
    if not os.path.exists(DB_FILE):
        return []

    with open(DB_FILE, "r") as file:
        return json.load(file)


def save_inventory(items):
    with open(DB_FILE, "w") as file:
        json.dump(items, file)


def add_item(item):
    items = load_inventory()
    items.append(item)
    save_inventory(items)


def get_items():
    return load_inventory()


def remove_item(item_id):
    items = load_inventory()
    items = [item for item in items if item.get("id") != item_id]
    save_inventory(items)


# keep these so other files don't break
users_collection = []
food_items_collection = []
predictions_collection = []
feedback_collection = []
