#!/usr/bin/env python3
"""
Create a reveal.js presentation from a simple outline.

Usage:
    python create_presentation.py outline.txt output.html
    
Outline format:
    # Title Slide
    Title: My Presentation
    Subtitle: A Great Talk
    Author: John Doe
    
    # Slide 1
    ## Main Topic
    - Point 1
    - Point 2
    - Point 3
    
    # Slide 2
    ## Another Topic
    Content goes here
    
    ## Code Example
    ```python
    def hello():
        print("Hello")
    ```
"""

import sys
import re
from pathlib import Path

TEMPLATE_START = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reset.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/black.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/highlight/monokai.css">
  
  <style>
    .reveal h1, .reveal h2, .reveal h3 {{ text-transform: none; }}
    .reveal section img {{ border: none; box-shadow: 0 0 20px rgba(0, 0, 0, 0.5); }}
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
"""

TEMPLATE_END = """
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/markdown/markdown.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/highlight/highlight.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/notes/notes.js"></script>
  
  <script>
    Reveal.initialize({
      hash: true,
      center: true,
      transition: 'slide',
      plugins: [ RevealMarkdown, RevealHighlight, RevealNotes ]
    });
  </script>
</body>
</html>
"""


def parse_outline(text):
    """Parse outline text into slides."""
    slides = []
    current_slide = None
    in_code_block = False
    code_lang = None
    
    for line in text.split('\n'):
        # Check for code blocks
        if line.strip().startswith('```'):
            in_code_block = not in_code_block
            if in_code_block:
                code_lang = line.strip()[3:].strip() or 'text'
                if current_slide:
                    current_slide['content'].append(f'<pre><code class="{code_lang}" data-trim>')
            else:
                if current_slide:
                    current_slide['content'].append('</code></pre>')
                code_lang = None
            continue
        
        if in_code_block:
            if current_slide:
                current_slide['content'].append(line)
            continue
        
        # New slide
        if line.startswith('# '):
            if current_slide:
                slides.append(current_slide)
            
            slide_title = line[2:].strip()
            current_slide = {
                'type': 'title' if slide_title.lower() == 'title slide' else 'content',
                'title': slide_title,
                'content': [],
                'metadata': {}
            }
        
        # Heading
        elif line.startswith('## '):
            if current_slide:
                current_slide['content'].append(f'<h2>{line[3:].strip()}</h2>')
        
        # Metadata (Title: value)
        elif ':' in line and not line.strip().startswith('-'):
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()
            if current_slide and key in ['Title', 'Subtitle', 'Author', 'Date']:
                current_slide['metadata'][key.lower()] = value
        
        # Bullet points
        elif line.strip().startswith('-'):
            if current_slide:
                # Check if we need to open a new list
                needs_ul = True
                if current_slide['content']:
                    for i in range(len(current_slide['content']) - 1, -1, -1):
                        if current_slide['content'][i] == '<ul>':
                            needs_ul = False
                            break
                        elif current_slide['content'][i] == '</ul>':
                            break
                
                if needs_ul:
                    current_slide['content'].append('<ul>')
                current_slide['content'].append(f'  <li>{line.strip()[1:].strip()}</li>')
        
        # Close bullet list if next line is not a bullet
        elif current_slide and current_slide['content']:
            # Check if last item was a list item
            has_open_list = False
            for i in range(len(current_slide['content']) - 1, -1, -1):
                if current_slide['content'][i] == '<ul>':
                    has_open_list = True
                    break
                elif current_slide['content'][i] == '</ul>':
                    break
            
            if has_open_list and line.strip():
                current_slide['content'].append('</ul>')
                current_slide['content'].append(f'<p>{line.strip()}</p>')
            elif line.strip():
                current_slide['content'].append(f'<p>{line.strip()}</p>')
        
        # Regular content
        elif line.strip():
            if current_slide:
                current_slide['content'].append(f'<p>{line.strip()}</p>')
    
    # Add last slide
    if current_slide:
        # Close any open lists
        if current_slide['content'] and current_slide['content'][-1].startswith('  <li>'):
            current_slide['content'].append('</ul>')
        slides.append(current_slide)
    
    return slides


def generate_slide_html(slide):
    """Generate HTML for a single slide."""
    if slide['type'] == 'title':
        title = slide['metadata'].get('title', 'Presentation Title')
        subtitle = slide['metadata'].get('subtitle', '')
        author = slide['metadata'].get('author', '')
        date = slide['metadata'].get('date', '')
        
        html = '      <section>\n'
        html += f'        <h1>{title}</h1>\n'
        if subtitle:
            html += f'        <h3>{subtitle}</h3>\n'
        if author or date:
            html += '        <p>\n'
            if author:
                html += f'          <small>{author}</small><br>\n'
            if date:
                html += f'          <small>{date}</small>\n'
            html += '        </p>\n'
        html += '      </section>\n'
        return html
    
    else:
        html = '      <section>\n'
        for line in slide['content']:
            html += f'        {line}\n'
        html += '      </section>\n'
        return html


def create_presentation(outline_path, output_path):
    """Create reveal.js presentation from outline."""
    # Read outline
    outline_text = Path(outline_path).read_text()
    
    # Parse slides
    slides = parse_outline(outline_text)
    
    if not slides:
        print("Error: No slides found in outline")
        return False
    
    # Get title for HTML
    title = "Presentation"
    if slides and slides[0]['type'] == 'title':
        title = slides[0]['metadata'].get('title', title)
    
    # Generate HTML
    html = TEMPLATE_START.format(title=title)
    
    for slide in slides:
        html += generate_slide_html(slide)
    
    html += TEMPLATE_END
    
    # Write output
    Path(output_path).write_text(html)
    print(f"Created presentation: {output_path}")
    print(f"Slides: {len(slides)}")
    return True


def main():
    if len(sys.argv) != 3:
        print("Usage: python create_presentation.py outline.txt output.html")
        print("\nOutline format:")
        print("  # Title Slide")
        print("  Title: My Presentation")
        print("  Author: John Doe")
        print("  ")
        print("  # Slide 1")
        print("  ## Topic")
        print("  - Point 1")
        print("  - Point 2")
        sys.exit(1)
    
    outline_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not Path(outline_path).exists():
        print(f"Error: Outline file not found: {outline_path}")
        sys.exit(1)
    
    success = create_presentation(outline_path, output_path)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
