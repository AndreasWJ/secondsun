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
        if (node !== undefined && !inspected.includes(node)) {
            inspected.push(node);
            attach(node);
        }
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
        const renderCanvas = document.createElement('canvas');
        renderCanvas.id = 'ss-render-canvas';
        video.parentNode.insertBefore(renderCanvas, video.nextSibling);

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

// See https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Animating_textures_in_WebGL
const filterer = {
    getShaders: function(gl) {
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
    },

    init: function(video, renderCanvas) {
        console.log('Initializing filterer', video, renderCanvas);
        this.video = video;
        this.renderCanvas = renderCanvas;
        // this.renderContext = renderCanvas.getContext('2d');
        // Save a reference to a bound timerCallback
        // this.timerCallback = this.timerCallback.bind(this);
        /* const cWorker = renderCanvas.transferControlToOffscreen();
        this.worker = new Worker("filter_worker.js");
        this.worker.postMessage({ canvas: cWorker }, [cWorker]);

        // Call method that repetedly computes frame
        const self = this;
        this.video.addEventListener('play', function() {
            requestAnimationFrame(self.timerCallback);
            // self.timerCallback();
        }, false); */

        const gl = this.renderCanvas.getContext('webgl');

        if (gl === null || gl === undefined) {
            console.warn('Could not initialize WebGL');
        }

        // The canvas won't be cleared upon initialization because the canvas
        // has not been loaded just like the video hasn't been loaded
        // console.log('Clearing WebGL canvas');
        // this.gl.clearColor(1.0, 0.0, 0.0, 1.0);
        // this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // TODO: Add the rest of WebGL functionality by adding a 2D texture
        // Update the texture image each frame
        // TODO: Apply filters through convulation matrices in the fragment shader

        // Since the script execution time compared to the video's load time
        // might be a bit different; listen to both playing(video just started playing)
        // and timeupdate. Because if the video started playing before the script
        // the filterer will run anyways with timeupdate
        // TODO: Remove listener once one fires
        const self = this;
        video.addEventListener('playing', function() {
            self.copyVideo = true;
        }, true);
       
        video.addEventListener('timeupdate', function() {
            self.copyVideo = true;
        }, true);

        // Initialize shader programs for all available shader configurations
        // Go through each shader key; for example invert, dampen, darken
        // For each key, fetch its configuration, and add the compiled shader
        // program as one of its properties
        /* this.configs = Object.keys(this.getShaders(gl)).reduce((acc, modeConfig, i, shaders) => ({
            ...acc,
            [modeConfig]: this.compileShaderConfig(gl, shaders[modeConfig]),
        }), {}); */
        this.configs = this.getShaders(gl);
        this.buffers = this.initBuffers(gl);
        this.texture = this.initTexture(gl);

        chrome.storage.onChanged.addListener((changes, namespace) => {
            console.log('chrome.storage.onChanged', changes, namespace);
            for (key in changes) {
                if (key === 'renderMode') {
                    // Change config
                    // New value available at changes[renderMode].newValue
                    console.log('Changing render config to', changes[key].newValue);
                    const newMode = changes[key].newValue;
                    self.config = self.configs[newMode];
                }
            }
        });

        // Block requestAnimationFrame call until the initial setting has been found
        chrome.storage.sync.get(['renderMode'], function(result) {
            // If result.renderMode is undefined then apply invert as default
            if (result.renderMode === undefined || result.renderMode === null) {
                console.log('filterer init: Could not find renderMode, applying default');
                self.config = self.configs.invert;
            }

            console.log('Retrieved renderMode. Applying', result.renderMode);
            self.config = self.configs[result.renderMode];
            requestAnimationFrame((timestamp) => self.render(timestamp, gl));
        });
    },

    initBuffers: function(gl) {
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
    },

    initTexture: function(gl) {
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
    },

    updateTexture: function (gl, texture, video) {
        const level = 0;
        const internalFormat = gl.RGBA;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, video);
    },

    render: function(timestamp, gl) {
        if (this.copyVideo === true) {
            this.updateTexture(gl, this.texture, this.video);
        }

        // Depending on the value of the render mode the config should be changed
        this.drawScene(gl, this.config, this.buffers, this.texture);

        requestAnimationFrame((timestamp) => this.render(timestamp, gl));
    },

    drawScene: function(gl, programConfig, buffers, texture) {
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
    },

    /**
     * Initialize a shader program, so WebGL knows how to draw our data
     */
    initShaderProgram: function(gl, vsSource, fsSource) {
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
    },

    /**
     * Creates a shader of the given type, uploads the source and
     * compiles it.
     */
    loadShader: function(gl, type, source) {
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
    },

    computeFrame: function() {
        // console.log('computeFrame', this.video, this.video.style.width, this.video.style.height);
        const { width: vWidth, height: vHeight } = getVideoSize(this.video);
        this.renderContext.drawImage(this.video, 0, 0, parseInt(vWidth, 10), parseInt(vHeight, 10));
        // Error at getImageData, says source width is equal to 0
        // 'this.video.width' and 'this.video.height' are both equal to 0 because
        // the video source has yet to load
        // TODO: Get inline style. If not available get computed style
        // What to do if the computed style is not set either?
        // The computed style in the case of YouTube is set in percentages
        // I think the canvas methods will interpret it as 100px instead of 100%
        // Maybe it's possible to get the parent element's size and multiply with 100% to get the
        // child's size
        // It seems like you can use offsetWidth and offsetHeight as a fallback if no
        // explicit inline size has been set
        // console.log('frame width height', vWidth, vHeight);
        const frame = this.renderContext.getImageData(0, 0, parseInt(vWidth, 10), parseInt(vHeight, 10));
        this.renderContext.clearRect(0, 0, parseInt(vWidth, 10), parseInt(vHeight, 10));
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

// Adding the new container, moving the video element,
// causes the MutationObserver to run since it thinks a new video element
// has appeared. Resulting in an infinite loop because the video element
// is found once again in the MutationObserver
// Add a new state array with video nodes that have already been discovered and dealt
// Inspected holds broader objects that each maintain state for individual video nodes
const inspected = [];

// TODO: Make a toggle boolean for each video node that's toggleable through the button
// Will make it easier to see framerate differences caused by image manipulations

// TODO: For some reason the toggle button attaches as an overlay on YouTube
// if you open the YouTube link in another tab
// However, it works as expected if you open the link within the same active tab

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
