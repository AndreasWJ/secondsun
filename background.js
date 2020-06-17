'use strict'

chrome.webNavigation.onHistoryStateUpdated.addListener(({ frameId, transitionType, transitionQualifiers, url, timeStamp }) => {
    // The DOM's content has changed. Check for video elements again
    console.log('Background.js: onHistoryStateUpdated', frameId, transitionType, transitionQualifiers, url, timeStamp);
    // chrome.runtime.sendMessage({ status: 'CONTENT_UPDATE' });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { status: 'CONTENT_UPDATE' });  
    });
});
