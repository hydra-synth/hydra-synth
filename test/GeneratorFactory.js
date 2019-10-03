/* eslint-env mocha */

const chai = require('chai')
const {assert} = chai
const Factory = require('../src/GeneratorFactory')

global.window = {}

const DummyOut = function () {
    this.renderPasses = (...args) => {
        // console.log("renderPasses: ", ...args)
        this.rendered = args
    }
    this.uniforms = []
    this.passes = []
    this.rendered = undefined
}

describe('GeneratorFactory', function () {
    describe('generated code', function () {

        it('looks as expected', function () {
            const out = new DummyOut()
            const factory = new Factory(out)

            factory.functions.shape(3).scale(2).modulate(factory.functions.shape(4).rotate(10)).out(out)

            let expected = 'gl_FragColor = shape(scale(modulate(st, shape(rotate(st, angle12, speed13), sides9, radius10, smoothing11), amount15), amount4, xMult5, yMult6, offsetX7, offsetY8), sides1, radius2, smoothing3)'
            assert.include(
                out.rendered[0][0].frag
                , expected
                , `Expected to find "${expected}" in fragment, but didn't. Fragment is:
${out.rendered[0][0].frag}`
            )
        })
    })
    describe('apply', function () {
        it('creates instances', function () {
            const out = new DummyOut()
            let factory = new Factory(out)

            factory.functions.shape(3).cseq(factory.functions.apply().scale(0, 2).floor().rotate(0, 1.01).scale(0, 1.1).mirrorY()).out(out)
            //let result = factory.functions.shape(3).apply(10, 10, 23).out(out)
            console.log(out.rendered[0][0].frag)
        })
    })
})
