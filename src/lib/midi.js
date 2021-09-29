'use babel'

export default class Midi {
    
    constructor() {
        this.reset();
    }

    start() {
        if (!this.started) {
            console.log('Connecting to WebMIDI.');
            this.started = true;
            navigator.requestMIDIAccess().then(midiAccess => {
                console.log('Connected to WebMIDI.');
                this.midi = midiAccess;
                this.midi.onstatechange = this.stateChange;
                this.midi.mapInputs = this.mapInputs;
                this.midi.ccArray = this.ccArray;
                this.midi.mapInputs();
            }, () => {
                console.log('Failed to connect to WebMIDI');
            });
        }
    }

    reset() {
        this.ccArray = Array(128).fill(0.5);
        this.started = false;
        if (this.midi != null) {
            this.midi.onstatechange = null;
        }
        this.midi = null;
    }

    mapInputs()
    {
        Array.from(this.inputs).forEach(input => {
            input[1].onmidimessage = (message) => {
                var dataArray = message.data;
                var index = dataArray[1];
                //console.log('Midi received on cc#' + index + ' value:' + dataArray[2]);    // uncomment to monitor incoming Midi
                var value = (dataArray[2] + 1) / 128.0;  // normalize CC values to 0.0 - 1.0
                this.ccArray[index] = value;
            }
        })
    }

    stateChange(message) {
        console.log(`MIDI device: ${message.port.name} state: ${message.port.state}`);
        if (message.port.state === 'connected') {
            this.mapInputs();
        }
    };

    get cc() {
        // we connect lazily to WebMidi
        this.start();
        // AKAI is cc1 - cc8
        //console.log('Index:' + index + ' Value:' + this.cc[index]);
        return this.ccArray;
    }
}
