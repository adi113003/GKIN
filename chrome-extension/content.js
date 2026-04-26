// content.js — extracts article text from the current page

function extractArticleText() {
  // Try common article selectors first
  const selectors = [
    "article",
    '[role="main"]',
    ".article-body",
    ".article-content",
    ".post-content",
    ".entry-content",
    ".story-body",
    ".story-content",
    ".news-article",
    "main",
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText.trim();
      if (text.length > 300) return { text, title: document.title, url: location.href };
    }
  }

  // Fallback: grab largest visible text block (p tags)
  const paragraphs = Array.from(document.querySelectorAll("p"))
    .filter(p => p.offsetParent !== null)
    .map(p => p.innerText.trim())
    .filter(t => t.length > 80);

  const text = paragraphs.join("\n\n");
  return { text, title: document.title, url: location.href };
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXTRACT_TEXT") {
    sendResponse(extractArticleText());
  }
  return true;
});
