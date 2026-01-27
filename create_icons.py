from PIL import Image, ImageOps

def create_icon(input_path, output_path, size, bg_color):
    try:
        img = Image.open(input_path).convert("RGBA")
        
        # Calculate aspect ratio to fit within size while maintaining ratio
        img.thumbnail((int(size * 0.8), int(size * 0.8)), Image.LANCZOS)
        
        # Create a new image with the background color
        background = Image.new('RGBA', (size, size), bg_color)
        
        # Center the logo on the background
        offset = ((size - img.width) // 2, (size - img.height) // 2)
        background.paste(img, offset, img)
        
        # Save
        background.save(output_path)
        print(f"Created {output_path}")
    except Exception as e:
        print(f"Error creating {output_path}: {e}")

# Configuration
input_file = "public/logo.png"
blue_color = "#003366" # The NUST blue used in the app

create_icon(input_file, "public/logo192.png", 192, blue_color)
create_icon(input_file, "public/logo512.png", 512, blue_color)
create_icon(input_file, "public/favicon.ico", 64, blue_color)
