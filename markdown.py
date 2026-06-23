import pymupdf4llm

md = pymupdf4llm.to_markdown("Instructions.pdf")
open("output.md", "w", encoding="utf-8").write(md)