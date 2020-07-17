// Decides the default filterer toggle for this page based on
// what's toggled on previous pages
let lastToggled = null;
// Keeps track of the number of recognized video nodes
// Is used to assign a unique id to each video's checkbox input
// This id is also referenced in the video's inspected entry
let numberOfNodes = 0;

// TODO: Request CORS if the video is from a different origin
// If not available, show a console warning and prevent filtering
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
        if (inspected.has(node) === false) {
            checkVideoSources(node);
            addSourceObserver(node);
            inspected.set(node, { id: numberOfNodes++, video: node, toggle: null, filterer: new Filterer() });
            attach(node);
        }
    });
};

const checkVideoSources = (video) => {
    // Check if CORS is needed
    if (video.src !== '' && video.src !== undefined && video.src !== null) {
        console.log('checkVideoSources: Requesting CORS for video');
        requestCORS(video.src, video);
    } else {
        console.log('checkVideoSources: Checking children sources');
        const sources = video.querySelectorAll('source');
        sources.forEach((source) => requestCORS(source.src, video));
    }
};

// FIXME: Invalid URL error
// It is because the src is not defined at page load
// TODO: What you have to do is to observe video nodes
// Observe for video nodes' src attributes and potential
// children(source tags)
// Source tags often refer to a relative path so only
// compare and request CORS if it's an absolute path
const requestCORS = (path, video) => {
    console.log('requestCORS path video.src', path, video.src);
    console.log('requestCORS video', JSON.parse(JSON.stringify(video)));
    if (shareOrigin(path) === false) {
        // TODO: Send a HTTP request to the other origin with an attempted access with CORS
        // If a fail response is received the extension cannot work. Show an error message
        // if the user clicks the toggle button

        // Works with 'anonymous'
        // However, what happens if anonymous fails?
        console.log('Origins does not match');
        // Video and the page the extension is running on doesn't share origin
        if (video.crossOrigin !== '') {
            console.log('Video crossOrigin set to anonymous');
            video.crossOrigin = '';
        }
    } else {
        console.log('Origins match');
    }
};

/**
 * @param {string} path relative or absolute path to a resource.
 */
const shareOrigin = (path) => {
    if (path.indexOf('http://') >= 0 || path.indexOf('https://') >= 0 ) {
        // Path is absolute
        if ((new URL(path)).origin === window.location.origin) {
            return true;
        } else {
            return false;
        }
    } else {
        // Path is relative, path and page must share origin
        return true;
    }
};

