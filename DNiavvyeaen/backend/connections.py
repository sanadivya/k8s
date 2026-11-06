from pymongo import MongoClient
from os import environ

MONGO_HOST = environ.get('MONGO_HOST', 'localhost')

client = MongoClient(MONGO_HOST, 27017)

db = client["DNiavvyeaen"]  

coll = db['names']