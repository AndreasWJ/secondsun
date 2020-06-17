const findVideoNodes = () => {
    // Returns a static NodeList, i.e further DOM changes won't be reflected in the list
    console.log('Finding video nodes');
    const videoNodes = document.querySelectorAll('video');
    console.log('videoNodes', JSON.stringify(videoNodes));

    if (videoNodes.length <= 0) {
        console.log('No video elements found');
        return;
    }

    videoNodes.forEach((node) => {
        attach(node);
    });
};

const addStylesheet = () => {
    console.log('Applying stylesheet');
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.type = 'text/css';
    style.href = chrome.extension.getURL('overlay_video.css');
    (document.head||document.documentElement).appendChild(style);
};

const attach = (video) => {
    console.log('Attaching to', video);
    attachToggleButton(video);
};

const tail = ([x, ...xs]) => xs;

const isEmptyObject = (obj) => (Object.keys(obj).length === 0 && obj.constructor === Object);

const attachToggleButton = (video) => {
    // Attach overlay toggle depending on the player
    // For certain reoccuring players you attach the toggle button
    // in the player's toolbar
    // For unrecognized players; apply default button placement
    console.log('Attaching toggle button', video);
    const container = document.createElement('div');
    container.id = 'ss-container';
    const toggle = document.createElement('img');
    toggle.src = chrome.runtime.getURL('images/icon.png');
    // container.appendChild(toggle);
    container.onclick = toggleOnClick;
    // Ensure that a container has not yet already been injected
    if (video.nextSibling && video.nextSibling.id === 'ss-container') {
        console.log('Toggle container already in DOM');
        return;
    }

    addStylesheet();
    // Video nodes can't contain elements, place it adjacent to the video
    // video.appendChild(container);
    video.parentNode.insertBefore(container, video.nextSibling);
};

const toggleOnClick = (e) => {
    console.log('Toggle click', e);
};

chrome.runtime.onMessage.addListener((req, sender) => {
    console.log('Received le message');
    if (req.status === 'CONTENT_UPDATE') {
        console.log('Content update, check for video elements again');
        findVideoNodes();
    }
});

findVideoNodes();
