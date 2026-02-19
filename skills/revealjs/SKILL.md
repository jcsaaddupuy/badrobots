---
name: revealjs
description: Create, edit, and work with reveal.js HTML presentations. Use when creating slide decks, interactive presentations, or converting content to reveal.js format. Supports Markdown slides, themes, animations, fragments, speaker notes, PDF export, and advanced features like auto-animate and vertical slides.
---

# Reveal.js Presentations

Create beautiful HTML presentations using reveal.js framework.

## Quick Start

### Basic HTML Structure

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Presentation</title>
  
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reset.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/black.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/highlight/monokai.css">
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section>
        <h2>Title Slide</h2>
        <p>Welcome to my presentation</p>
      </section>
      
      <section>
        <h2>Second Slide</h2>
        <p>Press Space or arrow keys to navigate</p>
      </section>
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
```

## Slide Types

### Horizontal and Vertical Slides

```html
<!-- Horizontal slide -->
<section>
  <h2>Main Topic</h2>
</section>

<!-- Vertical slide stack -->
<section>
  <section>
    <h2>Topic with Details</h2>
    <p>Press down arrow for more</p>
  </section>
  <section>
    <h2>Detail 1</h2>
  </section>
  <section>
    <h2>Detail 2</h2>
  </section>
</section>
```

### Markdown Slides

```html
<!-- Inline Markdown -->
<section data-markdown>
  <script type="text/template">
    ## Slide Title
    
    This is **bold** and this is *italic*.
    
    - Bullet point 1
    - Bullet point 2
    
    ---
    
    ## Next Slide
    
    Horizontal separator: `---`
    
    --
    
    ## Vertical Slide
    
    Vertical separator: `--`
  </script>
</section>

<!-- External Markdown file -->
<section 
  data-markdown="slides.md"
  data-separator="^\n\n\n"
  data-separator-vertical="^\n\n">
</section>
```

## Styling and Backgrounds

### Slide Backgrounds

```html
<!-- Color background -->
<section data-background="#ff0000">
  <h2>Red Background</h2>
</section>

<!-- Gradient background -->
<section data-background-gradient="linear-gradient(to bottom, #ddd, #191919)">
  <h2>Gradient</h2>
</section>

<!-- Image background -->
<section 
  data-background="image.jpg"
  data-background-size="cover"
  data-background-position="center">
  <h2>Image Background</h2>
</section>

<!-- Video background -->
<section 
  data-background-video="video.mp4"
  data-background-video-loop
  data-background-video-muted>
  <h2>Video Background</h2>
</section>

<!-- Iframe background -->
<section 
  data-background-iframe="https://example.com"
  data-background-interactive>
  <h2>Embedded Website</h2>
</section>

<!-- Background opacity -->
<section 
  data-background="bright.jpg"
  data-background-opacity="0.3">
  <h2>Dimmed Background</h2>
</section>
```

### Themes

Built-in themes: `black`, `white`, `league`, `beige`, `sky`, `night`, `serif`, `simple`, `solarized`, `blood`, `moon`

```html
<!-- Change theme in head -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/white.css">
```

For custom themes, see [references/custom-themes.md](references/custom-themes.md).

## Fragments and Animations

### Fragments (Incremental Display)

```html
<section>
  <h2>Bullet Points</h2>
  <ul>
    <li class="fragment">First point</li>
    <li class="fragment">Second point</li>
    <li class="fragment">Third point</li>
  </ul>
  
  <!-- Fragment animations -->
  <p class="fragment fade-in">Fade in</p>
  <p class="fragment fade-out">Fade out</p>
  <p class="fragment fade-up">Slide up</p>
  <p class="fragment grow">Grow</p>
  <p class="fragment shrink">Shrink</p>
  <p class="fragment highlight-red">Highlight red</p>
  
  <!-- Custom order -->
  <p class="fragment" data-fragment-index="3">Third</p>
  <p class="fragment" data-fragment-index="1">First</p>
  <p class="fragment" data-fragment-index="2">Second</p>
</section>
```

### Auto-Animate

```html
<!-- Slide 1 -->
<section data-auto-animate>
  <h2 data-id="title">Introduction</h2>
  <div data-id="box" style="width: 100px; height: 100px; background: blue;"></div>
</section>

<!-- Slide 2 - elements smoothly animate -->
<section data-auto-animate>
  <h2 data-id="title" style="color: red;">Introduction</h2>
  <div data-id="box" style="width: 200px; height: 200px; background: red;"></div>
</section>

<!-- Code animation -->
<section data-auto-animate>
  <pre data-id="code"><code class="javascript">
