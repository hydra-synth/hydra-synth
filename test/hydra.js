const {should, expect, assert} = require('chai')
const rewire = require('rewire')
const sinon = require('sinon')
const {JSDOM} = require('jsdom')

describe ('HydraSynth', () => {
    let HydraSynth
    let dom
    let canvas

    afterEach(() => {
        sinon.restore()
    })

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html>
<html>
    <head>
        <title></title>
    </head>
    <body>
        <canvas id="hydra-canvas" width="800" height="600"></canvas>
    </body>
</html>`)

        global.window = dom.window
        global.document = dom.window.document
        global.navigator = dom.window.navigator

        canvas = dom.window.document.querySelector('#hydra-canvas')
        canvas.captureStream = sinon.stub().returns(undefined)
        canvas.getContext = sinon.stub().returns({})

        global.navigator.mediaDevices = {
            getUserMedia: () => Promise.reject({name: 'not implemented / ignore'})
        }
        global.navigator.getUserMedia = sinon.mock().returns({})

        global.AudioContext = class {
            constructor () {
            }
            createMediaStreamSource () {
                return undefined
            }
        }

        global.MediaSource = class {
            constructor () {
            }
            addEventListener () {
                return undefined
            }
        }

        const cestub = sinon.stub(dom.window.document, 'createElement')

        cestub.withArgs('canvas').callsFake(
            function (...args) {
                const ret = cestub.wrappedMethod.apply(this, args)

                ret.getContext = sinon.stub().returns({})

                return ret
            }
        )
        cestub.callThrough()

        HydraSynth = require('../index')

        HydraSynth.prototype._initRegl = function () {
            this.regl = {
                buffer: () => {},
                prop: () => {},
                texture: () => {},
                framebuffer: () => {}
            },
            this.renderFbo = () => {},
            this.renderAll = () => {}
        }

    })

    it ('Sets up basic infrastructure', () => {
        const hydra = new HydraSynth({autoLoop: false, makeGlobal: false, canvas})

        expect(hydra)
            .to.be.an('object')
            .and.to.include.keys(['s', 'a', 'audio', 'bpm'])

        expect(hydra.bpm)
            .to.be.a('number')
            .and.to.be.equal(60)
    })

    describe ('makeGlobal', () => {
        it('Does not create global variables if set to false', () => {
            const prev_keys = Object.keys(global.window)

            const hydra = new HydraSynth({autoLoop: false, makeGlobal: false, canvas})

            const new_keys = Object.keys(global.window).filter(x => prev_keys.indexOf(x) < 0)

            expect(new_keys).to.have.lengthOf(0)
        })

        it('Creates expected global variables if set to true', () => {
            const transforms = require('../src/glsl/composable-glsl-functions')

            const prev_keys = Object.keys(global.window)

            const hydra = new HydraSynth({autoLoop: false, makeGlobal: true, canvas})

            const new_keys = Object.keys(global.window).filter(x => prev_keys.indexOf(x) < 0)

            expect(new_keys).to.be.an('array').and.to.include.members([
                ...Object.entries(transforms).filter(([, transform]) => transform.type === 'src').map(([name]) => name),
                ...Array(hydra.s.length).fill(1).map((_, i) => `s${i}`),
                ...Array(hydra.audio.bins.length).fill(1).map((_, i) => `a${i}`),
                'bpm', 'mouse', 'time', 'a', 'synth', 'render', 'screencap', 'vidRecorder'
            ])
        })
    })
})
