window.onload = () => {
    console.log('Browser action script loaded');

    const radios = document.modePicker.mode;
    console.log('radios', radios);
    let prev = null;

    // Load previous recorded mode from synced storage
    chrome.storage.sync.get(['renderMode'], function(result) {
        console.log('Retrieved renderMode value ' + result.renderMode);
        if (result.renderMode !== undefined && result.renderMode !== null) {
            console.log('Setting up checked checkbox');
            prev = result.renderMode;
            setInitialRadio(result.renderMode);
        } else {
            // Apply invert as default value
            prev = 'invert';
            chrome.storage.sync.set({ renderMode: 'invert' });
            setInitialRadio('invert');
        }
    });

    for (let i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function() {
            if (this.value && this.value !== prev) {
                prev = this.value;
                console.log(this.value)

                // Store new value
                chrome.storage.sync.set({ renderMode: this.value });
            }
        });
    }
};

const setInitialRadio = (renderMode) => {
    const activeRadio = document.getElementById(renderMode);
    console.log('Setting initial radio', activeRadio);
    activeRadio.checked = true;
};
