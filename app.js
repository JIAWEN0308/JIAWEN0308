setupXR() {
    this.renderer.xr.enabled = true;

    const btn = new VRButton(this.renderer);

    const self = this;
    const timeoutId = setTimeout(connectionTimeout, 2000);

    function onSelectStart(event) {
        this.userData.selectPressed = true;
    }

    function onSelectEnd(event) {
        this.userData.selectPressed = false;
    }

    function onConnected(event) {
        clearTimeout(timeoutId);
    }

    function connectionTimeout() {
        self.useGaze = true;
        self.gazeController = new GazeController(self.scene, self.dummyCam);
    }

    this.controllers = this.buildControllers(this.dolly);
    this.controllers.forEach((controller) => {
        controller.addEventListener('selectstart', onSelectStart);
        controller.addEventListener('selectend', onSelectEnd);
        controller.addEventListener('connected', onConnected);
    });

    // ✅ Username input UI using CanvasUI
    const config = {
        panelSize: { height: 0.4 },
        height: 256,
        username: {
            type: 'input',
            fontSize: 40,
            height: 60,
            position: { top: 40 },
            placeholder: 'Enter your name...',
            backgroundColor: '#ffffff',
            fontColor: '#000000'
        },
        submit: {
            type: 'button',
            fontSize: 30,
            height: 50,
            position: { top: 120 },
            backgroundColor: '#0088ff',
            fontColor: '#ffffff',
            onSelect: () => {
                const name = self.ui.getValue('username');
                console.log('User name:', name);
                alert('Welcome, ' + name + '!');
                self.userName = name;
                self.ui.visible = false;
            }
        }
    };

    const content = {
        username: '',
        submit: 'Submit'
    };

    this.ui = new CanvasUI(content, config);
    this.scene.add(this.ui.mesh);

    this.renderer.setAnimationLoop(this.render.bind(this));
}
