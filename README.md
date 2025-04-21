# electron-app

An Electron application with React



Step 1. ### Install

```bash
$ npm install
```


Step 2. ### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

Step 3. ### Development

```bash
$ npm run dev
```

Step 4. ### Artefact

```bash
$ npx @electron/packager . focusbook --platform=win32 --arch=x64 --icon=icon.ico --overwrite

```

Step 5. ### Installer for exe
```bash
$ node createInstaller.js
```
