from PIL import Image
import os

def crop_logo(path):
    try:
        if not os.path.exists(path):
            print(f"File not found: {path}")
            return

        img = Image.open(path)
        img = img.convert("RGBA")
        
        # Get the bounding box of the non-zero regions
        bbox = img.getbbox()
        
        if bbox:
            # Crop to the bounding box
            cropped_img = img.crop(bbox)
            
            # Save the result, overwriting the original
            cropped_img.save(path)
            print(f"Successfully cropped {path} to content bounding box: {bbox}")
        else:
            print("Image is completely transparent, nothing to crop.")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    crop_logo('public/logo.png')
