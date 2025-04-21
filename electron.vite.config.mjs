import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      react(),
      {
        name: 'copy-html-files',
        closeBundle() {
          const srcDir = resolve('src/renderer')
          const outDir = resolve('out/renderer')
          
          if (!existsSync(outDir)) {
            mkdirSync(outDir, { recursive: true })
          }
          
          const sourceFile = resolve(srcDir, 'popup.html')
          const targetFile = resolve(outDir, 'popup.html')
          
          if (existsSync(sourceFile)) {
            copyFileSync(sourceFile, targetFile)
            console.log(`Copied ${sourceFile} to ${targetFile}`)
          } else {
            console.error(`Source file not found: ${sourceFile}`)
          }
        }
      }
    ]
  }
})