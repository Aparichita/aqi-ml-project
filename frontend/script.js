const API_URL = "http://127.0.0.1:5000/predict";
const METRICS_URL = "http://127.0.0.1:5000/metrics";
const FALLBACK_API_URL = "/predict";
const FALLBACK_METRICS_URL = "/metrics";

let currentResult = null;
let aqiChart = null;
let form = null;
let loader = null;
let errorBox = null;
let aqiChartCtx = null;
let modelComparison = null;
let navTabs = [];

// Initialize in both normal and already-loaded states.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing app...");
    safeInitializeApp();
  });
} else {
  console.log("DOM already loaded, initializing app...");
  safeInitializeApp();
}

function safeInitializeApp() {
  try {
    initializeApp();
  } catch (err) {
    console.error("Fatal initialization error:", err);
    const fallbackError = document.getElementById("error");
    if (fallbackError) {
      fallbackError.innerHTML = "❌ Frontend initialization failed. Refresh the page once and try again.";
    }
  }
}

function initializeApp() {
  // Get all necessary DOM elements
  form = document.getElementById("aqiForm");
  loader = document.querySelector('#predict-screen .loader');
  errorBox = document.querySelector('#predict-screen .error-box');
  modelComparison = document.getElementById("modelComparison");
  navTabs = Array.from(document.querySelectorAll(".nav-tab"));
  
  // Get chart context
  const aqiChartCanvas = document.getElementById("aqiChart");
  if (aqiChartCanvas) {
    try {
      aqiChartCtx = aqiChartCanvas.getContext("2d");
    } catch (err) {
      console.error("Could not get chart context:", err);
    }
  }

  // Validate form exists
  if (!form) {
    console.error("❌ Form element not found!");
    return;
  }

  console.log("✓ All elements found");

  // Setup all event listeners
  setupNavigation();
  setupFormSubmission();
  fetchModelMetrics();
}

// ===== NAVIGATION =====
function setupNavigation() {
  console.log(`Found ${navTabs.length} nav tabs`);
  
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const screenId = tab.dataset.screen + '-screen';
      console.log(`Switching to screen: ${screenId}`);
      switchScreen(screenId);
    });
  });

  const activeTab = document.querySelector(".nav-tab.active");
  if (activeTab) {
    switchScreen(`${activeTab.dataset.screen}-screen`);
  } else {
    switchScreen("predict-screen");
  }
}

function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove("active");
  });
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add("active");
    const screenKey = screenId.replace("-screen", "");
    navTabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.screen === screenKey);
    });
    console.log(`✓ Switched to ${screenId}`);
  } else {
    console.error(`Screen not found: ${screenId}`);
  }
}

// ===== FORM SUBMISSION =====
function setupFormSubmission() {
  if (!form) {
    console.error("Form is null, cannot setup submission");
    return;
  }
  
  form.addEventListener("submit", handleFormSubmit);
  const predictBtn = document.getElementById("predictBtn");
  if (predictBtn) {
    predictBtn.addEventListener("click", (event) => {
      // Ensure button click always triggers the same path.
      if (event.target && form) {
        form.requestSubmit();
      }
    });
  }
  console.log("✓ Form submission handler attached");
}

async function handleFormSubmit(event) {
  event.preventDefault();
  console.log("Form submitted");

  if (!loader || !errorBox) {
    console.error("Loader or errorBox not found!");
    return;
  }

  clearMessages();
  loader.style.display = "flex";

  const pm25 = document.getElementById("pm25").value;
  const pm10 = document.getElementById("pm10").value;
  const no2 = document.getElementById("no2").value;
  const so2 = document.getElementById("so2").value;
  const co = document.getElementById("co").value;

  console.log("Sending prediction:", { pm25, pm10, no2, so2, co });

  const payload = {
    pm25: parseFloat(pm25),
    pm10: parseFloat(pm10),
    no2: parseFloat(no2),
    so2: parseFloat(so2),
    co: parseFloat(co)
  };

  try {
    const response = await postPredictionWithFallback(payload);
    console.log("Response status:", response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `HTTP ${response.status}` };
      }
      throw new Error(errorData.error || `HTTP ${response.status}: Prediction failed`);
    }

    const data = await response.json();
    console.log("✓ Got prediction:", data);
    
    currentResult = data;
    displayResults(data);
    updateAqiChart(data.predicted_aqi);
    
    switchScreen('results-screen');
  } catch (err) {
    console.error("❌ Error:", err);
    errorBox.innerHTML = `❌ ${err.message}. Make sure backend is running on port 5000.`;
  } finally {
    loader.style.display = "none";
  }
}

