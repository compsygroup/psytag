import json
import os
#import unqlite
from pymongo import MongoClient
from bson import ObjectId

class DatabaseManager:
    def __init__(self):
        with open("config/db.json", "r") as f:
            config = json.load(f)
        self.client = MongoClient(config["db_uri"])
        self.db = self.client[config["db_name"]]

    def is_duplicate(self, collection, data, ignore_fields=[]):
        ignore_fields = ignore_fields + ["__id", "_id", "id"]
        entry_dict = data.copy()
        for field in ignore_fields:
            entry_dict.pop(field, None)
        
        result = self.db[collection].find_one(entry_dict)
        if result is None:
            return False
        else:
            return str(result["_id"]) # Convert ObjectId to string before returning

    def getCollection(self, collection):
        return self.db[collection]
    
    def IDcorrect(self, data, reverse=False):
        if reverse:
            if "_id" in data:
                if data["_id"] is not None:
                    data["id"] = str(data.pop("_id"))
                else:
                    data.pop("_id", None)
        else:
            if "id" in data:
                if ObjectId.is_valid(data["id"]):
                    data["_id"] = ObjectId(data.pop("id"))
                else:
                    data.pop("id", None)
        return data

    def create(self, collection, data, ignore_fields=[]):
        col = self.getCollection(collection)

        data = self.IDcorrect(data)

        existing_id = self.is_duplicate(collection, data, ignore_fields)
        if  existing_id == False:
            result = col.insert_one(data)
            return str(result.inserted_id)  # Convert ObjectId to string before returning
        else:
            return existing_id

    def read(self, collection, id):
        col = self.getCollection(collection)
        if ObjectId.is_valid(id):
            result = col.find_one({"_id": ObjectId(id)})
        else:
            result = None

        if result:
            result = self.IDcorrect(result, reverse=True)
            return result
        
        return None

    def update(self, collection, id, new_data):
        col = self.getCollection(collection)

        new_data = self.IDcorrect(new_data)

        if ObjectId.is_valid(id):
            col.update_one({"_id": ObjectId(id)}, {"$set": new_data})

    def delete(self, collection, condition):
        col = self.getCollection(collection)
        col.delete_one(condition)

    def all(self, collection, query={}, projection={}):
        col = self.getCollection(collection)
        data_all = list(col.find(query, projection))

        for i, data in enumerate(data_all):
            data_all[i] = self.IDcorrect(data, reverse=True)
            
        return data_all
              

# initialize dbManager if config file exists
if os.path.isfile("config/db.json"):
    dbManager = DatabaseManager()


def get_dbManager():
    if "dbManager" in globals():
        global dbManager
    else:
        print("Database not set, creating new instance")
        dbManager = DatabaseManager()
    
    return dbManager


class dbClass:
    def set_collection(self, collection):
        self._collection = collection
        
    def get_collection(self):
        dbManager = get_dbManager()
        
        return dbManager.getCollection(self._collection)
        
    def create(self):        
        dbManager = get_dbManager()
            
        if not self._collection:
            raise ValueError("Collection not set")
        
        # Convert data to a dict and remove fields starting with '_'
        data = self.model_dump()
        for field in [attr for attr in dir(self) if attr.startswith("_")]:
            data.pop(field, None)
            
        id = dbManager.create(self._collection, data, self._ignore_fields)
        
        self.id = id
    
    @classmethod
    def read(cls, id):
        if cls is dbClass:
            raise Exception("read() must be called from a subclass, not directly on dbClass")
        
        dbManager = get_dbManager()
        
        if not hasattr(cls, "_collection") or not cls._collection.default:
            raise ValueError("Collection not set")
        
        data = dbManager.read(cls._collection.default, id)
        if data:
            valid_keys = set(cls.__fields__.keys())
            filtered_data = {k: v for k, v in data.items() if (k in valid_keys) and (v is not None)}
            return cls(**filtered_data)
        else:
            return None

    def update(self):
        dbManager = get_dbManager()
            
        if not self._collection:
            raise ValueError("Collection not set")
        
        # Convert data to a dict and remove fields starting with '_'
        new_data = self.model_dump()
        for field in [attr for attr in dir(self) if attr.startswith("_")]:
            new_data.pop(field, None)
        
        dbManager.update(self._collection, self.id, new_data)

    def delete(self):
        dbManager = get_dbManager()
            
        if not self._collection:
            raise ValueError("Collection not set")

        dbManager.delete(self._collection, {"_id": ObjectId(self.id)})

    @classmethod
    def all(cls, query={}, projection={}):
        if cls is dbClass:
            raise Exception("read() must be called from a subclass, not directly on dbClass")
        
        dbManager = get_dbManager()
        
        if not hasattr(cls, "_collection") or not cls._collection.default:
            raise ValueError("Collection not set")
        
        data = dbManager.all(cls._collection.default, query, projection)
        
        return data
    
    def exists(self, fullCheck=False):
        dbManager = get_dbManager()
            
        if not self._collection:
            raise ValueError("Collection not set")
        
        # Convert data to a dict and remove fields starting with '_'
        data = self.model_dump()
        for field in [attr for attr in dir(self) if attr.startswith("_")]:
            data.pop(field, None)
        
        if fullCheck:
            return dbManager.is_duplicate(self._collection, data, [])
        else:
            return dbManager.is_duplicate(self._collection, data, self._ignore_fields)
        
        
        
""" class DatabaseManager:
    def __init__(self):
        with open('config/database.json', "r") as f:
            config = json.load(f)
        self.db = unqlite.UnQLite(config["db_file"])
        
    def is_duplicate(self, collection, data, ignore_fields=[]):
        ignore_fields = ignore_fields + ['__id'] + ['_id'] + ['id']
        # remove ignored fields from data
        entry_dict = data.copy()
        for field in ignore_fields:
            entry_dict.pop(field, None)
        
        # Search for duplicates
        for existing in collection.all():
            existing_filtered = {k: v for k, v in existing.items() if k not in ignore_fields}
            if existing_filtered == entry_dict:
                return True  # Duplicate found

        return False  # No duplicate found
    
    def getCollection(self, collection):
        col = self.db.collection(collection)
        if not col.exists():
            col.create()
        return col

    def create(self, collection, data, ignore_fields=[]):
        with self.db.transaction():
            col = self.getCollection(collection)
                
            if "id" in data:
                if not data["id"] is None:
                    data["__id"] = data.pop("id")
                
            if not self.is_duplicate(col, data, ignore_fields):
                col.store(data)

    def read(self, collection, id):
        col = self.getCollection(collection)
            
        result = col.filter(lambda x: x.get("__id") == id)

        if result:
            data = result[0]
            if "__id" in data:
                data["id"] = data.pop("__id")
            return data

        return None  # If no record found
            
    def update(self, collection, id, new_data):
        with self.db.transaction():
            col = self.getCollection(collection)
                
            if "id" in new_data:
                if not new_data["id"] is None:
                    new_data["__id"] = new_data.pop("id")
                
            existing = col.filter(lambda x: x.get("__id") == id)
            if existing:
                updated_data = {**existing[0], **new_data}
                col.update(lambda x: x.get("__id") == id, updated_data)

    def delete(self, collection, condition):
        with self.db.transaction():
            col = self.getCollection(collection)
            col.delete(condition)
            
    def all(self, collection):
        col = self.getCollection(collection)
            
        data_all = col.all()
        
        for data in data_all:
            if "__id" in data:
                data["id"] = data.pop("__id")
            
        return data_all """