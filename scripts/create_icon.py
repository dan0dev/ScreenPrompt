"""
Generate a simple icon for ScreenPrompt.
Creates a modern-looking 'S' icon with a gradient background.
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon():
    """Create a multi-resolution ICO file for ScreenPrompt."""
    sizes = [16, 32, 48, 64, 128, 256]
    images = []

    for size in sizes:
        # Create image with transparent background
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw rounded rectangle background (dark blue gradient effect)
        margin = size // 8
        corner_radius = size // 4

        # Background colors (dark theme)
        bg_color = (45, 45, 60, 255)  # Dark blue-gray
        accent_color = (100, 150, 255, 255)  # Light blue accent

        # Draw rounded rectangle
        draw.rounded_rectangle(
            [margin, margin, size - margin, size - margin],
            radius=corner_radius,
            fill=bg_color
        )

        # Draw "S" letter
        try:
            # Try to use a nice font
            font_size = int(size * 0.55)
            font = ImageFont.truetype("segoeui.ttf", font_size)
        except (OSError, IOError):
            try:
                font = ImageFont.truetype("arial.ttf", font_size)
            except (OSError, IOError):
                # Fallback to default
                font = ImageFont.load_default()

        text = "S"

        # Get text bounding box for centering
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        x = (size - text_width) // 2
        y = (size - text_height) // 2 - bbox[1]

        # Draw text with accent color
        draw.text((x, y), text, fill=accent_color, font=font)

        # Add subtle highlight line at top
        if size >= 32:
            highlight_y = margin + corner_radius // 2
            draw.line(
                [(margin + corner_radius, highlight_y),
                 (size - margin - corner_radius, highlight_y)],
                fill=(255, 255, 255, 50),
                width=max(1, size // 32)
            )

        images.append(img)

    # Save as ICO
    script_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(os.path.dirname(script_dir), 'assets')
    os.makedirs(assets_dir, exist_ok=True)

    ico_path = os.path.join(assets_dir, 'icon.ico')

    # Save with multiple sizes
    images[0].save(
        ico_path,
        format='ICO',
        sizes=[(s, s) for s in sizes],
        append_images=images[1:]
    )

    print(f"Icon created: {ico_path}")
    return ico_path

if __name__ == "__main__":
    create_icon()
