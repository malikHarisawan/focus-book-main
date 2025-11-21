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

def get_active_chrome_tab(pid, target_domain):
    try:
        app = Application(backend='uia')
        app.connect(process=pid)
        dlg = app.top_window()
        url_bar = dlg.child_window(control_type="Edit")

        url = url_bar.get_value()
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        current_domain = urlparse(url).netloc
        
        # Check if current tab matches target domain or is in predefined distracted domains
        target_parsed = urlparse(target_domain if target_domain.startswith(('http://', 'https://')) else 'https://' + target_domain)
        target_domain_clean = target_parsed.netloc or target_domain
        
        if current_domain == target_domain_clean or current_domain in DISTRACTED_DOMAINS:
            dlg.type_keys('^w')  # Ctrl+W to close tab
            return {
                "success": True,
                "closed_domain": current_domain,
                "window_title": dlg.window_text(),
            }
        return {"success": False, "reason": f"Current domain '{current_domain}' does not match target '{target_domain_clean}'"}

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    pid = int(sys.argv[1])  
    target_domain = str(sys.argv[2]) 
    result = get_active_chrome_tab(pid, target_domain)
    print(json.dumps(result))