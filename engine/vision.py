import cv2
import numpy as np
from PIL import Image
import io
import base64
import os


class VisionEngine:
    """OpenCV-based template matching and image utilities."""

    # ------------------------------------------------------------------ #
    #  Template matching                                                   #
    # ------------------------------------------------------------------ #

    def match_template(
        self,
        screenshot: Image.Image,
        template_path: str,
        threshold: float = 0.7,
    ) -> dict:
        """
        Compare *screenshot* against the template image at *template_path*.

        Returns:
            {
                "matched":    bool,
                "confidence": float,        # 0.0 – 1.0
                "location":   (x, y) | None # centre of the best match
            }
        """
        if not os.path.exists(template_path):
            return {"matched": False, "confidence": 0.0, "location": None}

        # Convert PIL screenshot → BGR numpy array for OpenCV
        screenshot_cv = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)

        template_cv = cv2.imread(template_path)
        if template_cv is None:
            return {"matched": False, "confidence": 0.0, "location": None}

        sh, sw = screenshot_cv.shape[:2]
        th, tw = template_cv.shape[:2]

        # If the template is larger than the screenshot, scale it down so that
        # matchTemplate doesn't raise an error.
        if tw > sw or th > sh:
            scale = min(sw / tw, sh / th) * 0.9
            new_w = max(1, int(tw * scale))
            new_h = max(1, int(th * scale))
            template_cv = cv2.resize(template_cv, (new_w, new_h),
                                     interpolation=cv2.INTER_AREA)
            th, tw = template_cv.shape[:2]

        # Safety check: template must still be smaller than or equal to screenshot
        if tw > sw or th > sh:
            return {"matched": False, "confidence": 0.0, "location": None}

        try:
            result = cv2.matchTemplate(
                screenshot_cv, template_cv, cv2.TM_CCOEFF_NORMED
            )
        except cv2.error:
            return {"matched": False, "confidence": 0.0, "location": None}

        _, max_val, _, max_loc = cv2.minMaxLoc(result)

        matched = float(max_val) >= threshold
        center = (
            (max_loc[0] + tw // 2, max_loc[1] + th // 2) if matched else None
        )

        return {
            "matched": matched,
            "confidence": float(max_val),
            "location": center,
        }

    # ------------------------------------------------------------------ #
    #  Image ↔ base64 helpers                                              #
    # ------------------------------------------------------------------ #

    def image_to_base64(self, img: Image.Image) -> str:
        """Encode a PIL Image as a JPEG base64 string."""
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=75)
        return base64.b64encode(buffer.getvalue()).decode()

    def load_image_base64(self, path: str) -> str | None:
        """
        Load an image file from *path* and return it as a base64 string,
        or None if the file does not exist or cannot be decoded.
        """
        if not os.path.exists(path):
            return None
        try:
            img = Image.open(path).convert("RGB")
            return self.image_to_base64(img)
        except Exception:
            return None
