from io import BytesIO

from PIL import Image, ImageOps
from pypdf import PdfReader
import pytesseract

try:
    import pypdfium2 as pdfium
except ImportError:  # pragma: no cover
    pdfium = None

from app.core.settings import get_settings


class OCRService:
    _MIN_EMBEDDED_PAGE_TEXT_CHARS = 30
    _OCR_CONFIG = "--oem 3 --psm 6"

    def __init__(self) -> None:
        settings = get_settings()
        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    def extract_text(
        self,
        file_bytes: bytes,
        file_name: str | None = None,
        mime_type: str | None = None,
    ) -> str:
        if self._is_pdf(file_name=file_name, mime_type=mime_type):
            return self._extract_pdf_text(file_bytes)

        image = Image.open(BytesIO(file_bytes)).convert("L")
        return pytesseract.image_to_string(image)

    @staticmethod
    def _is_pdf(file_name: str | None, mime_type: str | None) -> bool:
        if mime_type and "pdf" in mime_type.lower():
            return True
        return bool(file_name and file_name.lower().endswith(".pdf"))

    def _extract_pdf_text(self, file_bytes: bytes) -> str:
        reader = PdfReader(BytesIO(file_bytes))
        page_text: list[str] = []
        for index, page in enumerate(reader.pages):
            embedded_text = (page.extract_text() or "").strip()
            combined_page_text = embedded_text

            if len(embedded_text) < self._MIN_EMBEDDED_PAGE_TEXT_CHARS:
                # Fallback for image-only/scanned pages where embedded text is missing.
                ocr_text = self._ocr_pdf_page_images(page)
                if not ocr_text:
                    ocr_text = self._ocr_pdf_page_render(file_bytes, index)
                if ocr_text:
                    combined_page_text = (
                        f"{embedded_text}\n{ocr_text}".strip()
                        if embedded_text
                        else ocr_text
                    )

            if combined_page_text:
                page_text.append(combined_page_text)

        return "\n\n".join(page_text)

    @staticmethod
    def _ocr_pdf_page_images(page: object) -> str:
        extracted_text: list[str] = []
        for page_image in getattr(page, "images", []):
            try:
                image = Image.open(BytesIO(page_image.data))
                image = OCRService._preprocess_image(image)
            except Exception:  # noqa: BLE001
                continue

            text = pytesseract.image_to_string(
                image, config=OCRService._OCR_CONFIG
            ).strip()
            if text:
                extracted_text.append(text)

        return "\n".join(extracted_text)

    @staticmethod
    def _ocr_pdf_page_render(file_bytes: bytes, page_index: int) -> str:
        if pdfium is None:
            return ""

        try:
            document = pdfium.PdfDocument(file_bytes)
            page = document[page_index]
            bitmap = page.render(scale=2.0)
            pil_image = bitmap.to_pil()
            image = OCRService._preprocess_image(pil_image)
            text = pytesseract.image_to_string(
                image, config=OCRService._OCR_CONFIG
            ).strip()
            page.close()
            document.close()
            return text
        except Exception:  # noqa: BLE001
            return ""

    @staticmethod
    def _preprocess_image(image: Image.Image) -> Image.Image:
        gray = image.convert("L")
        boosted = ImageOps.autocontrast(gray)
        return boosted.point(lambda pixel: 255 if pixel > 160 else 0)
