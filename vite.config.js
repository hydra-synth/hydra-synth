// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig(({ command, mode, ssrBuild }) => {
  const commonConfig = {
    root: 'src',
    build: {
      // minify: false,
      outDir: '../dist',
      lib: {
        // Could also be a dictionary or array of multiple entry points
        entry: resolve(__dirname, './src/index.js'),
        name: 'Hydra',
        // the proper extensions will be added
        fileName: 'hydra-synth',
        //fileName: (format) => format === 'es' ? 'hydra-synth.js' : 'umd/hydra-synth.js',
        formats: ['es', 'umd']
      },
      rollupOptions: {
        // make sure to externalize deps that shouldn't be bundled
        // into your library
        output: {
          // Provide global variables to use in the UMD build
          // for externalized deps
        },
      },
    },
  };
  if (command === 'serve') {
    return {
      ...commonConfig,
      define: {
        global: "window"
      },
  
    }
  } else {
    // command === 'build'
    return {
      ...commonConfig
    }
  }
})
