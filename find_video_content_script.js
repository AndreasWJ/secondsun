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
        if (!inspected.includes(node)) {
            inspected.push(node);
            attach(node);
        }
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
            console.log('Found YouTube player in document');
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
        /* const videoContainer = document.createElement('div');
        videoContainer.id = 'ss-video-container';
        const renderCanvas = document.createElement('canvas');
        renderCanvas.id = 'ss-render-canvas';
        // Copy width and height from video to intermediary canvas
        // TODO: Figure out a way for dynamic video overlay across different players
        // You might have to put your own container around the video
        // const videoStyle = window.getComputedStyle(video);
        // renderCanvas.style.width = videoStyle.width;
        // renderCanvas.style.height = videoStyle.height;
        // Append the video container as an inner container
        video.parentNode.appendChild(videoContainer);

        // Append canvas adjacent to the source element
        // video.parentNode.insertBefore(renderCanvas, video.nextSibling);
        // Move the video into its new container
        // 'appendChild' should remove the element after copy
        videoContainer.appendChild(video);
        videoContainer.appendChild(renderCanvas); */

        // New approach with ResizeObserver to accommodate for videos in absolute positioning
        const renderCanvas = document.createElement('canvas');
        renderCanvas.id = 'ss-render-canvas';
        video.parentNode.insertBefore(renderCanvas, video.nextSibling);

        // Detect size changes; change size and positioning of render canvas
        // TODO: Add additional observer for changes in positioning; top, right, bottom, left
        // On YouTube there are cases where the position changes but not the actual size of
        // the player. Probably to accommodate for different aspect ratios
        // To illustrate the problem resize the window so the YouTube player is small height-wise
        // but has a great amount of space width-wise
        // Then make the window smaller horizontally, the video will keep its size
        // but the position will change
        const ro = new ResizeObserver((entries) => {
            for (let entry of entries) {
              const cr = entry.contentRect;
              console.log('Element:', entry.target);
              console.log(`Element size: ${cr.width}px x ${cr.height}px`);
              console.log(`Element padding: ${cr.top}px ; ${cr.left}px`);
              renderCanvas.width = cr.width;
              renderCanvas.height = cr.height;
              console.log('test', entry.target.style.top, entry.target.style.right, entry.target.style.bottom, entry.target.style.left);
              videoAttacher.requestVideoPositioning(video, renderCanvas);
            }
        });
          
        // Observe one or multiple elements
        ro.observe(video);

        // Observe changes to video positioning
        const mo = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                if (
                    mutation.target.style.top !== extractAttributeValue(mutation.oldValue, 'top') ||
                    mutation.target.style.right !== extractAttributeValue(mutation.oldValue, 'right') ||
                    mutation.target.style.bottom !== extractAttributeValue(mutation.oldValue, 'bottom') ||
                    mutation.target.style.left !== extractAttributeValue(mutation.oldValue, 'left')
                ) {
                    console.log('The video node received or changed its position, requesting canvas update');
                    videoAttacher.requestVideoPositioning(video, renderCanvas);
                }
            }
        });

        mo.observe(video, {
            attributes: true,
            attributeFilter: ['style'],
            attributeOldValue: true,
        });

        filterer.init(video, renderCanvas);
    },

    requestVideoPositioning: (video, renderCanvas) => {
        console.log('Requesting new canvas position');
        // If the video node has set position, rely on it
        // Check if any inline positions are set
        if (hasInlineStyle(video, 'top', 'right', 'bottom', 'left')) {
            console.log('Found existing inline video position, relying on it');
            renderCanvas.style.top = video.style.top;
            renderCanvas.style.right = video.style.right;
            renderCanvas.style.bottom = video.style.bottom;
            renderCanvas.style.left = video.style.left;
            return;
        }

        // Check if any positions are set within a stylesheet
        if (hasStylesheetStyle(video, 'top', 'right', 'bottom', 'left')) {
            console.log('Found existing stylesheet video position, relying on it');
            renderCanvas.style.top = window.getComputedStyle(video).getPropertyValue('top');
            renderCanvas.style.right = window.getComputedStyle(video).getPropertyValue('right');
            renderCanvas.style.bottom = window.getComputedStyle(video).getPropertyValue('bottom');
            renderCanvas.style.left = window.getComputedStyle(video).getPropertyValue('left');
            return;
        }

        console.log('Calculating canvas positioning based on relative parent and video');
        const relativeParent = getRelativeParent(video);
        console.log('New relative parent', relativeParent);

        // Compare video's and relative parent document-relative coordinates
        // as absolute positioning is based on document rather than window
        // With the difference between coordinates you'll get new values
        // for the renderCanvas' top, right, bottom, left attributes
        const {
            top: parentTop,
            right: parentRight,
            bottom: parentBottom,
            left: parentLeft,
        } = getCoords(relativeParent);

        const {
            top: videoTop,
            right: videoRight,
            bottom: videoBottom,
            left: videoLeft,
        } = getCoords(video);

        console.log(
            'New top', (videoTop - parentTop),
            'new right', (videoRight - parentRight),
            'New bottom', (videoBottom - parentBottom),
            'New left', (videoLeft - parentLeft),
        );

        // Setting top and left should be fine, the width and height depend on the video size
        renderCanvas.style.top = (videoTop - parentTop) + 'px';
        // renderCanvas.style.right = (videoRight - parentRight);
        // renderCanvas.style.bottom = (videoBottom - parentBottom);
        renderCanvas.style.left = (videoLeft - parentLeft) + 'px';
    },
};

