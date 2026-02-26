---
name: revealjs
description: "Create reveal.js HTML presentations with Markdown, themes, animations"
---

# Reveal.js Presentations

Create beautiful HTML presentations using reveal.js framework.

## Quick Start

### Minimal Reveal.js Presentation

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Presentation</title>
  
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/black.css">
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section><h2>Title</h2><p>Welcome</p></section>
      <section><h2>Slide 2</h2><p>Use arrow keys to navigate</p></section>
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5"></script>
  <script>Reveal.initialize({ hash: true });</script>
</body>
</html>
```

For complete starter template, see [assets/template.html](assets/template.html).

## Core Concepts

### Architecture Overview

Reveal.js is built on a modular architecture with a central Reveal API that orchestrates multiple specialized controllers:

- **Reveal Object**: Main API managing initialization, navigation, and state
- **Controllers**: Specialized modules (keyboard, fragments, backgrounds, etc.) handling specific features
- **Plugins**: Extensible system allowing custom functionality
- **DOM Management**: Efficient caching and updates

Each controller receives a reference to the main Reveal instance, enabling seamless cross-controller communication.

### HTML Structure

Every reveal.js presentation requires this basic structure:

```html
<div class="reveal">
  <div class="slides">
    <section><!-- Horizontal slide --></section>
    <section>
      <section><!-- Vertical slide 1 --></section>
      <section><!-- Vertical slide 2 --></section>
    </section>
  </div>
</div>
```

- `.reveal`: Outer presentation container
- `.slides`: Contains all slides
- `<section>`: Individual slide (nested = vertical stack)

### Navigation State

Reveal.js tracks presentation position using three indices:

```javascript
{
  h: 2,        // Horizontal slide index
  v: 1,        // Vertical slide index (if in stack)
  f: 3         // Fragment index (if fragments active)
}
```

Access via: `Reveal.getIndices()`, query via `Reveal.slide(h, v, f)`

## Slide Types

### Horizontal & Vertical Stacks

```html
<!-- Horizontal slide -->
<section><h2>Topic</h2></section>

<!-- Vertical slides (press down arrow) -->
<section>
  <section><h2>Main</h2></section>
  <section><h2>Detail 1</h2></section>
  <section><h2>Detail 2</h2></section>
</section>
```

### Markdown Slides

```html
<section data-markdown>
  <script type="text/template">
    ## Slide Title
    
    - Bullet 1
    - Bullet 2
    
    --
    
    ## Vertical slide
  </script>
</section>

<!-- External file -->
<section data-markdown="slides.md" data-separator="---" data-separator-vertical="--"></section>
```

## Styling & Backgrounds

```html
<!-- Color -->
<section data-background="#ff0000"><h2>Red</h2></section>

<!-- Gradient -->
<section data-background-gradient="linear-gradient(to bottom, #ddd, #191919)">
  <h2>Gradient</h2>
</section>

<!-- Image/Video -->
<section data-background="image.jpg" data-background-size="cover">
  <h2>Image</h2>
</section>

<section data-background-video="video.mp4" data-background-video-loop>
  <h2>Video</h2>
</section>
```

**Built-in themes:** black, white, league, beige, sky, night, serif, simple

Change theme in `<head>`:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/white.css">
```

See [references/custom-themes.md](references/custom-themes.md) for custom styling.

## Fragments & Animations

**Incremental reveal:**
```html
<section>
  <ul>
    <li class="fragment">Point 1</li>
    <li class="fragment fade-in">Point 2</li>
    <li class="fragment highlight-red">Point 3</li>
  </ul>
</section>
```

**Auto-animate smooth transitions:**
```html
<section data-auto-animate>
  <h2 data-id="title">Intro</h2>
  <div data-id="box" style="width: 100px; background: blue;"></div>
</section>

<section data-auto-animate>
  <h2 data-id="title" style="color: red;">Intro</h2>
  <div data-id="box" style="width: 300px; background: red;"></div>
</section>
```

See [references/api.md](references/api.md) for animation types and options.

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

## Configuration

Reveal.js has numerous configuration options that control behavior and features. The framework uses a controller pattern where each controller can be configured via the initialize options.

### Essential Configuration

```javascript
Reveal.initialize({
  // Display & layout
  width: 960,
  height: 700,
  center: true,
  margin: 0.1,
  
  // Navigation controllers
  controls: true,           // Enable arrow buttons (controls controller)
  keyboard: true,           // Enable keyboard nav (keyboard controller)
  touch: true,              // Enable swipe (touch controller)
  progress: true,           // Enable progress bar (progress controller)
  
  // Navigation behavior
  hash: true,               // Use URL hash for bookmarking
  overview: true,           // Enable overview/grid mode
  slideNumber: false,       // Show slide numbers
  
  // Transitions
  transition: 'slide',      // Global transition type
  backgroundTransition: 'fade',
  transitionSpeed: 'default',
  
  // Features
  autoAnimate: true,        // Auto-animate elements
  fragments: true,          // Enable fragments
  
  // Plugins (controllers that add functionality)
  plugins: [
    RevealMarkdown,      // Parse Markdown slides
    RevealHighlight,     // Syntax highlighting
    RevealNotes,         // Speaker notes
    RevealMath,          // Math rendering
    RevealSearch,        // Search functionality
    RevealZoom           // Zoom on click
  ]
});
```

### Controller-Specific Options

Each built-in controller can be configured:

```javascript
Reveal.initialize({
  // Keyboard controller options
  keyboard: true,
  
  // Touch/gesture controller options
  touch: true,
  
  // Fragments controller options
  fragments: true,
  fragmentInURL: false,
  
  // Auto-animate controller
  autoAnimate: true,
  autoAnimateDuration: 1.0,
  autoAnimateEasing: 'ease',
  
  // Background controller
  backgroundTransition: 'fade',
  
  // Progress controller
  progress: true,
  
  // Slide number controller
  slideNumber: false,
  showSlideNumber: 'print'  // Show only in print/PDF
});
```

For complete configuration reference and advanced options, see [references/architecture.md](references/architecture.md#all-configuration-options).

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

## Event Handling

Reveal.js emits events at key points in navigation and lifecycle. Use these to hook into presentation flow:

```javascript
// Navigation events
Reveal.addEventListener('slidechanged', (event) => {
  console.log(`Moved to slide ${event.indexh}.${event.indexv}`);
});

Reveal.addEventListener('fragmentshown', (event) => {
  console.log('Fragment revealed:', event.fragment);
});

Reveal.addEventListener('fragmenthidden', (event) => {
  console.log('Fragment hidden:', event.fragment);
});

// Initialization and state
Reveal.addEventListener('ready', () => {
  console.log('Presentation ready');
});

Reveal.addEventListener('paused', () => {
  console.log('Presentation paused');
});

// Mode changes
Reveal.addEventListener('overviewshown', () => {
  console.log('Entered overview mode');
});

Reveal.addEventListener('overviewhidden', () => {
  console.log('Left overview mode');
});
```

For complete event reference and lifecycle details, see [references/architecture.md](references/architecture.md).

## Keyboard Shortcuts

- **Arrow keys** / **Space**: Navigate slides
- **F**: Fullscreen
- **S**: Speaker view
- **O** / **Esc**: Overview mode
- **B** / **.**: Pause (black screen)
- **?**: Help menu

## Advanced Features

For advanced topics, see:
- **Architecture & Lifecycle**: [references/architecture.md](references/architecture.md) - Internal structure, initialization, controllers, events
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
