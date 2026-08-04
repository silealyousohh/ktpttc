import urllib.request
import urllib.error

file_id = "1yQZ_zUp_WZ5sa8IMvr6I6NiRUzmNY42t"

urls = {
    "uc_export": f"https://drive.google.com/uc?export=download&id={file_id}",
    "uc": f"https://drive.google.com/uc?id={file_id}",
    "lh3": f"https://lh3.googleusercontent.com/d/{file_id}",
    "thumbnail": f"https://drive.google.com/thumbnail?id={file_id}&sz=w1000"
}

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = urllib.request.build_opener(NoRedirect)
urllib.request.install_opener(opener)

for name, url in urls.items():
    print(f"Testing {name}: {url}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        print(f"  Status: {response.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"  Status: {e.code}")
        if e.code in (301, 302, 303, 307, 308):
            print(f"  Redirects to: {e.headers.get('Location')}")
    except Exception as e:
        print(f"  Error: {e}")
    print("-" * 40)

