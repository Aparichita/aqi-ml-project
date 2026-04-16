const API_URL = "http://127.0.0.1:5000/predict";
const METRICS_URL = "http://127.0.0.1:5000/metrics";

const form = document.getElementById("aqiForm");
const loader = document.getElementById("loader");
const resultBox = document.getElementById("result");
const errorBox = document.getElementById("error");
const modelComparison = document.getElementById("modelComparison");

const aqiChartCtx = document.getElementById("aqiChart").getContext("2d");

let aqiChart = null;

const showLoader = (show) => {
  loader.style.display = show ? "block" : "none";
};

const clearMessages = () => {
  resultBox.innerHTML = "";
  errorBox.innerHTML = "";
};

const getCategoryColor = (category) => {
  switch (category) {
    case "Good": return "#22c55e"; // green
    case "Moderate": return "#eab308"; // yellow
    case "Unhealthy": return "#ef4444"; // red
    case "Hazardous": return "#dc2626"; // darker red
    default: return "#6b7280"; // gray
  }
};

const displayResult = (data) => {
  const regColor = getCategoryColor(data.category);
  const clfColor = data.classification_category ? getCategoryColor(data.classification_category) : null;

  let result = `Predicted AQI: <strong>${data.predicted_aqi}</strong><br>`;
  result += `Category (Regression): <strong style="color: ${regColor};">${data.category}</strong><br>`;
  if (data.classification_category) {
    result += `Category (Classification): <strong style="color: ${clfColor};">${data.classification_category}</strong><br>`;
  }
  result += `Health Suggestion: <strong>${data.recommendation}</strong>`;
  resultBox.innerHTML = result;
};

const displayError = (message) => {
  errorBox.innerText = message;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  clearMessages();
  showLoader(true);

  const payload = {
    pm25: parseFloat(document.getElementById("pm25").value),
    pm10: parseFloat(document.getElementById("pm10").value),
    no2: parseFloat(document.getElementById("no2").value),
    so2: parseFloat(document.getElementById("so2").value),
    co: parseFloat(document.getElementById("co").value)
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Prediction failed");
    }

    const data = await response.json();
    displayResult(data);

    updateAqiChart(data.predicted_aqi);
  } catch (err) {
    displayError(err.message);
  } finally {
    showLoader(false);
  }
});

const updateAqiChart = (aqiValue) => {
  const labels = ["Predicted AQI"];
  const values = [aqiValue];

  if (aqiChart) {
    aqiChart.data.labels = labels;
    aqiChart.data.datasets[0].data = values;
    aqiChart.update();
    return;
  }

  aqiChart = new Chart(aqiChartCtx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "AQI", data: values, backgroundColor: "rgba(59, 130, 246, 0.7)"
        }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
};

const fetchModelMetrics = async () => {
  try {
    const response = await fetch(METRICS_URL);
    if (!response.ok) throw new Error("The metrics endpoint could not be loaded.");

    const metrics = await response.json();

    modelComparison.innerHTML =
      `<strong>Linear Regression</strong> -> R²: <span style="color: #3b82f6;">${metrics.linear_regression.r2.toFixed(4)}</span>, MSE: <span style="color: #ef4444;">${metrics.linear_regression.mse.toFixed(4)}</span><br>` +
      `<strong>Random Forest</strong> -> R²: <span style="color: #3b82f6;">${metrics.random_forest.r2.toFixed(4)}</span>, MSE: <span style="color: #ef4444;">${metrics.random_forest.mse.toFixed(4)}</span><br>` +
      (metrics.gradient_boosting ? `<strong>Gradient Boosting</strong> -> R²: <span style="color: #3b82f6;">${metrics.gradient_boosting.r2.toFixed(4)}</span>, MSE: <span style="color: #ef4444;">${metrics.gradient_boosting.mse.toFixed(4)}</span><br>` : "") +
      `<strong>Best Model:</strong> <span style="color: #22c55e;">${metrics.best_model}</span> (R²: <span style="color: #10b981;">${metrics.best_r2.toFixed(4)}</span>)<br>` +
      (metrics.classification ? `<strong>Classification (Logistic Regression)</strong> -> Accuracy: <span style="color: #eab308;">${metrics.classification.accuracy.toFixed(4)}</span>` : "");

    // Show the feature importance image
    document.getElementById("featureImg").style.display = "block";
  } catch (err) {
    modelComparison.innerText = "Model metrics not available yet. Run training script first.";
  }
};

const init = () => {
  fetchModelMetrics();
};

init();
