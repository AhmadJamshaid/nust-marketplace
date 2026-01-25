from PIL import Image
import os

def remove_black_background(input_path, output_path, tolerance=30):
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    print(f"Processing {input_path}...")
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # Check if pixel is close to black (RGB < tolerance)
        if item[0] < tolerance and item[1] < tolerance and item[2] < tolerance:
            newData.append((0, 0, 0, 0))  # Transparent
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")
    print(f"Success: Saved transparent logo to {output_path}")

if __name__ == "__main__":
    remove_black_background('public/logo.png', 'public/logo.png')
