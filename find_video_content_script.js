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

// Attach overlay toggle depending on the player
// For certain reoccuring players you attach the toggle button
// in the player's toolbar
// For unrecognized players; apply default button placement
const attachToggleButton = (video) => {
    console.log('Attaching toggle button', video);
    // Create button container
    const container = document.createElement('div');
    container.id = 'ss-container';
    // Create inner container(to enable CSS hack for a perfect square shape)
    const innerContainer = document.createElement('div');
    const toggle = document.createElement('img');
    toggle.src = chrome.runtime.getURL('images/icon.png');
    innerContainer.appendChild(toggle);
    container.appendChild(innerContainer);

    // Ensure that a container has not yet already been injected
    if (video.nextSibling && video.nextSibling.id === 'ss-container') {
        console.log('Toggle container already in DOM');
        return;
    }

    // TODO: Place somewhere different, has nothing to do with attaching toggle
    addStylesheet();
    // Event listener should be on the element in order to be able to stop the propagation
    /* document.addEventListener('click', (e) => {
        if (e.target && e.target.id== 'ss-container') {
              toggleOnClick(e);
        }
    }); */
    container.addEventListener('click', toggleOnClick, false);
    // Video nodes can't contain elements, place it adjacent to the video
    // video.appendChild(container);
    video.parentNode.insertBefore(container, video.nextSibling);
};

const toggleOnClick = (e) => {
    console.log('Toggle click', e);
    e.stopPropagation();
    e.preventDefault();
};

findVideoNodes();

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        const addedNodes = [ ...mutation.addedNodes ];          // Converted to array for simplicity
        if (addedNodes.some((node) => node.tagName === 'VIDEO')) {
            console.log('Detected mutation; added video as element');
            findVideoNodes();
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });
