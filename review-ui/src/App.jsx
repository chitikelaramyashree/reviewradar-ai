import { useState } from "react";
import LandingPage from "./components/LandingPage";
import AnalyzerPage from "./components/AnalyzerPage";
import "./App.css";

function App() {
  const [page, setPage] = useState("home");

  if (page === "analyzer") {
    return <AnalyzerPage onBack={() => setPage("home")} />;
  }

  return <LandingPage onStart={() => setPage("analyzer")} />;
}

export default App;