async function postPredictionWithFallback(payload) {
  try {
    console.log("Fetching from:", API_URL);
    return await fetch(API_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (networkError) {
    console.warn("Primary API failed, trying fallback:", networkError);
    return fetch(FALLBACK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }
}

function clearMessages() {
  if (errorBox) {
    errorBox.innerHTML = "";
  }
}

// ===== RESULTS DISPLAY =====
const getCategoryColor = (category) => {
  switch (category) {
    case "Good": return "#00ff88";
    case "Moderate": return "#ffaa00";
    case "Unhealthy": return "#ff6b35";
    case "Hazardous": return "#ff0000";
    default: return "#888888";
  }
};

function displayResults(data) {
  const resultContent = document.getElementById('result-content');
  const noResults = document.getElementById('no-results');
  const resultBox = document.getElementById('result');
  const healthStatus = document.getElementById('health-status');
  
  if (!resultContent || !resultBox || !healthStatus) {
    console.error("Result elements not found!");
    return;
  }

  const regColor = getCategoryColor(data.category);
  const clfColor = data.classification_category ? getCategoryColor(data.classification_category) : null;

  let resultHtml = `
    <div style="margin-bottom: 16px;">
      <strong style="font-size: 1.4rem;">Predicted AQI: <span style="color: ${regColor};">${data.predicted_aqi}</span></strong>
    </div>
    <div style="margin-bottom: 12px;">
      <strong>Category:</strong> <span style="color: ${regColor}; font-weight: bold;">${data.category}</span>
    </div>
  `;

  if (data.classification_category) {
    resultHtml += `<div style="margin-bottom: 12px;">
      <strong>Classification:</strong> <span style="color: ${clfColor}; font-weight: bold;">${data.classification_category}</span>
    </div>`;
  }

  resultBox.innerHTML = resultHtml;
  healthStatus.innerHTML = `
    <div class="status-section">
      <strong>💡 Health Recommendation</strong>
      <p>${data.recommendation}</p>
    </div>
  `;

  resultContent.style.display = 'block';
  if (noResults) {
    noResults.style.display = 'none';
  }
}

// ===== CHART =====
function getAQICategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 200) return "Unhealthy";
  return "Hazardous";
}

function updateAqiChart(aqiValue) {
  if (!aqiChartCtx) {
    console.error("Chart context not available!");
    return;
  }

  const labels = ["Your AQI"];
  const values = [aqiValue];
  const maxValue = Math.max(aqiValue, 300);

  if (aqiChart) {
    aqiChart.data.labels = labels;
    aqiChart.data.datasets[0].data = values;
    aqiChart.options.scales.y.max = maxValue;
    aqiChart.update();
    console.log("✓ Chart updated");
    return;
  }

  try {
    aqiChart = new Chart(aqiChartCtx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "AQI Value",
            data: values,
            backgroundColor: getCategoryColor(getAQICategory(aqiValue)),
            borderRadius: 12,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            max: maxValue,
            ticks: { color: '#a8b5cc' },
            grid: { color: 'rgba(0, 212, 255, 0.08)' }
          },
          x: {
            ticks: { color: '#a8b5cc' }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
    console.log("✓ Chart created");
  } catch (err) {
    console.error("Chart creation error:", err);
  }
}

// ===== METRICS =====
async function fetchModelMetrics() {
  if (!modelComparison) {
    console.error("Model comparison element not found!");
    return;
  }

  console.log("Fetching metrics from:", METRICS_URL);
  modelComparison.innerHTML = "Loading model metrics...";

  try {
      const metricsResponse = await fetchMetricsWithFallback();
      console.log("Metrics response status:", metricsResponse.status);
      if (!metricsResponse.ok) {
        throw new Error(`HTTP ${metricsResponse.status}`);
      }
      const metrics = await metricsResponse.json();
      console.log("✓ Got metrics:", metrics);
      
      const metricsHtml = `
        <div class="metric-card">
          <strong>🔵 Linear Regression</strong><br>
          R²: <span style="color: var(--accent)">${metrics.linear_regression.r2.toFixed(4)}</span> | MSE: ${metrics.linear_regression.mse.toFixed(4)}
        </div>
        <div class="metric-card">
          <strong>🌳 Random Forest</strong><br>
          R²: <span style="color: var(--accent)">${metrics.random_forest.r2.toFixed(4)}</span> | MSE: ${metrics.random_forest.mse.toFixed(4)}
        </div>
        ${metrics.gradient_boosting ? `<div class="metric-card">
          <strong>⚡ Gradient Boosting</strong><br>
          R²: <span style="color: var(--accent)">${metrics.gradient_boosting.r2.toFixed(4)}</span> | MSE: ${metrics.gradient_boosting.mse.toFixed(4)}
        </div>` : ''}
        <div class="metric-card" style="background: rgba(0, 255, 136, 0.12); border-color: rgba(0, 255, 136, 0.2);">
          <strong style="color: var(--accent-2);">✅ Best Model: ${metrics.best_model}</strong><br>
          R²: <span style="color: var(--accent-2);">${metrics.best_r2?.toFixed(4)}</span>
        </div>
        ${metrics.classification ? `<div class="metric-card">
          <strong>🏥 Classification (Logistic Regression)</strong><br>
          Accuracy: <span style="color: var(--accent)">${metrics.classification.accuracy.toFixed(4)}</span> (${(metrics.classification.accuracy * 100).toFixed(1)}%)
        </div>` : ''}
      `;
      modelComparison.innerHTML = metricsHtml;
      
      const featureImg = document.getElementById('featureImg');
      const featureLoader = document.getElementById('feature-loader');
      if (featureImg) featureImg.style.display = 'block';
      if (featureLoader) featureLoader.style.display = 'none';
      console.log("✓ Metrics displayed");
    } catch (err) {
      console.error("Metrics fetch error:", err);
      modelComparison.innerHTML = `⚠️ Analytics unavailable. Start backend with:<br><code>python backend/app.py</code>`;
      const featureLoader = document.getElementById("feature-loader");
      if (featureLoader) {
        featureLoader.style.display = "none";
      }
    }
}

async function fetchMetricsWithFallback() {
  try {
    return await fetch(METRICS_URL);
  } catch (networkError) {
    console.warn("Primary metrics endpoint failed, trying fallback:", networkError);
    return fetch(FALLBACK_METRICS_URL);
  }
}
