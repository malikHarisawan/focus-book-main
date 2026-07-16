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
        // Like the preload does for its classification/ modules, the built main
        // process keeps `require('./classification/...')` as an external require
        // (externalizeDepsPlugin doesn't inline relative requires). So the pure
        // span-model engine files must be physically emitted next to the built main,
        // or main crashes on load with "Cannot find module './classification/...'".
        name: 'copy-main-classification',
        closeBundle() {
          const srcDir = resolve('src/main/classification')
          const outDir = resolve('out/main/classification')
          if (existsSync(srcDir)) {
            if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
            cpSync(srcDir, outDir, { recursive: true })
            console.log('Copied main classification files to', outDir)
          } else {
            console.error(`Main classification source directory not found: ${srcDir}`)
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

          // Copy browserBridge.js specifically (WebSocket URL-source bridge)
          const browserBridgeSrc = resolve(srcMainDir, 'browserBridge.js')
          const browserBridgeDest = resolve(outMainDir, 'browserBridge.js')

          if (existsSync(browserBridgeSrc)) {
            copyFileSync(browserBridgeSrc, browserBridgeDest)
            console.log(`Copied ${browserBridgeSrc} to ${browserBridgeDest}`)
          } else {
            console.error(`Browser Bridge file not found: ${browserBridgeSrc}`)
          }
        }
      }
    ]
  },
  preload: {
    plugins: [
      externalizeDepsPlugin(),
      {
        // electron-vite leaves `require('./classification/modeScorer')` in the built
        // preload as an external require (it does not inline relative requires under
        // externalizeDepsPlugin). So we must physically emit those files next to the
        // built preload, or it crashes on load (blank screen — window.activeWindow /
        // electronAPI never get exposed). This mirrors the copy-database-files plugin.
        name: 'copy-preload-classification',
        closeBundle() {
          const srcDir = resolve('src/preload/classification')
          const outDir = resolve('out/preload/classification')
          if (existsSync(srcDir)) {
            if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
            cpSync(srcDir, outDir, { recursive: true })
            console.log('Copied preload classification files to', outDir)
          }
        }
      }
    ]
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