const addSourceObserver = (element) => {
    const sourceObserver = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            // If 'src' is added or updated on the video or one of the sources
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                // Either the video received a source or one of the source tags
                // Request CORS if the new src is an absolute path with a different origin
                // There's no real documentation on the relationship between video and
                // source tags if present in regards to CORS
                // From the examples online it seems that crossOrigin should be set
                // on the video element if one of the sources refers cross-domain
                console.log('sourceObserver: Detected src mutation');
                requestCORS(mutation.target.src, element);
            } else if (mutation.type === 'childList') {
                // A source was added or removed
                mutation.addedNodes.forEach((source) => {
                    console.log('sourceObserver: Detected added sources', source);
                    if (source.src !== '' && source.src !== undefined && source.src !== null) {
                        // The added source has a defined src attribute, request CORS
                        requestCORS(source.src, element);
                    }
                });
            }
        }
    });

    sourceObserver.observe(element, {
        childList: true,
        attributes: true,
        attributeFilter: ['src'],
        subtree: true,
    });
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
        let toggle;
        // Is the video node within a YouTube page?
        const youtubeControls = document.querySelector('.ytp-right-controls');

        if (youtubeControls !== undefined && youtubeControls !== null) {
            console.log('Found YouTube controls in document');
            toggle = toggleAttacher.attachYouTube(video, youtubeControls);
        } else {
            // No known player could be identified; apply default toggle
            toggle = toggleAttacher.attachDefault(video);
        }

        // Update the inspected map with a referenced to the created toggle button
        mapAppend(inspected, video, { toggle });
    },

    getDefaultState: (cb) => {
        if (lastToggled !== null) {
            console.log('Found default toggle state', lastToggled);
            return cb(lastToggled);
        }

        // Retrieve the lastToggled value from storage
        // Retrieve the last toggle state before searching and attaching the page
        chrome.storage.sync.get(['lastToggled'], (result) => {
            if (result.lastToggled === undefined || result.lastToggled === null) {
                console.log('Could not find previous toggle state, default to false');
                lastToggled = false;
            } else {
                console.log('Retrieved lastToggled', result.lastToggled);
                lastToggled = result.lastToggled;
            }

            return cb(lastToggled);
        });
    },

    getCheckboxId: (toggleId) => {
        return `ss-checkbox-${toggleId}`;
    },

    /**
     * Create checkbox toggle. Apply gradient background when checked.
     * Animate transparent icon by scaling down when checked.
     */
    createToggle: (containerType, toggleId) => {
        console.log('Creating toggle with toggleId', toggleId);
        const container = document.createElement('div');
        container.classList.add(containerType);
        // Create the animated gradient background, animated in on check
        const gradientBackground = document.createElement('div');
        gradientBackground.classList.add('ss-toggle-gradient-background');

        // Apply default toggle design
        // Create inner container
        const toggle = document.createElement('label');
        toggle.classList.add('ss-toggle');
        // The 'for' attribute must match the checkboxes id! Not value or name or anything else
        toggle.setAttribute('for', toggleAttacher.getCheckboxId(toggleId));
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = toggleAttacher.getCheckboxId(toggleId);
        // Set checkbox default value to lastToggled
        toggleAttacher.getDefaultState((toggleState) => {
            console.log('toggleState got default value', toggleState);
            checkbox.checked = toggleState;

            // Add active style class. I.e if the checkbox is checked initally apply
            // the "active" class
            toggleAttacher.applyStateStyle(toggleState, checkbox, gradientBackground);
        });
        toggle.appendChild(checkbox);

        const buttonImage = document.createElement('img');
        buttonImage.src = chrome.runtime.getURL('images/IconTransparent.png');
        toggle.appendChild(buttonImage);

        const toggleContainer = document.createElement('div');
        toggleContainer.classList.add('ss-toggle-container');
        toggleContainer.appendChild(gradientBackground);
        toggleContainer.appendChild(toggle);

        const innerContainer = document.createElement('div');
        innerContainer.classList.add('ss-inner-youtube-container');
        innerContainer.appendChild(toggleContainer);

        const bigInner = document.createElement('div');
        bigInner.classList.add('ss-big-inner-youtube-container');
        bigInner.appendChild(innerContainer);

        container.appendChild(bigInner);

        return container;
    },

    /**
     * @argument controlsNode is the controls container on YouTube, is available from page load,
     * even when opening in new tab.
     */
    attachYouTube: (video, controlsNode) => {
        console.log('Attaching YouTube toggle button to controls', controlsNode);

        if (controlsNode === null) {
            console.warn('Could not find controls container');
            return null;
        }

        const toggle = toggleAttacher.createToggle('ss-youtube-container', inspected.get(video).id);
        toggle.classList.add('playerButton', 'ytp-button');

        // Ensure that a container has not yet already been injected
        if (controlsNode.querySelector('.ss-youtube-container') !== null) {
            console.log('Toggle container already in DOM');
            return;
        }

        toggleAttacher.addToggleListener(toggle, video, inspected.get(video).id);
        controlsNode.prepend(toggle);

        return toggle;
    },

    attachDefault: (video) => {
        console.log('Attaching default toggle button', video);

        // CSS class 'ss-default-container' applies position styling
        const toggle = toggleAttacher.createToggle('ss-default-container', inspected.get(video).id);

        // Ensure that a container has not yet already been injected
        if (video.nextSibling && video.nextSibling.classList.contains('ss-default-container')) {
            console.log('Toggle container already in DOM');
            return;
        }

        // Event listener should be on the element in order to be able to stop the propagation
        /* document.addEventListener('click', (e) => {
            if (e.target && e.target.id== 'ss-container') {
                toggleOnClick(e);
            }
        }); */
        toggleAttacher.addToggleListener(toggle, video, inspected.get(video).id);
        // Video nodes can't contain elements, place it adjacent to the video
        // video.appendChild(container);
        video.parentNode.insertBefore(toggle, video.nextSibling);

        return toggle;
    },

    addToggleListener: (toggle, video, toggleId) => {
        // Set the lastToggled to true or false
        // Used when loading a new page to figure out to default to toggle = true or
        // toggle = false. A user that leaves a page with a certain toggle state
        // expects the new page to maintain that state
        // toggle.addEventListener('click', (e) => toggleAttacher.toggleOnClick(e, video), false);
        const checkbox = toggle.querySelector(`#${toggleAttacher.getCheckboxId(toggleId)}`);
        checkbox.addEventListener('change', function (e) {
            console.log('addToggleListener change');
            toggleAttacher.toggleOnClick(e, video, this.checked);
        }, false);
    },

    updateStyle: (checked, toggle, toggleId) => {
        const toggleCheckbox = toggle.querySelector(`#${toggleAttacher.getCheckboxId(toggleId)}`);
        const toggleGradient = toggle.querySelector('.ss-toggle-gradient-background');
        toggleAttacher.applyStateStyle(checked, toggleCheckbox, toggleGradient);
    },

    applyStateStyle: (checked, checkbox, gradient) => {
        console.log('toggleStyling', checked, checkbox, gradient);

        // Named function. Needed to eventually remove the event listener
        const animatedOut = () => {
            console.log('toggle animationend');
            gradient.removeEventListener('animationend', animatedOut);
            gradient.classList.remove('ss-toggle-gradient-background-animate-out');
        };

        if (checked) {
            console.log('Styling checkbox according to true');
            gradient.classList.add('ss-toggle-gradient-background-animate-in');
        } else {
            console.log('Styling checkbox according to false');
            // Only animate "out" if the element has animated in
            // Will prevent cases where the page loads and the element is animated out on load
            if (gradient.classList.contains('ss-toggle-gradient-background-animate-in')) {
                gradient.classList.remove('ss-toggle-gradient-background-animate-in');

                gradient.classList.add('ss-toggle-gradient-background-animate-out');
                gradient.addEventListener('animationend', animatedOut);
            }
        }
    },

    // Make ids into classes in case there are multiple videos on a page
    // Yes. Elements can't exists within the same document with the same id
    toggleOnClick: (e, video, checked) => {
        console.log('Toggle click');
        const attachData = inspected.get(video);
        toggleAttacher.updateStyle(checked, attachData.toggle, attachData.id);

        // Stop further propagation
        // To prevent a click on the video underneath
        e.stopPropagation();
        e.preventDefault();

        attachData.filterer.set.call(attachData.filterer, checked);
        chrome.storage.sync.set({ lastToggled: checked });
    },
};

