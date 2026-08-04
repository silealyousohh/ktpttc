import urllib.request
import urllib.error

file_id = "1yQZ_zUp_WZ5sa8IMvr6I6NiRUzmNY42t"

endpoints = {
    "uc": f"https://drive.google.com/uc?id={file_id}",
    "uc_download": f"https://drive.google.com/uc?id={file_id}&export=download",
    "lh3": f"https://lh3.googleusercontent.com/d/{file_id}",
    "thumbnail": f"https://drive.google.com/thumbnail?id={file_id}&sz=w1000"
}

for name, url in endpoints.items():
    print(f"Testing {name}: {url}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            print(f"  Status: {response.getcode()}")
            content_type = response.headers.get('Content-Type', '')
            print(f"  Content-Type: {content_type}")
            body = response.read(100)
            if b'html' in body.lower():
                print("  Body seems to be HTML (blocked or redirect page).")
            else:
                print("  Body seems to be image data.")
    except urllib.error.HTTPError as e:
        print(f"  HTTPError: {e.code} {e.reason}")
    except Exception as e:
        print(f"  Error: {e}")
    print("-" * 40)

