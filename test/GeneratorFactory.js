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

describe("GeneratorFactory", function () {
    describe("generated code", function () {

        it("looks like expected", function () {
            const out = new DummyOut()
            let factory = new Factory(out)

            let result = factory.functions.shape(3).scale(2).out(out)

            let expected = "gl_FragColor = shape(scale(st, amount4, xMult5, yMult6, offsetX7, offsetY8), sides1, radius2, smoothing3)";
            assert.include(
                out.rendered[0][0].frag
                , expected
                , `Expected to find "${expected}" in fragment, but didn't. Fragment is
${out.rendered[0][0].frag}`
            )
        })
    })
})
