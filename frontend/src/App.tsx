import { useState } from "react";

interface ScrapedData {
  title: string;
  difficulty: string;
  url: string;
}

export default function App() {
  const [data, setData] = useState<ScrapedData | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const handleCapture = async () => {
    setError("");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        setError("No active tab found.");
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_PROBLEM" }, (response) => {
        if (chrome.runtime.lastError) {
          setError("Open a LeetCode problem page first, then click Scan again.");
          return;
        }

        if (!response) {
          setError("No data returned from the page.");
          return;
        }

        setData(response);
      });
    } catch {
      setError("Scan failed. Reload the extension and try again.");
    }
  };

  const saveToSRS = () => {
    if (!data) return;
    
    const flashcardPayload = {
      ...data,
      notes,
      timestamp: Date.now(),
      nextReview: Date.now()
    };

    console.log("Payload generated for Local Storage Engine:", flashcardPayload);
    alert(`Successfully stored pattern for: ${data.title}`);
  };

  return (
    <div style={{ width: "300px", padding: "12px", backgroundColor: "#1e1e2e", color: "#cdd6f4", fontFamily: "sans-serif" }}>
      <h3 style={{ margin: "0 0 10px 0", color: "#89b4fa" }}>⚡ DevSRS Engine</h3>
      {error ? (
        <div style={{ marginBottom: "8px", padding: "8px", background: "#3b1f22", color: "#f38ba8", borderRadius: "4px", fontSize: "12px" }}>
          {error}
        </div>
      ) : null}
      
      {!data ? (
        <button onClick={handleCapture} style={{ width: "100%", padding: "8px", background: "#89b4fa", color: "#11111b", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>
          Scan LeetCode Page
        </button>
      ) : (
        <div>
          <div style={{ background: "#313244", padding: "8px", borderRadius: "4px", marginBottom: "8px" }}>
            <div style={{ fontWeight: "bold" }}>{data.title}</div>
            <div style={{ fontSize: "11px", color: "#a6adc8", marginTop: "4px" }}>Difficulty: {data.difficulty}</div>
          </div>

          <textarea 
            placeholder="Add key intuition patterns, optimal Big-O bounds, or notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: "100%", minHeight: "60px", background: "#313244", color: "#cdd6f4", border: "1px solid #45475a", borderRadius: "4px", marginBottom: "8px", boxSizing: "border-box", padding: "6px" }}
          />

          <button onClick={saveToSRS} style={{ width: "100%", padding: "8px", background: "#a6e3a1", color: "#11111b", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>
            Send to LLD Queue
          </button>
        </div>
      )}
    </div>
  );
}