/**
 * TODO: Some video players have a certain size but the actual content is smaller,
 * usually smaller height. If a video's dimensions are smaller than the
 * canvas's size the picture will stretch
 * It seems like WebGL reads data straight from the intrinsic video compared to
 * the page's video element
 * You might therefore have to retrieve 'videoWidth' and 'videoHeight'
 * and center the canvas horizontally and vertically.
 * Centering is a guess, but that's usually how players are designed
 * You can make your existing canvas a div container and within
 * a canvas with 'videoWidth' as width and 'videoHeight' as height
 * https://stackoverflow.com/questions/4129102/html5-video-dimensions
 */
const videoAttacher = {
    attach: (video) => {
        console.log('Attaching video', video);
        /* const videoContainer = document.createElement('div');
        videoContainer.id = 'ss-video-container';
        const renderCanvas = document.createElement('canvas');
        renderCanvas.id = 'ss-render-canvas';
        // Copy width and height from video to intermediary canvas
        // Figure out a way for dynamic video overlay across different players
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
        const renderContainer = document.createElement('div');
        renderContainer.classList.add('ss-render-container');
        const renderCanvas = document.createElement('canvas');
        renderCanvas.classList.add('ss-render-canvas');
        renderContainer.appendChild(renderCanvas);
        video.parentNode.insertBefore(renderContainer, video.nextSibling);

        video.addEventListener('loadedmetadata', () => {
            // Set render canvas size to the video's intrinsic size
            // videoWidth and videoHeight now available
            console.log('Set canvas size to intrinsic video size');
            renderCanvas.width = video.videoWidth;
            renderCanvas.height = video.videoHeight;
        }, false);

        // Detect size changes; change size and positioning of render canvas
        // Add additional observer for changes in positioning; top, right, bottom, left
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
              renderContainer.style.width = cr.width + 'px';
              renderContainer.style.maxWidth = cr.width + 'px';
              renderContainer.style.height = cr.height + 'px';
              renderContainer.style.maxHeight = cr.height + 'px';
              console.log('test', entry.target.style.top, entry.target.style.right, entry.target.style.bottom, entry.target.style.left);
              videoAttacher.requestVideoPositioning(video, renderContainer);
            }
        });
          
        // Observe one or multiple elements
        ro.observe(video);

        // Observe changes to video positioning
        const mo = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                // If there's no previous value recorded you cannot compare
                // Update the video positioning in case
                if (
                    mutation.oldValue === null ||
                    mutation.target.style.top !== extractAttributeValue(mutation.oldValue, 'top') ||
                    mutation.target.style.right !== extractAttributeValue(mutation.oldValue, 'right') ||
                    mutation.target.style.bottom !== extractAttributeValue(mutation.oldValue, 'bottom') ||
                    mutation.target.style.left !== extractAttributeValue(mutation.oldValue, 'left')
                ) {
                    console.log('The video node received or changed its position, requesting canvas update');
                    videoAttacher.requestVideoPositioning(video, renderContainer);
                }
            }
        });

        mo.observe(video, {
            attributes: true,
            attributeFilter: ['style'],
            attributeOldValue: true,
        });

        // Start displaying over the source video
        const attachData = inspected.get(video);
        attachData.filterer.init(video, renderCanvas);
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

// TODO: Include rbgtohsv and hsvtorbg as string functions to each fragment shader
// Convert to HSV, invert the V value of the color, convert back to RGB
// The result is that if you have a bright blue color it will display as a dark blue
// And bright whites as dark blacks etc
const glSources = {
    invert: {
        // Don't need any projection matrix. Clip space coordinates are fine
        // No need for perspective 3D either
        vsSource: `
            attribute vec4 aVertexPosition;
            attribute vec2 aTextureCoord;

            varying highp vec2 vTextureCoord;

            void main(void) {
                gl_Position = aVertexPosition;
                vTextureCoord = aTextureCoord;
            }
        `,
        // The best way to switch between filters seems to be by changing
        // a uniform and depending on that uniform render invert, dampen, darken
        // For greyscale you take a pixel. Sum the pixels R, G, and B values
        // and divide by 3
        fsSource: `
            uniform sampler2D uImage;

            varying highp vec2 vTextureCoord;
            precision mediump float;
            void main(void) {
                vec4 pixelColor = texture2D(uImage, vTextureCoord);
                float average = (pixelColor.r + pixelColor.g + pixelColor.b) / 3.0;
                // Greyscale filter
                gl_FragColor = vec4(average, average, average, pixelColor.a);
            }
        `,
    },
    dampen: {
        vsSource: `
            attribute vec4 aVertexPosition;
            attribute vec2 aTextureCoord;

            varying highp vec2 vTextureCoord;

            void main(void) {
                gl_Position = aVertexPosition;
                vTextureCoord = aTextureCoord;
            }
        `,
        fsSource: `
            uniform sampler2D uImage;

            varying highp vec2 vTextureCoord;
            precision mediump float;
            void main(void) {
                vec4 pixelColor = texture2D(uImage, vTextureCoord);
                float average = (pixelColor.r + pixelColor.g + pixelColor.b) / 3.0;
                // Greyscale filter
                gl_FragColor = vec4(average, average, average, pixelColor.a);
            }
        `,
    },
    darken: {
        vsSource: `
            attribute vec4 aVertexPosition;
            attribute vec2 aTextureCoord;

            varying highp vec2 vTextureCoord;

            void main(void) {
                gl_Position = aVertexPosition;
                vTextureCoord = aTextureCoord;
            }
        `,
        fsSource: `
            uniform sampler2D uImage;

            varying highp vec2 vTextureCoord;
            precision mediump float;
            void main(void) {
                gl_FragColor = texture2D(uImage, vTextureCoord);
            }
        `,
    },
};

// Rewrite as a class, since there can be multiple instances
// See https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Animating_textures_in_WebGL
class Filterer {
    constructor() {
        this.video = null;                  // Set after init
        this.renderCanvas = null;           // Set after init
        this.gl = null;                     // Set after init
        this.copyVideo = false;             // Is set when frame data can be read from the video
        this.animationReq = null;
        this.config = null;                 // The right program config has to be loaded in init
    }

    set(value) {
        console.log('Filterer got set', value);
        
        if (value === true) {
            this.showCanvas();
        } else {
            this.hideCanvas();
        }
        
        if (value === true && this.animationReq === null && this.config !== null) {
            console.log('Set: Start rendering');
            this.animationReq = requestAnimationFrame(this.render.bind(this));
        } else if (this.animationReq !== null) {
            // The filter has been toggled off
            cancelAnimationFrame(this.animationReq);
            this.animationReq = null;
        }
    }

    getShaders(gl) {
        // Compile each shader program based on its sources
        // Return a program config containing the compiled program along with
        // attribute- and uniform locations
        // Can't reference sources from inside the object
        // Maybe separate the sources and the other properties
        const shaderPrograms = Object.keys(glSources).reduce((acc, current) => ({
            ...acc,
            [current]: this.initShaderProgram(gl, glSources[current].vsSource, glSources[current].fsSource),
        }), {});
        return {
            invert: {
                program: shaderPrograms.invert,
                attribLocations: {
                    vertexPosition: gl.getAttribLocation(shaderPrograms.invert, 'aVertexPosition'),
                    textureCoord: gl.getAttribLocation(shaderPrograms.invert, 'aTextureCoord'),
                },
                uniformLocations: {
                    image: gl.getUniformLocation(shaderPrograms.invert, 'uImage'),
                },
            },
            dampen: {
                program: shaderPrograms.dampen,
                attribLocations: {
                    vertexPosition: gl.getAttribLocation(shaderPrograms.dampen, 'aVertexPosition'),
                    textureCoord: gl.getAttribLocation(shaderPrograms.dampen, 'aTextureCoord'),
                },
                uniformLocations: {
                    image: gl.getUniformLocation(shaderPrograms.dampen, 'uImage'),
                },
            },
            darken: {
                program: shaderPrograms.darken,
                attribLocations: {
                    vertexPosition: gl.getAttribLocation(shaderPrograms.darken, 'aVertexPosition'),
                    textureCoord: gl.getAttribLocation(shaderPrograms.darken, 'aTextureCoord'),
                },
                uniformLocations: {
                    image: gl.getUniformLocation(shaderPrograms.darken, 'uImage'),
                },
            },
        };
    }

    showCanvas() {
        this.renderCanvas.style.visibility = 'visible';
        this.video.style.visibility = 'hidden';
    }
    
    hideCanvas() {
        this.renderCanvas.style.visibility = 'hidden';
        this.video.style.visibility = 'visible';
    }

    init(video, renderCanvas) {
        console.log('Initializing filterer');
        this.video = video;
        this.renderCanvas = renderCanvas;

        const gl = this.renderCanvas.getContext('webgl');

        if (gl === null || gl === undefined) {
            console.warn('Could not initialize WebGL');
        }
        this.gl = gl;

        // Since the script execution time compared to the video's load time
        // might be a bit different; listen to both playing(video just started playing)
        // and timeupdate. Because if the video started playing before the script
        // the filterer will run anyways with timeupdate
        const self = this;
        video.addEventListener('playing', function() {
            self.copyVideo = true;
        }, true);
       
        video.addEventListener('timeupdate', function() {
            self.copyVideo = true;
        }, true);

        // Add listeners for pause, waiting, and ended and set copyVideo to false
        // Otherwise warnings such as 'WebGL: INVALID_VALUE: tex(Sub)Image2D: video visible size is empty'
        // and 'WebGL: INVALID_VALUE: texImage2D: no video' may occur because
        // data can't be fetched when the video is paused, is buffering, or has ended
        video.addEventListener('pause', function() {
            console.log('Detected pause, not updating texture');
            self.copyVideo = false;
        }, true);
        
        video.addEventListener('waiting', function() {
            console.log('Detected pause, not updating texture');
            self.copyVideo = false;
        }, true);
        
        video.addEventListener('ended', function() {
            console.log('Detected pause, not updating texture');
            self.copyVideo = false;
        }, true);

        this.configs = this.getShaders(this.gl);
        this.buffers = this.initBuffers(this.gl);
        this.texture = this.initTexture(this.gl);

        chrome.storage.onChanged.addListener((changes, namespace) => {
            console.log('chrome.storage.onChanged', changes, namespace);
            for (const key in changes) {
                if (key === 'renderMode') {
                    // Change config
                    // New value available at changes[renderMode].newValue
                    console.log('Changing render config to', changes[key].newValue);
                    const newMode = changes[key].newValue;
                    self.config = self.configs[newMode];
                }
            }
        });

        video.addEventListener('loadeddata', (e) => {
            console.log('loadeddata: Video has loaded');
            // Video should now be loaded but we can add a second check
            if (video.readyState >= 3) {
                console.log('video readyState >=, updating texture');
                self.copyVideo = true;
                // Block requestAnimationFrame call until the initial setting has been found
                chrome.storage.sync.get(['renderMode'], function(result) {
                    // If result.renderMode is undefined then apply invert as default
                    if (result.renderMode === undefined || result.renderMode === null) {
                        console.log('filterer init: Could not find renderMode, applying default');
                        self.config = self.configs.invert;
                    }

                    console.log('Retrieved renderMode. Applying', result.renderMode);
                    self.config = self.configs[result.renderMode];
                    toggleAttacher.getDefaultState((toggleState) => {
                        console.log('GL init. Setting with toggleState', toggleState);
                        self.set(toggleState);
                    });
                });
            }
         });
    }

    initBuffers(gl) {
        // Create a buffer to put three 2d clip space points in
        const positionBuffer = gl.createBuffer();

        // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // Written as clip space coordinates to fill out the entire canvas
        const positions = [
            -1, -1,         // Bottom left corner
            1, -1,          // Bottom right corner
            -1, 1,          // Top left corner
            1, 1,           // Top right corner
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // Create buffer for texture coordinates
        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

        const textureCoordinates = [
            0.0,  1.0,          // Top left corner
            1.0,  1.0,          // Top right corner
            0.0,  0.0,          // Bottom left corner
            1.0,  0.0,          // Bottom right corner
        ];

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

        return {
            position: positionBuffer,
            textureCoord: textureCoordBuffer,
        };
    }

    initTexture(gl) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
      
        // Because video has to be download over the internet
        // they might take a moment until it's ready so
        // put a single pixel in the texture so we can
        // use it immediately.
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        const pixel = new Uint8Array([255, 0, 0, 255]);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);
      
        // Turn off mips and set  wrapping to clamp to edge so it
        // will work regardless of the dimensions of the video.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      
        return texture;
    }

    updateTexture (gl, texture, video) {
        const level = 0;
        const internalFormat = gl.RGBA;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, video);
    }

    render(timestamp) {
        if (this.copyVideo === true) {
            this.updateTexture(this.gl, this.texture, this.video);
        }

        // Ensure that the render mode config has been loaded
        if (this.config !== null) {
            // Depending on the value of the render mode the config should be changed
            this.drawScene(this.gl, this.config, this.buffers, this.texture);
        }

        this.animationReq = requestAnimationFrame(this.render.bind(this));
    }

    drawScene(gl, programConfig, buffers, texture) {
        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Tell WebGL how to pull out the positions from the position
        // buffer into the vertexPosition attribute
        {
            const numComponents = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
            gl.vertexAttribPointer(
                programConfig.attribLocations.vertexPosition,
                numComponents,
                type,
                normalize,
                stride,
                offset,
            );
            gl.enableVertexAttribArray(programConfig.attribLocations.vertexPosition);
        }

        // Tell WebGL how to pull out the texture coordinates from
        // the texture coordinate buffer into the textureCoord attribute.
        {
            const numComponents = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
            gl.vertexAttribPointer(
                programConfig.attribLocations.textureCoord,
                numComponents,
                type,
                normalize,
                stride,
                offset,
            );
            gl.enableVertexAttribArray(programConfig.attribLocations.textureCoord);
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Tell it to use our program (pair of shaders)
        gl.useProgram(programConfig.program);

        // Tell WebGL we want to affect texture unit 0
        gl.activeTexture(gl.TEXTURE0);

        // Bind the texture to texture unit 0
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Tell the shader we bound the texture to texture unit 0
        gl.uniform1i(programConfig.uniformLocations.image, 0);

        // Draw
        const primitiveType = gl.TRIANGLE_STRIP;
        const offset = 0;
        const count = 4;
        gl.drawArrays(primitiveType, offset, count);
    }

    /**
     * Initialize a shader program, so WebGL knows how to draw our data.
     */
    initShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
        // Create the shader program
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
    
        // If creating the shader program failed, alert
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            return null;
        }
    
        return shaderProgram;
    }

    /**
     * Creates a shader of the given type, uploads the source and
     * compiles it.
     */
    loadShader(gl, type, source) {
        const shader = gl.createShader(type);
    
        // Send the source to the shader object
        gl.shaderSource(shader, source);
    
        // Compile the shader program
        gl.compileShader(shader);
    
        // See if it compiled successfully
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
    
        return shader;
    }
}

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

