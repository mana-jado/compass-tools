import os
import json
import requests
import time

def download_cards():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up one level since script is now in scripts/ folder
    project_root = os.path.dirname(base_dir)
    json_path = os.path.join(project_root, 'data', 'card.json')
    output_dir = os.path.join(project_root, 'assets', 'images', 'cards')

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"Reading card data from {json_path}...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            cards = json.load(f)
    except Exception as e:
        print(f"Error reading json: {e}")
        return

    print(f"Found {len(cards)} cards. Starting download...")

    success_count = 0
    fail_count = 0
    skipped_count = 0

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    for i, card in enumerate(cards):
        rank = card.get('rank')
        rarity = card.get('rarity')
        img_id = card.get('img')
        name = card.get('name')

        if not (rank and rarity and img_id):
            print(f"Skipping invalid card data: {name}")
            continue

        filename = f"{rank}_{rarity}{img_id}.jpg"
        filepath = os.path.join(output_dir, filename)

        if os.path.exists(filepath):
            # print(f"Exists: {filename}")
            skipped_count += 1
            continue

        url = f"https://yagitools.cloudfree.jp/compas-deck/img/card/{rank}_{rarity}{img_id}.jpg"
        
        try:
            print(f"Downloading {i+1}/{len(cards)}: {name} -> {filename}")
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                success_count += 1
                time.sleep(0.1) # Be nice to the server
            else:
                print(f"Failed to download {url}: Status {response.status_code}")
                fail_count += 1
        except Exception as e:
            print(f"Exception downloading {url}: {e}")
            fail_count += 1

    print("-" * 30)
    print(f"Download complete.")
    print(f"Success: {success_count}")
    print(f"Skipped (Already exists): {skipped_count}")
    print(f"Failed: {fail_count}")

if __name__ == "__main__":
    download_cards()
