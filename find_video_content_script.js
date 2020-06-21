const findVideoNodes = () => {
    // Returns a static NodeList, i.e further DOM changes won't be reflected in the list
    console.log('Finding video nodes');
    const videoNodes = document.querySelectorAll('video');
    console.log('videoNodes', JSON.stringify(videoNodes));

    if (videoNodes.length <= 0) {
        console.log('No video elements found');
        return;
    }

    addStylesheet();                // Stylesheet is only added once even if called multiple times
    videoNodes.forEach((node) => {
        attach(node);
    });
};

// TODO: Maybe pick attacher based on the player's ids if there are any?
// Like the YouTube player and JW player etc
const getAttacher = () => {
    // The regex below is simple but does what it needs to
    // It utilizes a lookahead, (?=.com), to match everything up until that point
    // It utilizes a lookbehind, (?<=\/\/www\.), to match everything after //www.
    // By matching after //www. you get the domain name which is crucial when picking attacher
    /* const domains = window.location.href.match(new RegExp('(?<=\/\/www\.).*(?=.com)'));

    if (domains.length <= 0) {
        console.log('Could not decipher domain name from URL');
        return new Attacher();
    }

    switch (domains[0]) {
        case 'youtube':
            console.log('Picking YouTube attacher');
            return new YouTubeAttacher();
        default:
            return new Attacher();
    } */
};

// Function can only be executed once. To prevent multiple repetitive stylesheets
// from being appended
const addStylesheet = (function() {
    let executed = false;
    return function() {
        if (!executed) {
            executed = true;

            console.log('Applying stylesheet');
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.type = 'text/css';
            style.href = chrome.extension.getURL('overlay_video.css');
            (document.head||document.documentElement).appendChild(style);
        }
    };
})();

const attach = (video) => {
    console.log('Attaching to', video);
    toggleAttacher.attach(video);
    videoAttacher.attach(video);
};

// Attach overlay toggle depending on the player
// For certain reoccuring players you attach the toggle button
// in the player's toolbar
// For unrecognized players; apply default button placement
// YouTube: #ytd-player -> .ytp-right-controls
// In order to put the toggle button within .ytp-right-controls
// you need to verify that the video resides within #ytd-player
const toggleAttacher = {
    attach: (video) => {
        // Is the video node a YouTube player?
        const youtubePlayer = document.querySelector('#ytd-player');

        if (youtubePlayer !== null) {
            // Is the video node in question a YouTube player video?
            // I.e a descendant of the YouTube player node
            if (youtubePlayer.contains(video)) {
                const controlContainer = youtubePlayer.querySelector('.ytp-right-controls');
                return toggleAttacher.attachYouTube(controlContainer);
            }
        }

        // No known player could be identified; apply default toggle
        return toggleAttacher.attachDefault(video);
    },

    /**
     * @argument controlsNode is the container in YouTube's toolbar dedicated to controls
     */
    attachYouTube: (controlsNode) => {
        console.log('Attaching YouTube toggle button', controlsNode);

        // Create button container
        /* const container = document.createElement('div');
        container.id = 'ss-youtube-container';
        // Create inner container(to enable CSS hack for a perfect square shape)
        const innerContainer = document.createElement('div');
        const toggle = document.createElement('img');
        toggle.src = chrome.runtime.getURL('images/icon.png');
        // Construct elements
        innerContainer.appendChild(toggle);
        container.appendChild(innerContainer); */

        const button = document.createElement('button');
        button.id = 'ss-youtube-container';
        // YouTube specific classes
        button.classList.add('playerButton', 'ytp-button');
        const buttonImage = document.createElement('img');
        buttonImage.src = chrome.runtime.getURL('images/IconTransparent.png');
        buttonImage.classList.add('playerButtonImage');
        button.appendChild(buttonImage);

        // Ensure that a container has not yet already been injected
        if (controlsNode.querySelector('#ss-youtube-container') !== null) {
            console.log('Toggle container already in DOM');
            return;
        }

        toggleAttacher.addToggleListener(button);
        controlsNode.prepend(button);
    },

    attachDefault: (video) => {
        console.log('Attaching default toggle button', video);
        // Create button container
        const container = document.createElement('div');
        container.id = 'ss-default-container';
        // Create inner container(to enable CSS hack for a perfect square shape)
        const innerContainer = document.createElement('div');
        const toggle = document.createElement('img');
        toggle.src = chrome.runtime.getURL('images/Icon.png');
        // Construct elements
        innerContainer.appendChild(toggle);
        container.appendChild(innerContainer);

        // Ensure that a container has not yet already been injected
        if (video.nextSibling && video.nextSibling.id === 'ss-default-container') {
            console.log('Toggle container already in DOM');
            return;
        }

        // Event listener should be on the element in order to be able to stop the propagation
        /* document.addEventListener('click', (e) => {
            if (e.target && e.target.id== 'ss-container') {
                toggleOnClick(e);
            }
        }); */
        toggleAttacher.addToggleListener(container);
        // Video nodes can't contain elements, place it adjacent to the video
        // video.appendChild(container);
        video.parentNode.insertBefore(container, video.nextSibling);
    },

    addToggleListener: (toggle) => {
        toggle.addEventListener('click', toggleOnClick, false);
    },
};

const toggleOnClick = (e) => {
    console.log('Toggle click', e);
    e.stopPropagation();
    e.preventDefault();
};

const videoAttacher = {
    attach: (video) => {
        console.log('Attaching video');
    },
};

// Start running the script by analysing the current DOM for video nodes
findVideoNodes();

// Continue monitering the DOM for changes, in particular, additions of video nodes
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
