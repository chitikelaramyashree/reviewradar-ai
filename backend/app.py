from flask import Flask, request
from flask_cors import CORS
from model import search_and_summarize

app = Flask(__name__)
CORS(app)  # allow React to connect

@app.route("/search", methods=["POST"])
def search():
    data = request.json
    query = data["query"]

    result = search_and_summarize(query)

    return {"response": result}

if __name__ == "__main__":
    app.run(debug=True)