class Midi {
    constructor () {
        this.ccArray = Array(128).fill(0.5);
        this.started = false;
    }

    start() {
        this.started = true;
        navigator.requestMIDIAccess({sysex : false, software : false}).then(midiAccess => {
            console.log('Connected to WebMIDI.');
            this.midi = midiAccess;
            this.midi.onstatechange = this.stateChange;
            this.midi.mapInputs = this.mapInputs;
            this.midi.ccArray = this.ccArray;
            for (let input of this.midi.inputs.values()) {
                input.open();
            }
        }, () => {
            console.log('Failed to connect to WebMIDI, WebMIDI is not supported on all browsers yet: https://developer.mozilla.org/en-US/docs/Web/API/MIDIAccess');
        });
    }

    mapInputs() {
        for (let input of this.inputs.values()) {
            input.onmidimessage = (message) => {
                const data = message.data; // Uint8Array in the case of cc, cc id is data[1] and cc value is data[2]
                const index = data[1];
                const value = data[2] / 127.0;  // CC values are from 0 to 127, normalised here to 0.0 - 1.0
                //console.log(`Midi received on cc# ${index} raw value: ${data[2]}, normalised value: ${value}`);    // uncomment to monitor incoming Midi
                this.ccArray[index] = value;
            }
        }
    }

    stateChange(message) {
        console.log(`stateChange MIDI device: '${message.port.name}', state: '${message.port.state}', connection: '${message.port.connection}'`);
        if (message.port.connection === 'open') {
            this.mapInputs();
        }
        else if (message.port.connection === 'closed') {
            message.port.open();
        }
    };

    // get cc value scaled between range limit1 and limit2
    cc(index, limit1 = 1.0, limit2 = null) {
        // we connect to WebMidi lazily 
        if (!this.started) {
            this.start();
        }

        if (limit2 === null) {
            // If only limit1 is set assume range 0.0 -> limit1
            limit2 = limit1;
            limit1 = 0.0;
        }
        // otherwise assume range limit1 -> limit2
        
        const scale = (index, min, max) => (this.ccArray[index] * (max - min) + min);
        return scale.bind(null, index, limit1, limit2);
    }
}

module.exports = Midi