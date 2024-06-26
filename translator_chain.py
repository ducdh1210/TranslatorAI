from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from pypdf import PdfReader

from dotenv import load_dotenv

load_dotenv()

# Extract text
reader = PdfReader("harry potter chapter 1.pdf")
number_of_pages = len(reader.pages)

all_text = ""
for page_index in range(number_of_pages):
    page = reader.pages[page_index]
    page_text = page.extract_text()
    all_text += page_text

print(all_text)

# Translate text
llm = ChatOpenAI(model="gpt-4o")

prompt_template = PromptTemplate.from_template("Translate to Vietnamese: {content}")

chain = prompt_template | llm | StrOutputParser()


result = chain.invoke(input={"content": all_text})
print(result)
