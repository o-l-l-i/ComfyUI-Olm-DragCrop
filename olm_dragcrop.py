import torch
import numpy as np
from PIL import Image
import os
from folder_paths import get_temp_directory

DEBUG_MODE = False


def debug_print(*args, **kwargs):
    if DEBUG_MODE:
        print(*args, **kwargs)


class OlmDragCrop:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "drawing_version": ("STRING", {"default": "init"}),
                "image": ("IMAGE",),
                "crop_left": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "crop_right": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "crop_top": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "crop_bottom": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "crop_width": ("INT", {"default": 512, "min": 1, "max": 8192}),
                "crop_height": ("INT", {"default": 512, "min": 1, "max": 8192}),
                "last_width": ("INT", {"default": 0}),
                "last_height": ("INT", {"default": 0}),
                "fixed_size_enabled": ("BOOLEAN", {"default": False}),
                "fixed_size_preset": (["Custom", "720x1280", "1280x720", "1024x1024", "512x512", "768x768", "1024x768", "768x1024", "1920x1080", "1080x1920", "1280x960", "960x1280", "640x480", "480x640"], {"default": "Custom"}),
                "fixed_width": ("INT", {"default": 512, "min": 1, "max": 8192}),
                "fixed_height": ("INT", {"default": 512, "min": 1, "max": 8192}),
            },
            "optional": {"mask": ("MASK",)},
            "hidden": {
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    FUNCTION = "crop"
    CATEGORY = "image/transform"

    def crop(
        self,
        drawing_version,
        image: torch.Tensor,
        crop_left: int,
        crop_right: int,
        crop_top: int,
        crop_bottom: int,
        crop_width: int,
        crop_height: int,
        last_width: int,
        last_height: int,
        fixed_size_enabled: bool,
        fixed_size_preset: str,
        fixed_width: int,
        fixed_height: int,
        node_id=None,
        mask=None,
    ):
        debug_print("=" * 60)
        print(f"[DragCrop] Node {node_id} executed (Backend)")

        batch_size, current_height, current_width, channels = image.shape

        debug_print("\n[Input Image Info]")
        debug_print(f"- Current image size: {current_width}x{current_height}")
        debug_print(f"- Last image size:    {last_width}x{last_height}")
        debug_print(f"- Batch size: {batch_size}, Channels: {channels}")

        resolution_changed = (
            current_width != last_width or current_height != last_height
        )
        reset_frontend_crop = False

        if resolution_changed:
            debug_print("\n[Resolution Change Detected]")
            debug_print("→ Forcing full image crop and signaling frontend reset.")
            crop_left = 0
            crop_top = 0
            crop_right = 0
            crop_bottom = 0
            crop_width = current_width
            crop_height = current_height
            reset_frontend_crop = True

        # Handle fixed size mode
        if fixed_size_enabled:
            debug_print("\n[Fixed Size Mode Enabled]")
            # Parse preset sizes
            if fixed_size_preset != "Custom":
                parts = fixed_size_preset.split("x")
                if len(parts) == 2:
                    preset_width = int(parts[0])
                    preset_height = int(parts[1])
                    fixed_width = preset_width
                    fixed_height = preset_height
                    debug_print(f"→ Using preset: {fixed_width}x{fixed_height}")
            
            debug_print(f"→ Target fixed size: {fixed_width}x{fixed_height}")
            
            # Only center the crop if it's a resolution change or initial crop
            # Otherwise, preserve the user's position
            should_center = resolution_changed or (crop_left == 0 and crop_top == 0 and crop_width == current_width and crop_height == current_height)
            
            if should_center:
                # Center the fixed size crop in the image for initial placement
                center_x = current_width // 2
                center_y = current_height // 2
                
                # Calculate crop boundaries ensuring we don't exceed image bounds
                half_fixed_width = min(fixed_width // 2, current_width // 2)
                half_fixed_height = min(fixed_height // 2, current_height // 2)
                
                crop_left = max(0, center_x - half_fixed_width)
                crop_top = max(0, center_y - half_fixed_height)
                debug_print("→ Centering crop (initial placement or resolution change)")
                reset_frontend_crop = True
            else:
                # Keep the existing position, just enforce the fixed size
                debug_print(f"→ Preserving position: {crop_left},{crop_top}")
            
            # Ensure the crop doesn't exceed image boundaries
            if crop_left + fixed_width > current_width:
                crop_left = max(0, current_width - fixed_width)
            if crop_top + fixed_height > current_height:
                crop_top = max(0, current_height - fixed_height)
            
            # Ensure we don't have negative coordinates
            crop_left = max(0, crop_left)
            crop_top = max(0, crop_top)
            
            # Calculate the actual crop dimensions (may be smaller if image is smaller than target)
            actual_crop_width = min(fixed_width, current_width - crop_left)
            actual_crop_height = min(fixed_height, current_height - crop_top)
            
            crop_width = actual_crop_width
            crop_height = actual_crop_height
            crop_right = current_width - crop_left - crop_width
            crop_bottom = current_height - crop_top - crop_height
            
            debug_print(f"→ Applied fixed size crop: {crop_left},{crop_top} size {crop_width}x{crop_height}")

        debug_print("\n[Crop Inputs]")
        debug_print(f"- crop_left:            {crop_left}")
        debug_print(f"- crop_right:           {crop_right}")
        debug_print(f"- crop_top:             {crop_top}")
        debug_print(f"- crop_bottom:          {crop_bottom}")
        debug_print(f"- crop_width:           {crop_width}")
        debug_print(f"- crop_height:          {crop_height}")
        debug_print(f"- Computed crop_right:  {crop_right}")
        debug_print(f"- Computed crop_bottom: {crop_bottom}")

        computed_crop_right = crop_left + crop_width
        computed_crop_bottom = crop_top + crop_height

        if (
            crop_left < 0
            or crop_top < 0
            or computed_crop_right > current_width
            or computed_crop_bottom > current_height
            or crop_width <= 0
            or crop_height <= 0
        ):
            print("\n[Error] Invalid crop area → Resetting to full image.")
            crop_left = 0
            crop_top = 0
            crop_right = 0
            crop_bottom = 0
            crop_width = current_width
            crop_height = current_height
            computed_crop_right = crop_left + crop_width
            computed_crop_bottom = crop_top + crop_height
            reset_frontend_crop = True

        cropped_image = image[
            :, crop_top:computed_crop_bottom, crop_left:computed_crop_right, :
        ]

        cropped_mask = None

        if mask is not None:
            cropped_mask = mask[
                :, crop_top:computed_crop_bottom, crop_left:computed_crop_right
            ]
        else:
            cropped_mask = torch.zeros(
                (batch_size, crop_height, crop_width),
                dtype=image.dtype,  # or torch.float32 if you prefer
                device=image.device,
            )

        debug_print(f"- Computed crop_right:  {computed_crop_right}")
        debug_print(f"- Computed crop_bottom: {computed_crop_bottom}")

        output_width = crop_width
        output_height = crop_height

        debug_print("\n[Output Crop Info]")
        debug_print(f"- Output size: {output_width}x{output_height}")
        debug_print(f"- Reset frontend crop UI: {reset_frontend_crop}")
        debug_print("=" * 60)

        original_filename = None
        if batch_size > 0:
            img_array = (image[0].cpu().numpy() * 255).astype(np.uint8)
            pil_image = Image.fromarray(img_array)
            temp_dir = get_temp_directory()
            filename_hash = hash(f"{node_id}_{current_width}x{current_height}")
            original_filename = f"dragcrop_original_{filename_hash}.png"
            filepath = os.path.join(temp_dir, original_filename)
            os.makedirs(temp_dir, exist_ok=True)
            try:
                pil_image.save(filepath)
            except Exception as e:
                print(f"[DragCrop] Error saving preview image: {e}")
                original_filename = None

        crop_info_for_frontend = {
            "left": crop_left,
            "top": crop_top,
            "right": crop_right,
            "bottom": crop_bottom,
            "width": crop_width,
            "height": crop_height,
            "original_size": [current_width, current_height],
            "cropped_size": [crop_width, crop_height],
            "reset_crop_ui": reset_frontend_crop,
            "fixed_size_enabled": fixed_size_enabled,
            "fixed_size_preset": fixed_size_preset,
            "fixed_width": fixed_width,
            "fixed_height": fixed_height,
        }

        return {
            "ui": {
                "images_custom": (
                    [{"filename": original_filename, "subfolder": "", "type": "temp"}]
                    if original_filename
                    else []
                ),
                "crop_info": [crop_info_for_frontend],
            },
            "result": (cropped_image, cropped_mask),
        }


NODE_CLASS_MAPPINGS = {
    "OlmDragCrop": OlmDragCrop,
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "OlmDragCrop": "Olm Drag Crop",
}


WEB_DIRECTORY = "./web"