const getStyle = (elem, attribute) => {
    if (elem.style && elem.style[attribute] !== '') {
        return elem.style[attribute];
    }

    // No inline style specified. Rely on the computed style
    return window.getComputedStyle(elem).getPropertyValue(attribute);
};

/**
 * Different from getStyle since computed style is irrelevant.
 * Because it often describes sizes in percentages etc,
 * when exact pixel sizes are of interest.
 * @param {*} video
 */
const getVideoSize = (video) => {
    let width;
    let height;
    if (video.style.width !== '' && video.style.width !== 'auto') {
        width = video.style.width;
    } else {
        width = video.offsetWidth;
    }

    if (video.style.height !== '' && video.style.height !== 'auto') {
        height = video.style.height;
    } else {
        height = video.offsetHeight;
    }

    return { width, height };
};

/**
 * @param {*} map a map with objects as values
 * @param {*} key
 * @param {*} properties an object with a number of properties
 */
const mapAppend = (map, key, properties) => {
    const prevValue = map.get(key);

    if (prevValue === undefined) {
        console.warn('Map append could not retrieve a value with key', key);
        return;
    }

    return map.set(key, { ...prevValue, ...properties });
};

// Adding the new container, moving the video element,
// causes the MutationObserver to run since it thinks a new video element
// has appeared. Resulting in an infinite loop because the video element
// is found once again in the MutationObserver
// Add a new state array with video nodes that have already been discovered and dealt
// Inspected holds broader objects that each maintain state for individual video nodes

