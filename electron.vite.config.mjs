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
      },
      {
        name: 'copy-main-files',
        closeBundle() {
          const srcMainDir = resolve('src/main')
          const outMainDir = resolve('out/main')

          if (!existsSync(outMainDir)) {
            mkdirSync(outMainDir, { recursive: true })
          }

          // Copy popupManager.js specifically
          const popupManagerSrc = resolve(srcMainDir, 'popupManager.js')
          const popupManagerDest = resolve(outMainDir, 'popupManager.js')

          if (existsSync(popupManagerSrc)) {
            copyFileSync(popupManagerSrc, popupManagerDest)
            console.log(`Copied ${popupManagerSrc} to ${popupManagerDest}`)
          } else {
            console.error(`PopupManager file not found: ${popupManagerSrc}`)
          }

          // Copy aiServiceManager.js specifically
          const aiServiceManagerSrc = resolve(srcMainDir, 'aiServiceManager.js')
          const aiServiceManagerDest = resolve(outMainDir, 'aiServiceManager.js')

          if (existsSync(aiServiceManagerSrc)) {
            copyFileSync(aiServiceManagerSrc, aiServiceManagerDest)
            console.log(`Copied ${aiServiceManagerSrc} to ${aiServiceManagerDest}`)
          } else {
            console.error(`AI Service Manager file not found: ${aiServiceManagerSrc}`)
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

          // Copy popup.html
          const popupFile = resolve(srcDir, 'popup.html')
          const popupTarget = resolve(outDir, 'popup.html')

          if (existsSync(popupFile)) {
            copyFileSync(popupFile, popupTarget)
            console.log(`Copied ${popupFile} to ${popupTarget}`)
          }

          // Copy popup-enhanced.html
          const enhancedPopupFile = resolve(srcDir, 'popup-enhanced.html')
          const enhancedPopupTarget = resolve(outDir, 'popup-enhanced.html')

          if (existsSync(enhancedPopupFile)) {
            copyFileSync(enhancedPopupFile, enhancedPopupTarget)
            console.log(`Copied ${enhancedPopupFile} to ${enhancedPopupTarget}`)
          } else {
            console.error(`Enhanced popup file not found: ${enhancedPopupFile}`)
          }
        }
      }
    ]
  }
})
