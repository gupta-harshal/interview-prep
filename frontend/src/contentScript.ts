function scrapeLeetCodeProblem() {
  // Grab LeetCode Title
  const titleElement = document.querySelector("div.text-title-large");
  const title = titleElement ? titleElement.textContent?.trim() : document.title;
  
  // Grab Difficulty (Easy, Medium, Hard)
  const difficultyElement = document.querySelector("div.text-difficulty-easy, div.text-difficulty-medium, div.text-difficulty-hard");
  const difficulty = difficultyElement ? difficultyElement.textContent?.trim() : "Unknown";

  return { title, difficulty, url: window.location.href };
}

// Receive triggers sent out by extension's popup window
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "SCRAPE_PROBLEM") {
    const data = scrapeLeetCodeProblem();
    sendResponse(data);
  }
  return true; // Leaves communication link open for async loops
});