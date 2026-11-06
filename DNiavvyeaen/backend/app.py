from flask import Flask, render_template, jsonify
from connections import coll
import os

app = Flask(__name__)

PORT = os.environ.get('PORT', 8000)

@app.route('/')
def index():
    return jsonify({'message':'Backend is running'})

@app.route('/api/get')
def api():
    names = coll.find()
    result = []

    for name in names:
        result.append(name['value'])
    
    result = {
        'data' : result
    }
    return jsonify(result)

@app.route('/api/add/<name>')
def add(name):
    coll.insert_one({'value': name})
    return jsonify({'message': f'{name} Added'})

if(__name__ == "__main__"):
    app.run(debug=True, port=PORT, host='0.0.0.0')