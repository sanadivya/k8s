from flask import Flask, render_template
import os
import requests

app = Flask(__name__)

PORT = os.environ.get('PORT', 9000)

BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8000')

@app.route('/')
def index():
    response = requests.get(f'{BACKEND_URL}/api/get')
    print("Status:", response.status_code)
    print("Content-Type:", response.headers.get("Content-Type"))
    print("Response body:", response.text)
    
    data = response.json()
    print(data)

    env = dict(os.environ)
    return render_template('index.html', data = data['data'], env = env)

if(__name__ == "__main__"):
    app.run(debug=True, port=PORT, host='0.0.0.0')