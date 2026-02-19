# Reveal.js Plugins

## Built-in Plugins

### Markdown Plugin

Parse Markdown content in slides.

```html
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/markdown/markdown.js"></script>

<script>
  Reveal.initialize({
    plugins: [ RevealMarkdown ],
    markdown: {
      smartypants: true,  // Convert quotes and dashes
      breaks: true        // Convert \n to <br>
    }
  });
</script>
```

### Highlight Plugin

Syntax highlighting for code blocks.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/highlight/monokai.css">
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/highlight/highlight.js"></script>

<script>
  Reveal.initialize({
    plugins: [ RevealHighlight ],
    highlight: {
      highlightOnLoad: true,
      escapeHTML: false
    }
  });
</script>
```

Available themes: `monokai`, `zenburn`, `vs`, `github`, `atom-one-dark`, `atom-one-light`

### Notes Plugin

Speaker notes functionality.

```html
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/notes/notes.js"></script>

<script>
  Reveal.initialize({
    plugins: [ RevealNotes ],
    showNotes: false  // or 'separate-page'
  });
</script>
```

Access notes:
- Press `s` to open speaker view
- Or: `Reveal.getPlugin('notes').open()`

### Math Plugin

Render mathematical equations using MathJax or KaTeX.

```html
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/math/math.js"></script>

<script>
  Reveal.initialize({
    plugins: [ RevealMath.KaTeX ],  // or RevealMath.MathJax3
    math: {
      mathjax: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js',
      config: 'TeX-AMS_HTML-full'
    }
  });
</script>
```

Usage in slides:

```html
<section>
  <h2>Inline Math</h2>
  <p>Einstein's equation: $E = mc^2$</p>
  
  <h2>Display Math</h2>
  $$
  \frac{d}{dx}\left( \int_{0}^{x} f(u)\,du\right)=f(x)
  $$
</section>
```

### Search Plugin

Full-text search across slides.

```html
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/search/search.js"></script>

<script>
  Reveal.initialize({
    plugins: [ RevealSearch ]
  });
</script>
```

Press `Ctrl+Shift+F` to search.

### Zoom Plugin

Zoom into slide elements with Alt+Click.

```html
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/zoom/zoom.js"></script>

<script>
  Reveal.initialize({
    plugins: [ RevealZoom ]
  });
</script>
```

## Creating Custom Plugins

### Basic Plugin Structure

```javascript
const MyPlugin = {
  id: 'myPlugin',
  
  init: function(deck) {
    // Initialize plugin
    console.log('Plugin initialized');
    
    // Access reveal.js instance
    this.deck = deck;
    
    // Listen to events
    deck.on('slidechanged', this.onSlideChanged.bind(this));
    
    // Return promise if async initialization needed
    return Promise.resolve();
  },
  
  onSlideChanged: function(event) {
    console.log('Slide changed:', event.currentSlide);
  },
  
  destroy: function() {
    // Cleanup
    this.deck.off('slidechanged', this.onSlideChanged);
  }
};

// Use plugin
Reveal.initialize({
  plugins: [ MyPlugin ]
});
```

### Plugin with Configuration

```javascript
const ConfigurablePlugin = () => {
  return {
    id: 'configurablePlugin',
    
    init: function(deck) {
      const config = deck.getConfig().configurablePlugin || {};
      
      this.options = {
        enabled: config.enabled !== false,
        color: config.color || 'blue',
        position: config.position || 'bottom'
      };
      
      if (this.options.enabled) {
        this.setup();
      }
      
      return Promise.resolve();
    },
    
    setup: function() {
      // Plugin implementation
      console.log('Setup with options:', this.options);
    }
  };
};

