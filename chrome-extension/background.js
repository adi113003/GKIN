// background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "analyze-gkin",
    title: "Analyze with GKIN",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "analyze-gkin" && info.selectionText) {
    // Store the selected text
    await chrome.storage.local.set({ gkin_pending_text: info.selectionText });
    
    // Set a badge to notify the user
    await chrome.action.setBadgeText({ text: "1" });
    await chrome.action.setBadgeBackgroundColor({ color: "#ff385c" }); // Rausch
  }
});
