import React, { useEffect, useState } from 'react'

export default function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [updateInfo, setUpdateInfo] = useState(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    // Listen for update notifications
    const removeUpdateAvailableListener = window.electronAPI.onUpdateAvailable((info) => {
      console.log('Update available:', info)
      setUpdateInfo(info)
      setUpdateAvailable(true)
    })

    const removeUpdateDownloadedListener = window.electronAPI.onUpdateDownloaded((info) => {
      console.log('Update downloaded:', info)
      setUpdateInfo(info)
      setUpdateDownloaded(true)
      setDownloading(false)
    })

    return () => {
      // Cleanup listeners if needed
    }
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    await window.electronAPI.downloadUpdate()
  }

  const handleInstall = () => {
    window.electronAPI.installUpdate()
  }

  const handleDismiss = () => {
    setUpdateAvailable(false)
    setUpdateDownloaded(false)
  }

  if (!updateAvailable && !updateDownloaded) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-slide-up">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg shadow-2xl p-4 border border-purple-400">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              {updateDownloaded ? 'Update Ready!' : 'Update Available'}
            </h3>
            <p className="text-sm text-gray-100 mb-3">
              {updateDownloaded 
                ? `Version ${updateInfo?.version} is ready to install. Restart FocusBook to apply the update.`
                : `Version ${updateInfo?.version} is available. Would you like to download it?`
              }
            </p>
            
            <div className="flex gap-2">
              {updateDownloaded ? (
                <>
                  <button
                    onClick={handleInstall}
                    className="bg-white text-purple-600 px-4 py-2 rounded-md font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Restart & Install
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="bg-purple-700 text-white px-4 py-2 rounded-md hover:bg-purple-800 transition-colors"
                  >
                    Later
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="bg-white text-purple-600 px-4 py-2 rounded-md font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloading ? 'Downloading...' : 'Download'}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="bg-purple-700 text-white px-4 py-2 rounded-md hover:bg-purple-800 transition-colors"
                  >
                    Skip
                  </button>
                </>
              )}
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
