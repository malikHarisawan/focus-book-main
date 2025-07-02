import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync, cpSync } from 'fs'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      {
        name: 'copy-database-files',
        closeBundle() {
          const srcDir = resolve('src/main/database')
          const outDir = resolve('out/main/database')

          if (existsSync(srcDir)) {
            if (!existsSync(outDir)) {
              mkdirSync(outDir, { recursive: true })
            }

            cpSync(srcDir, outDir, { recursive: true })
            console.log(`Copied database directory from ${srcDir} to ${outDir}`)
          } else {
            console.error(`Database source directory not found: ${srcDir}`)
          }
        }
      }
    ]
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
