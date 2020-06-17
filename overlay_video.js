const attach = (video) => {
    console.log('Attaching to', video);
    attachToggleButton(video);
};

/**
 * Fetch the first node listed in relation to the current tab id.
 * Update the node list by removing the fetched node.
 * @throws if no node is in list
 */
const fetchNode = () => {
    chrome.tabs.query({
        active: true,               // Select active tabs
        currentWindow: true         // In the current window
    }, (array_of_tabs) => {
        // Since there can only be one active tab in one active window,
        // the array has only one element
        const active = array_of_tabs[0];

        chrome.storage.local.get({ [active.id.toString()]: [] }, (value) => {
            if (value.length > 0) {
                chrome.storage.local.set(active.id.toString(), tail(value));
                return value[0];
            }

            console.error('Overlay element could not find video node in tab: ', active.id);
        });
    });
};

const tail = ([x, ...xs]) => xs;

const isEmptyObject = (obj) => (Object.keys(obj).length === 0 && obj.constructor === Object);

const attachToggleButton = (video) => {
    // Attach overlay toggle depending on the player
    // For certain reoccuring players you attach the toggle button
    // in the player's toolbar
    // For unrecognized players; apply default button placement
    console.log('Attaching toggle button');
    const textnode = document.createTextNode("Button");
    video.appendChild(textnode);
};

// window.onload = attach;

console.log('Overlaying videos');
/* if (nodes !== undefined) {
    // Set from instantiation script
    nodes.forEach(video => attach(video));
} else {
    console.log('Cannot attach if nodes are not defined');
} */

chrome.runtime.onMessage.addListener((req, sender) => {
    console.log('Can now overlay', req.node);
    attach(req.node);
});
