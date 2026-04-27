import { useState } from "react";
import { parseSummary } from "../utils/parser";
import ResultCard from "./ResultCard";
import SummaryCard from "./SummaryCard";

function AnalyzerPage({ onBack }) {
  const [queryInput, setQueryInput] = useState("");
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadOk, setUploadOk] = useState(false);
  const [datasetReady, setDatasetReady] = useState(false);

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");

  const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setUploadMessage("");
    setUploadOk(false);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    setUploadMessage("");
    setUploadOk(false);
    setDatasetReady(false);
    setProducts([]);
    setSelectedProduct("");
    setResults(null);
    setSearchError("");

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await fetch(`${apiBase}/upload`, { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadMessage(data.detail || "Upload failed. Please check your CSV.");
        setUploadOk(false);
        return;
      }

      setUploadMessage(`Dataset ready — ${data.review_count} reviews indexed.`);
      setUploadOk(true);
      setDatasetReady(true);
      setProducts(data.products || []);
    } catch {
      setUploadMessage("Could not reach the backend. Is the server running?");
      setUploadOk(false);
    } finally {
      setIsUploading(false);
    }
  };

  const sendQuery = async () => {
    if (!queryInput.trim() || !datasetReady) return;
    setIsLoading(true);
    setResults(null);
    setSearchError("");

    const payload = { query: queryInput.trim() };
    if (selectedProduct) payload.product_name = selectedProduct;

    try {
      const res = await fetch(`${apiBase}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        // detail may be a string or { error: "..." } object
        const msg =
          typeof data.detail === "object"
            ? data.detail.error || "An error occurred."
            : data.detail || data.error || "An error occurred.";
        setSearchError(msg);
        return;
      }

      setResults({
        query: queryInput.trim(),
        reviews: data.reviews || [],
        summary: parseSummary(data.summary || ""),
        analytics: data.analytics || null,
      });
    } catch {
      setSearchError("Failed to connect to the backend. Is the server running?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") sendQuery();
  };

  const clearResults = () => {
    setQueryInput("");
    setResults(null);
    setSearchError("");
  };

  const { analytics } = results || {};

  return (
    <div className="app-container">
      <header className="header">
        <button className="back-button" onClick={onBack}>
          ← Home
        </button>
        <div className="header-titles">
          <h1>ReviewRadar AI</h1>
          <p className="subtitle">AI-Powered Review Analyzer</p>
        </div>
      </header>

      <main className="main-content">

        {/* ── Step 1: Upload ── */}
        <div className="workflow-step">
          <div className="step-header">
            <span className="step-badge">1</span>
            <h2 className="step-title">Upload Dataset</h2>
          </div>

          <div className="upload-card">
            {!datasetReady && !isUploading && !uploadMessage && (
              <p className="dataset-notice">
                No dataset loaded. Upload a CSV file to begin analysis.
              </p>
            )}

            <p className="upload-hint">
              Accepted columns:{" "}
              <code>Review Text</code>, <code>review</code>, <code>text</code>,{" "}
              <code>content</code>. Add a product column (e.g.{" "}
              <code>Product Name</code>, <code>category</code>) to enable
              filtering.
            </p>

            <div className="upload-row">
              <label className="file-label">
                {uploadFile ? uploadFile.name : "Choose CSV file…"}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="file-input"
                />
              </label>
              <button
                className="upload-button"
                onClick={handleUpload}
                disabled={!uploadFile || isUploading}
              >
                {isUploading ? (
                  <><span className="spinner" />Indexing dataset…</>
                ) : (
                  "Upload & Index"
                )}
              </button>
            </div>

            {uploadMessage && (
              <p className={`upload-status ${uploadOk ? "upload-success" : "upload-error"}`}>
                {uploadOk ? "✓ " : "✗ "}{uploadMessage}
              </p>
            )}
          </div>
        </div>

        {/* ── Step 2: Product Filter ── */}
        <div className={`workflow-step${!datasetReady ? " step-disabled" : ""}`}>
          <div className="step-header">
            <span className="step-badge">2</span>
            <h2 className="step-title">Filter by Product <span className="step-optional">(optional)</span></h2>
          </div>

          {!datasetReady ? (
            <p className="step-locked">Upload a dataset to enable filtering.</p>
          ) : products.length > 0 ? (
            <div className="filter-section">
              <label className="filter-label" htmlFor="product-select">
                Narrow results to a specific product:
              </label>
              <select
                id="product-select"
                className="product-select"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="filter-unavailable">
              No product column detected in this dataset — product filtering is unavailable.
            </p>
          )}
        </div>

        {/* ── Step 3: Analyze ── */}
        <div className={`workflow-step${!datasetReady ? " step-disabled" : ""}`}>
          <div className="step-header">
            <span className="step-badge">3</span>
            <h2 className="step-title">Analyze</h2>
          </div>

          <div className="search-section">
            <input
              className="search-input"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                datasetReady
                  ? "e.g. poor delivery, great quality, bad packaging…"
                  : "Upload a dataset to enable analysis"
              }
              disabled={!datasetReady}
            />
            <button
              className="search-button"
              onClick={sendQuery}
              disabled={isLoading || !queryInput.trim() || !datasetReady}
            >
              {isLoading ? (
                <><span className="spinner" />Analyzing…</>
              ) : (
                "Analyze Reviews"
              )}
            </button>
            {(results || searchError) && (
              <button className="clear-button" onClick={clearResults}>
                Clear
              </button>
            )}
          </div>
        </div>

        {searchError && <div className="error-message">{searchError}</div>}

        {/* ── Step 4: Results ── */}
        {results && !isLoading && (
          <div className="dashboard">
            <div className="query-display">
              <span className="query-label">Results for:</span>
              <span className="query-text">"{results.query}"</span>
              {selectedProduct && (
                <span className="query-product"> — {selectedProduct}</span>
              )}
            </div>

            {analytics && (
              <div className="analytics-card">
                <h2 className="analytics-title">Analytics</h2>
                <div className="analytics-grid">
                  <div className="analytics-stat positive-stat">
                    <span className="stat-value">{analytics.positive_percentage}%</span>
                    <span className="stat-label">Positive ({analytics.positive_count})</span>
                  </div>
                  <div className="analytics-stat negative-stat">
                    <span className="stat-value">{analytics.negative_percentage}%</span>
                    <span className="stat-label">Negative ({analytics.negative_count})</span>
                  </div>
                  <div className="analytics-stat total-stat">
                    <span className="stat-value">{analytics.total_reviews_analyzed}</span>
                    <span className="stat-label">Reviews Analyzed</span>
                  </div>
                </div>
                <div className="sentiment-bar-wrapper">
                  <div
                    className="sentiment-bar-fill positive-fill"
                    style={{ width: `${analytics.positive_percentage}%` }}
                  />
                  <div
                    className="sentiment-bar-fill negative-fill"
                    style={{ width: `${analytics.negative_percentage}%` }}
                  />
                </div>
                <div className="sales-insight">
                  <span className="insight-icon">
                    {analytics.positive_percentage > 70
                      ? "📈"
                      : analytics.positive_percentage >= 40
                      ? "📊"
                      : "📉"}
                  </span>
                  {analytics.sales_insight}
                </div>
              </div>
            )}

            <div className="dashboard-grid">
              {results.summary.length > 0 && (
                <section className="dashboard-section summary-section">
                  <h2>Key Insights</h2>
                  <div className="summary-cards-container">
                    {results.summary.map((item, i) => (
                      <SummaryCard key={i} title={item.title} description={item.description} />
                    ))}
                  </div>
                </section>
              )}

              {results.reviews.length > 0 && (
                <section className="dashboard-section results-section">
                  <h2>Top Reviews</h2>
                  <div className="results-cards-container">
                    {results.reviews.map((r, i) => (
                      <ResultCard key={i} sentiment={r.sentiment} text={r.text} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default AnalyzerPage;