const filterer = {
    init: function(video, renderCanvas) {
        console.log('Initializing filterer');
        this.video = video;
        this.renderCanvas = renderCanvas;
        this.renderContext = renderCanvas.getContext('2d');

        // Call method that repetedly computes frame
        const self = this;
        this.video.addEventListener('play', function() {
            self.timerCallback();
        }, false);
    },

    timerCallback: function() {
        if (this.video.paused || this.video.ended) {  
            return;  
        }
  
        this.computeFrame();
        const self = this;

        setTimeout(function() {
            self.timerCallback();
        }, 16);
    },

    computeFrame: function() {
        // console.log('computeFrame', this.video, this.video.style.width, this.video.style.height);
        this.renderContext.drawImage(this.video, 0, 0, parseInt(this.video.style.width, 10), parseInt(this.video.style.height, 10));
        // Error at getImageData, says source width is equal to 0
        // 'this.video.width' and 'this.video.height' are both equal to 0 because
        // the video source has yet to load
        const frame = this.renderContext.getImageData(0, 0, parseInt(this.video.style.width, 10), parseInt(this.video.style.height, 10));
        const l = frame.data.length / 4;  

        for (let i = 0; i < l; i++) {
            const grey = (frame.data[i * 4 + 0] + frame.data[i * 4 + 1] + frame.data[i * 4 + 2]) / 3;

            frame.data[i * 4 + 0] = grey;
            frame.data[i * 4 + 1] = grey;
            frame.data[i * 4 + 2] = grey;
        }

        this.renderContext.putImageData(frame, 0, 0);
    },
};

// Maybe it's possible to set top, left, bottom, right exactly
// knowing the relative parent and the video node
// Right now it's mostly based on guesses, the video's style attributes,
// and a default top and left equal to 0
const getRelativeParent = (node) => {
    // Unnest until you find the parent with 'position: relative'
    // If not found, return document
    if (node.parentNode === null) {
        // The current node is document, document nodes cannot have a parent
        // Return the document element, not the HTML as it's read-only
        return node.documentElement;
    }

    if (window.getComputedStyle(node).getPropertyValue('position') === 'relative') {
        return node;
    }

    return getRelativeParent(node.parentNode);
};

// Get document coordinates of the element
const getCoords = (elem) => {
    let box = elem.getBoundingClientRect();
  
    return {
      top: box.top + window.pageYOffset,
      right: box.right + window.pageXOffset,
      bottom: box.bottom + window.pageYOffset,
      left: box.left + window.pageXOffset
    };
};

const hasInlineStyle = (elem, ...attributes) => {
    return attributes.some((attribute) => elem.style[attribute] !== '' && elem.style[attribute] !== 'auto');
};

const hasStylesheetStyle = (elem, ...attributes) => {
    return attributes.some((attribute) =>
        window.getComputedStyle(elem).getPropertyValue(attribute) !== '' &&
        window.getComputedStyle(elem).getPropertyValue(attribute) !== 'auto');
};

/**
 * 
 * @param {*} attributeString example input "top: 0px; left: 277.333px;"
 * @param {*} attributeName
 */
const extractAttributeValue = (attributeString, attributeName) => {
    // The regex is simple, it uses a lookahead to match any character or digit
    // followed by a semicolon. This will match all attribute values
    // But what's interesting is a certain value. To find a specific value
    // a lookbehind is used to look for 'top: ' or 'left: ' for example
    const regex = new RegExp(`(?<=${attributeName}: )[a-zA-Z0-9.]*(?=;)`);
    const match = attributeString.match(regex);

    return match !== null ? match[0] : '';
};

// Adding the new container, moving the video element,
// causes the MutationObserver to run since it thinks a new video element
// has appeared. Resulting in an infinite loop because the video element
// is found once again in the MutationObserver
// Add a new state array with video nodes that have already been discovered and dealt
const inspected = [];

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
