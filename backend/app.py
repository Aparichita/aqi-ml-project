import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import joblib
import json

app = Flask(__name__)
CORS(app)

MODEL_FILE = os.path.join(os.path.dirname(__file__), "..", "model", "model.pkl")
CLASSIFIER_FILE = os.path.join(os.path.dirname(__file__), "..", "model", "classifier.pkl")

# Load trained models
if not os.path.exists(MODEL_FILE):
    raise FileNotFoundError(f"Model file not found. Run model/train_model.py first. Expected: {MODEL_FILE}")

model = joblib.load(MODEL_FILE)
classifier = joblib.load(CLASSIFIER_FILE) if os.path.exists(CLASSIFIER_FILE) else None

def get_aqi_category(aqi_value):
    if aqi_value <= 50:
        return "Good"
    if aqi_value <= 100:
        return "Moderate"
    if aqi_value <= 200:
        return "Unhealthy"
    return "Hazardous"

def health_recommendation(category):
    return {
        "Good": "Safe for outdoor activities. No mask required. Enjoy normal activities.",
        "Moderate": "Sensitive groups (children, elderly, respiratory patients) should take precautions. Consider limiting prolonged outdoor exertion.",
        "Unhealthy": "Avoid outdoor activities. Wear a mask if going outside. Close windows to reduce indoor pollution.",
        "Hazardous": "Stay indoors, wear N95 mask if necessary. Avoid all outdoor activities. Use air purifiers if available."
    }.get(category, "No recommendation available")

@app.route("/predict", methods=["POST"])
def predict_aqi():
    data = request.get_json(force=True)
    required_fields = ["pm25", "pm10", "no2", "so2", "co"]

    if not data:
        return jsonify({"error": "Invalid JSON input"}), 400

    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    try:
        features = [
            float(data["pm25"]),
            float(data["pm10"]),
            float(data["no2"]),
            float(data["so2"]),
            float(data["co"])
        ]
    except ValueError:
        return jsonify({"error": "Input values must be numeric"}), 400

    prediction = model.predict([features])[0]
    predicted_aqi = float(round(prediction, 2))
    category = get_aqi_category(predicted_aqi)
    recommendation = health_recommendation(category)

    # Classification prediction
    classification_category = None
    if classifier:
        clf_pred = classifier.predict([features])[0]
        classification_category = clf_pred

    return jsonify({
        "predicted_aqi": predicted_aqi,
        "category": category,
        "classification_category": classification_category,
        "recommendation": recommendation
    })

@app.route("/metrics", methods=["GET"])
def get_metrics():
    metrics_file = os.path.join(os.path.dirname(__file__), "..", "model", "metrics.json")
    if not os.path.exists(metrics_file):
        return jsonify({"error": "Metrics file not found. Run model/train_model.py first."}), 404
    with open(metrics_file, "r") as f:
        metrics = json.load(f)
    return jsonify(metrics)

@app.route('/feature_importance.png')
def get_feature_image():
    return send_from_directory(os.path.join(os.path.dirname(__file__), "..", "model"), "feature_importance.png")

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "OK", "model": type(model).__name__})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
