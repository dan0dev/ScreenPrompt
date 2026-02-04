"""
Generate ICO file from PNG source for ScreenPrompt.
Converts icon-512.png to multi-resolution ICO format.
"""

from PIL import Image
import os

def create_icon():
    """Create a multi-resolution ICO file from icon-512.png."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(os.path.dirname(script_dir), 'assets')

    # Source PNG (use 512px version for best quality)
    png_path = os.path.join(assets_dir, 'icon-512.png')
    ico_path = os.path.join(assets_dir, 'icon.ico')

    if not os.path.exists(png_path):
        print(f"Error: Source PNG not found at {png_path}")
        print("Please ensure icon-512.png exists in the assets folder.")
        return None

    # Load source image
    source = Image.open(png_path)

    # Ensure RGBA mode for transparency
    if source.mode != 'RGBA':
        source = source.convert('RGBA')

    # ICO sizes (Windows standard sizes)
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = []

    for size in sizes:
        # Resize with high-quality resampling
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        images.append(resized)

    # Save as ICO with multiple sizes
    images[0].save(
        ico_path,
        format='ICO',
        sizes=[(s, s) for s in sizes],
        append_images=images[1:]
    )

    print(f"Icon created: {ico_path}")
    print(f"Sizes: {sizes}")
    return ico_path


if __name__ == "__main__":
    create_icon()