// Even though querySelectorAll returns a static nodelist,
// it's only static in terms of if new elements can be added
// to the collection. It has nothing to do with static
// DOM references
// Therefore I can use a WeakMap and have a DOM element as key

// Removed toggled from inspected state. It's available as local state
// within the toggle's input checkbox

// Added id, as a simple 0+ identifier for checkbox identification
// Labels rely on input's id, which needs to be unique in a document
/**
 * inspected:
 * [videoNode]: {
 *  id,
 *  video,
 *  toggle,
 * }
 */
const inspected = new WeakMap();

// For some reason the toggle button attaches as an overlay on YouTube
// if you open the YouTube link in another tab
// However, it works as expected if you open the link within the same active tab
// It's because YouTube loads a "skeleton player" before it loads the page's content
// This player doesn't have a 'ytd-player' container
// The "skeleton player" doesn't have any real unique ids or classes to search for
// You can either rely on the page's URL or observe added elements

// Interestingly, the ytd-player element with id 'ytd-player' isn't
// recognized by MutationObservers
// What I did was to look closer into how SponsorBlock, another extension,
// applied their YouTube buttons to a video page. They relied on 'ytp-right-controls'
// which is also available for me on window load
// See https://github.com/ajayyy/SponsorBlock

// Continue monitering the DOM for changes, in particular, additions of video nodes
const videoObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        const addedNodes = [ ...mutation.addedNodes ];          // Converted to array for simplicity
        if (addedNodes.some((node) => node.tagName === 'VIDEO')) {
            console.log('Detected mutation; added video as element');
            
            findVideoNodes();
        }
    });
});

window.onload = () => {
    console.log('find_video_content_script.js window onload');
    findVideoNodes();
    // Observe if new videos are added
    videoObserver.observe(document, { childList: true, subtree: true });
};
