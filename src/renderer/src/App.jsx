
import React from "react";
import ScreenTimePage from "./components/ScreenTimePage";
//const ipcHandle = () => window.electron.ipcRenderer.send('ping')

function App() {
  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <ScreenTimePage />
    </div>
  );
}

export default App;

