import json
import sys
from pywinauto.application import Application
from urllib.parse import urlparse

DISTRACTED_DOMAINS = [
    'facebook.com',
    'instagram.com',
    'twitter.com',
    'youtube.com',
    
]

def get_active_chrome_tab(pid):
    try:
        app = Application(backend='uia')
        app.connect(process=pid)
        dlg = app.top_window()
        url_bar = dlg.child_window(
            title="Address and search bar",
            control_type="Edit"
        )

        url = url_bar.get_value()
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        domain = urlparse(url).netloc
        
        if domain in DISTRACTED_DOMAINS:
            dlg.type_keys('^w')
            return {
                "window_title": dlg.window_text(),
            }
        return None

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    pid = int(sys.argv[1])  
    appname = str(sys.argv[2]) 
    DISTRACTED_DOMAINS.append(appname)
    result = get_active_chrome_tab(pid)
    print(json.dumps(result))