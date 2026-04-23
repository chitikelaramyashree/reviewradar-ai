from flask import Flask, request, jsonify
from flask_cors import CORS
from model import search_and_summarize
import os
import traceback

app = Flask(__name__)
CORS(app)


@app.route("/search", methods=["POST"])
def search():
    data = request.get_json(silent=True)

    if data is None:
        return jsonify({"error": "Request body must be valid JSON with Content-Type: application/json"}), 400

    query = data.get("query")

    if query is None:
        return jsonify({"error": "Missing required field: 'query'"}), 400

    if not isinstance(query, str) or not query.strip():
        return jsonify({"error": "Field 'query' must be a non-empty string"}), 400

    try:
        result = search_and_summarize(query.strip())
        return jsonify({"response": result})
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Search pipeline failed. Please try again."}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ready"})


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug)
