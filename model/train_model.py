import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_squared_error, accuracy_score, classification_report
import joblib
import matplotlib.pyplot as plt

# File paths
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "dataset", "city_day.csv")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
CLASSIFIER_PATH = os.path.join(os.path.dirname(__file__), "classifier.pkl")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "metrics.json")
FEATURE_IMPORTANCE_PLOT = os.path.join(os.path.dirname(__file__), "feature_importance.png")

# Required columns
FEATURES = ["PM2.5", "PM10", "NO2", "SO2", "CO"]
TARGET = "AQI"

# Make sure the dataset exists. If not, create a synthetic sample for a working demo.
if not os.path.exists(DATASET_PATH):
    print(f"Dataset not found at {DATASET_PATH}. Creating synthetic sample dataset for demo.")
    np.random.seed(42)
    n = 500
    df = pd.DataFrame({
        "PM2.5": np.random.uniform(10, 200, n),
        "PM10": np.random.uniform(20, 300, n),
        "NO2": np.random.uniform(10, 150, n),
        "SO2": np.random.uniform(2, 80, n),
        "CO": np.random.uniform(0.3, 5.0, n)
    })
    df[TARGET] = (
        0.4 * df["PM2.5"]
        + 0.25 * df["PM10"]
        + 0.2 * df["NO2"]
        + 0.1 * df["SO2"]
        + 5 * df["CO"]
        + np.random.normal(0, 10, n)
    )
    os.makedirs(os.path.dirname(DATASET_PATH), exist_ok=True)
    df.to_csv(DATASET_PATH, index=False)
    print(f"Synthetic dataset created at {DATASET_PATH}.\n")

# Load data
print("Loading dataset...")
df = pd.read_csv(DATASET_PATH)
print(f"Original rows: {len(df)}")

# Keep only required columns and drop duplicates
required_cols = FEATURES + [TARGET]
df = df[FEATURES + [TARGET]]
df = df.dropna()
print(f"Rows after removing missing values: {len(df)}")

# Fill missing if any
for col in FEATURES + [TARGET]:
    if df[col].isna().sum() > 0:
        df[col] = df[col].fillna(df[col].mean())

# Create category for classification
def get_category(aqi):
    if aqi <= 50:
        return "Good"
    elif aqi <= 100:
        return "Moderate"
    elif aqi <= 200:
        return "Unhealthy"
    else:
        return "Hazardous"

df["Category"] = df[TARGET].apply(get_category)

# Features and targets
X = df[FEATURES]
y_reg = df[TARGET]  # for regression
y_clf = df["Category"]  # for classification

# Train-test split 80-20
X_train, X_test, y_reg_train, y_reg_test, y_clf_train, y_clf_test = train_test_split(
    X, y_reg, y_clf, test_size=0.2, random_state=42
)
print(f"Training rows: {len(X_train)}, Testing rows: {len(X_test)}")

# Model 1: Linear Regression
lr = LinearRegression()
lr.fit(X_train, y_reg_train)
y_pred_lr = lr.predict(X_test)

r2_lr = r2_score(y_reg_test, y_pred_lr)
mse_lr = mean_squared_error(y_reg_test, y_pred_lr)

# Model 2: Random Forest Regressor
rf = RandomForestRegressor(n_estimators=100, random_state=42)
rf.fit(X_train, y_reg_train)
y_pred_rf = rf.predict(X_test)

r2_rf = r2_score(y_reg_test, y_pred_rf)
mse_rf = mean_squared_error(y_reg_test, y_pred_rf)

# Model 3: Gradient Boosting Regressor (Advanced)
gb = GradientBoostingRegressor(n_estimators=200, learning_rate=0.1, max_depth=5, random_state=42)
gb.fit(X_train, y_reg_train)
y_pred_gb = gb.predict(X_test)

r2_gb = r2_score(y_reg_test, y_pred_gb)
mse_gb = mean_squared_error(y_reg_test, y_pred_gb)

print("\nModel comparison:")
print(f"Linear Regression   -> R2: {r2_lr:.4f}, MSE: {mse_lr:.4f}")
print(f"Random Forest       -> R2: {r2_rf:.4f}, MSE: {mse_rf:.4f}")
print(f"Gradient Boosting   -> R2: {r2_gb:.4f}, MSE: {mse_gb:.4f}")

# Pick best model (by R2 score)
models = [("LinearRegression", r2_lr, mse_lr, lr), ("RandomForest", r2_rf, mse_rf, rf), ("GradientBoosting", r2_gb, mse_gb, gb)]
best_name, best_r2, best_mse, best_model = max(models, key=lambda x: x[1])
print(f"\nBest model chosen: {best_name} (R2: {best_r2:.4f})")

# Classification: Logistic Regression for AQI Category
clf = LogisticRegression(random_state=42, max_iter=1000)
clf.fit(X_train, y_clf_train)
y_clf_pred = clf.predict(X_test)

accuracy_clf = accuracy_score(y_clf_test, y_clf_pred)
print(f"\nClassification Model:")
print(f"Logistic Regression -> Accuracy: {accuracy_clf:.4f}")
print("Classification Report:")
print(classification_report(y_clf_test, y_clf_pred))

# Save best model
joblib.dump(best_model, MODEL_PATH)
print(f"Best regression model saved to {MODEL_PATH}")

# Save classifier
joblib.dump(clf, CLASSIFIER_PATH)
print(f"Classifier saved to {CLASSIFIER_PATH}")

# Save metrics for frontend readout
metrics = {
    "linear_regression": {"r2": float(r2_lr), "mse": float(mse_lr)},
    "random_forest": {"r2": float(r2_rf), "mse": float(mse_rf)},
    "gradient_boosting": {"r2": float(r2_gb), "mse": float(mse_gb)},
    "best_model": best_name,
    "best_r2": float(best_r2),
    "classification": {
        "accuracy": float(accuracy_clf),
        "model": "LogisticRegression"
    },
    "feature_importance": {
        feature: float(imp)
        for feature, imp in zip(FEATURES, rf.feature_importances_)
    }
}
with open(METRICS_PATH, "w") as f:
    json.dump(metrics, f, indent=2)
print(f"Metrics saved to {METRICS_PATH}")

# Feature importance plot for Random Forest
try:
    importances = rf.feature_importances_
    plt.figure(figsize=(8, 5))
    plt.bar(FEATURES, importances, color="tab:blue")
    plt.title("Random Forest Feature Importance")
    plt.ylabel("Importance")
    plt.tight_layout()
    plt.savefig(FEATURE_IMPORTANCE_PLOT)
    print(f"Feature importance plot saved to {FEATURE_IMPORTANCE_PLOT}")
except Exception as e:
    print("Could not generate feature importance plot:", e)

print("\nDone. You can now run this script with: python model/train_model.py")
