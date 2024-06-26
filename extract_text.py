# Import the PyPDF2 library
from pypdf import PdfReader


reader = PdfReader("harry potter chapter 1.pdf")
number_of_pages = len(reader.pages)
all_text = ""
for page_index in range(number_of_pages):
    page = reader.pages[page_index]
    page_text = page.extract_text()
    all_text += page_text

print(all_text)
