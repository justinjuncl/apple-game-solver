chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["scripts/lib/tesseract.min.js", "scripts/content-script.js"]
    });
});
