import json
import sys
from pywinauto.application import Application
from urllib.parse import urlparse

def get_active_chrome_tab(pid):
    try:
        app = Application(backend='uia')
        app.connect(process=pid)

        dlg = app.top_window()
        url_bar = dlg.child_window(control_type="Edit")

        url = url_bar.get_value()
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        active_app = urlparse(url).netloc
        return {
            "active_app": active_app,
            "app_name": "chrome.exe",
            "window_title": dlg.window_text()
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    pid = int(sys.argv[1])  
    result = get_active_chrome_tab(pid)
    print(json.dumps(result))  