// Use with configuration
Reveal.initialize({
  configurablePlugin: {
    enabled: true,
    color: 'red',
    position: 'top'
  },
  plugins: [ ConfigurablePlugin() ]
});
```

### Plugin Examples

#### Auto-Progress Plugin

```javascript
const AutoProgress = {
  id: 'autoProgress',
  
  init: function(deck) {
    this.deck = deck;
    this.config = deck.getConfig().autoProgress || {};
    this.interval = this.config.interval || 5000;
    this.timer = null;
    
    deck.on('slidechanged', () => this.restart());
    deck.on('paused', () => this.stop());
    deck.on('resumed', () => this.start());
    
    this.start();
    
    return Promise.resolve();
  },
  
  start: function() {
    if (this.config.enabled !== false) {
      this.timer = setInterval(() => {
        if (!this.deck.isLastSlide()) {
          this.deck.next();
        } else {
          this.stop();
        }
      }, this.interval);
    }
  },
  
  stop: function() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
  
  restart: function() {
    this.stop();
    this.start();
  },
  
  destroy: function() {
    this.stop();
  }
};
```

#### Slide Counter Plugin

```javascript
const SlideCounter = {
  id: 'slideCounter',
  
  init: function(deck) {
    this.deck = deck;
    this.element = this.createCounter();
    
    deck.on('slidechanged', () => this.update());
    this.update();
    
    return Promise.resolve();
  },
  
  createCounter: function() {
    const counter = document.createElement('div');
    counter.style.position = 'fixed';
    counter.style.bottom = '10px';
    counter.style.right = '10px';
    counter.style.padding = '10px';
    counter.style.background = 'rgba(0, 0, 0, 0.7)';
    counter.style.color = 'white';
    counter.style.borderRadius = '5px';
    counter.style.fontSize = '14px';
    counter.style.zIndex = '1000';
    document.body.appendChild(counter);
    return counter;
  },
  
  update: function() {
    const indices = this.deck.getIndices();
    const total = this.deck.getTotalSlides();
    const current = indices.h + 1;
    
    this.element.textContent = `${current} / ${total}`;
  },
  
  destroy: function() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
};
```

#### Slide Annotations Plugin

```javascript
const Annotations = {
  id: 'annotations',
  
  init: function(deck) {
    this.deck = deck;
    this.annotations = {};
    this.currentAnnotation = null;
    
    this.setupUI();
    this.loadAnnotations();
    
    deck.on('slidechanged', (event) => {
      this.showAnnotation(event.indexh);
    });
    
    return Promise.resolve();
  },
  
  setupUI: function() {
    // Add annotation button
    const button = document.createElement('button');
    button.textContent = 'Add Note';
    button.style.position = 'fixed';
    button.style.top = '10px';
    button.style.right = '10px';
    button.style.zIndex = '1000';
    button.onclick = () => this.addAnnotation();
    document.body.appendChild(button);
    
    // Create annotation display
    this.display = document.createElement('div');
    this.display.style.position = 'fixed';
    this.display.style.bottom = '50px';
    this.display.style.left = '10px';
    this.display.style.maxWidth = '300px';
    this.display.style.padding = '15px';
    this.display.style.background = 'rgba(255, 255, 255, 0.95)';
    this.display.style.borderRadius = '8px';
    this.display.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    this.display.style.display = 'none';
    this.display.style.zIndex = '1000';
    document.body.appendChild(this.display);
  },
  
  addAnnotation: function() {
    const indices = this.deck.getIndices();
    const note = prompt('Add annotation for this slide:');
    
    if (note) {
      this.annotations[indices.h] = note;
      this.saveAnnotations();
      this.showAnnotation(indices.h);
    }
  },
  
  showAnnotation: function(slideIndex) {
    const annotation = this.annotations[slideIndex];
    
    if (annotation) {
      this.display.textContent = annotation;
      this.display.style.display = 'block';
    } else {
      this.display.style.display = 'none';
    }
  },
  
  saveAnnotations: function() {
    localStorage.setItem('reveal-annotations', JSON.stringify(this.annotations));
  },
  
  loadAnnotations: function() {
    const saved = localStorage.getItem('reveal-annotations');
    if (saved) {
      this.annotations = JSON.parse(saved);
    }
  }
};
```

## Plugin Best Practices

1. **Use unique IDs** - Prevent conflicts with other plugins
2. **Clean up resources** - Implement `destroy()` method
3. **Handle errors gracefully** - Don't break the presentation
4. **Respect configuration** - Allow users to customize behavior
5. **Document API** - Provide clear usage instructions
6. **Test thoroughly** - Verify compatibility with other plugins
7. **Use promises** - Return promises from `init()` for async operations
8. **Namespace events** - Use plugin-specific event names
9. **Minimize DOM manipulation** - Keep performance in mind
10. **Provide defaults** - Ensure plugin works without configuration

## Loading Plugins

### From CDN

```html
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/markdown/markdown.js"></script>
```

### From Local Files

```html
<script src="plugin/custom/custom-plugin.js"></script>
```

### As ES Modules

```javascript
import Reveal from './reveal.js';
import Markdown from './plugin/markdown/markdown.esm.js';
import Highlight from './plugin/highlight/highlight.esm.js';

Reveal.initialize({
  plugins: [ Markdown, Highlight ]
});
```

## Plugin Resources

- Official plugins: https://github.com/hakimel/reveal.js/tree/master/plugin
- Community plugins: https://github.com/hakimel/reveal.js/wiki/Plugins,-Tools-and-Hardware
- Plugin API docs: https://revealjs.com/plugins/