function hello() {
  console.log('Hello');
}
  </code></pre>
</section>

<section data-auto-animate>
  <pre data-id="code"><code class="javascript">
function hello(name) {
  console.log('Hello ' + name);
}
hello('World');
  </code></pre>
</section>
```

## Speaker Notes

```html
<section>
  <h2>Main Content</h2>
  <p>Audience sees this</p>
  
  <aside class="notes">
    Speaker notes here. Press 's' to open speaker view.
    
    - Remember to mention Q3 results
    - Demo the feature
    - Take questions
  </aside>
</section>

<!-- Markdown notes -->
<section data-markdown>
  <script type="text/template">
    ## Slide Title
    
    Content for audience
    
    Notes:
    Speaker notes in Markdown
    - Bullet point
    - Reminder
  </script>
</section>
```

Press `s` key during presentation to open speaker view with notes, timer, and preview.

## Code Highlighting

```html
<section>
  <h2>Code Example</h2>
  <pre><code class="javascript" data-trim data-line-numbers="1-2|3-5">
function factorial(n) {
  if (n === 0) return 1;
  
  return n * factorial(n - 1);
}
console.log(factorial(5));
  </code></pre>
</section>

<!-- Line number offset -->
<section>
  <pre><code class="python" data-trim data-line-numbers="100:">
def greet(name):
    print(f"Hello, {name}!")
  </code></pre>
</section>
```

## Configuration

```javascript
Reveal.initialize({
  // Display
  width: 960,
  height: 700,
  margin: 0.04,
  center: true,
  
  // Navigation
  controls: true,
  progress: true,
  slideNumber: false,
  hash: true,
  keyboard: true,
  
  // Transitions
  transition: 'slide', // none/fade/slide/convex/concave/zoom
  transitionSpeed: 'default', // default/fast/slow
  backgroundTransition: 'fade',
  
  // Auto-animate
  autoAnimate: true,
  autoAnimateDuration: 1.0,
  
  // Fragments
  fragments: true,
  
  // Features
  overview: true,
  help: true,
  
  // Plugins
  plugins: [ 
    RevealMarkdown, 
    RevealHighlight, 
    RevealNotes,
    RevealMath,
    RevealSearch,
    RevealZoom
  ]
});
```

## PDF Export

1. Add `?print-pdf` to URL: `presentation.html?print-pdf`
2. Open in Chrome/Chromium
3. Print to PDF (Ctrl+P / Cmd+P)
4. Settings: No margins, background graphics enabled

**Configuration for PDF:**

```javascript
Reveal.initialize({
  pdfMaxPagesPerSlide: 1,
  pdfSeparateFragments: true,
  slideNumber: true,
  showSlideNumber: 'print'
});
```

## Common Patterns

### Title Slide

```html
<section>
  <h1>Presentation Title</h1>
  <h3>Subtitle or Description</h3>
  <p>
    <small>By Author Name</small><br>
    <small>Date</small>
  </p>
</section>
```

### Two-Column Layout

```html
<section>
  <h2>Two Columns</h2>
  <div style="display: flex; gap: 2rem;">
    <div style="flex: 1;">
      <h3>Left Column</h3>
      <p>Content here</p>
    </div>
    <div style="flex: 1;">
      <h3>Right Column</h3>
      <p>Content here</p>
    </div>
  </div>
</section>
```

### Image with Caption

```html
<section>
  <h2>Image Example</h2>
  <img src="image.jpg" alt="Description" style="max-width: 80%; height: auto;">
  <p><small>Image caption or source</small></p>
</section>
```

## Keyboard Shortcuts

- **Arrow keys** / **Space**: Navigate slides
- **F**: Fullscreen
- **S**: Speaker view
- **O** / **Esc**: Overview mode
- **B** / **.**: Pause (black screen)
- **?**: Help menu

## Advanced Features

For advanced topics, see:
- **Custom themes and styling**: [references/custom-themes.md](references/custom-themes.md)
- **Plugin development**: [references/plugins.md](references/plugins.md)
- **API usage**: [references/api.md](references/api.md)

## Workflow

1. **Create HTML file** with reveal.js structure
2. **Add slides** using `<section>` elements or Markdown
3. **Configure** initialization options
4. **Test locally** by opening HTML in browser
5. **Export to PDF** if needed using print-pdf mode

## Tips

- Use CDN links for quick prototyping
- Download reveal.js for offline presentations
- Keep slides simple and focused
- Use fragments to reveal content progressively
- Test speaker notes before presenting
- Export to PDF as backup
- Use vertical slides for related sub-topics
- Leverage auto-animate for smooth transitions
