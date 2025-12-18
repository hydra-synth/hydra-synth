import {Parser} from "acorn";
import {generate}  from "astring";
import { defaultTraveler, attachComments, makeTraveler } from 'astravel';
import { SyntaxError as HydraSyntaxError } from './lib/hydra-error.js';

const watchListArray = ["time", "fps", "speed", "bpm"];
const watchList = new Set(watchListArray);

// Line offset from wrapper: 'async function* f() {\n' adds 1 line
const WRAPPER_LINE_OFFSET = 1;

// Function to convert all instances of global variables on the watchlist to be
// preceeded by a prefix like "_h.", which converts from a global variable to a member expression
// We do all this because the JS function creator captures primitive types as
// initial values rather than as changeable variables.

function Deglobalize(textIn, prefix) {
	 const ignore = Function.prototype;
	 // filter-out "zero length space" characters.
	 let textCleaned = textIn.replace(/[\u200B-\u200D\uFEFF]/g, '');
	 let text = 'async function* f() {\n' + textCleaned + '\n}'; // Hack to get acorn to accept yield statement.
	 let traveler = makeTraveler({
  	go: function(node, state) {
        if (node.type === 'Identifier') {
					if (watchList.has(node.name)) {
            	state.refTab.push(node);
       		 }
      }
        // Call the parent's `go` method
        this.super.go.call(this, node, state);
      },
     //MemberExpression: ignore
    });

        // Parse to AST
   var comments = [];
   let ast;
   try {
     ast = Parser.parse(text, {
     			locations: true,  // Enable location tracking for error reporting
     			ecmaVersion: "latest",
     			allowReserved: true,
     			allowAwaitOutsideFunction: true,
          onComment: comments
        }
      );
   } catch (err) {
    // Adjust line number for the wrapper we added
    const line = err.loc ? err.loc.line - WRAPPER_LINE_OFFSET : null;
    const column = err.loc ? err.loc.column : null;

    // Extract a snippet around the error for context
    const lines = textCleaned.split('\n');
    const errorLine = line && line > 0 && line <= lines.length ? lines[line - 1] : null;

    throw new HydraSyntaxError(err.message, {
      line,
      column,
      source: errorLine,
      originalError: err
    });
  }
		let state = {
    	refTab: []
		}
				// find the places to change.
    		traveler.go(ast, state);
 
    		// If none found, just return the input.
    	 if (state.refTab.length === 0) return textCleaned;

			 for (let i = 0; i < state.refTab.length; ++i) {
			 		let node = state.refTab[i];
			 		let vn = node.name;
			 		// Transform Identifier node into MemberExpression node
			 		node.type = "MemberExpression";
			 		delete node.name;
			 		node.object = {type: "Identifier", name: prefix};
			 		node.property = {type: "Identifier", name: vn};
			 		node.computed = false;
			 		node.optional = false;
			 }

        // Put the comments back.
        //attachComments(ast, comments);
        let regen = generate(ast);
        
        return stripOutStuff(regen);
}

function stripOutStuff(inp) {
	  // get rid of the async function at the front and that final '}'.
	  let firstX = inp.indexOf('{');
    let lastX = inp.lastIndexOf('}');
    if (firstX === -1 || lastX === -1) return inp;
    let outp = inp.substring(firstX + 1, lastX);
    return outp;
}


export {Deglobalize}