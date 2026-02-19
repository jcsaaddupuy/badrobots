# Reveal.js API Reference

## Initialization

```javascript
// Basic initialization
Reveal.initialize({
  hash: true,
  plugins: [ RevealMarkdown, RevealHighlight ]
});

// With promise
Reveal.initialize().then(() => {
  console.log('Presentation ready!');
});

// Multiple presentations on same page
const deck1 = new Reveal(document.querySelector('.deck1'), {
  embedded: true
});

const deck2 = new Reveal(document.querySelector('.deck2'), {
  embedded: true
});

deck1.initialize();
deck2.initialize();
```

## Navigation

```javascript
// Navigate to slides
Reveal.slide(2);           // Go to slide 2
Reveal.slide(2, 3);        // Go to slide 2, vertical 3
Reveal.slide(2, 3, 1);     // Go to slide 2, vertical 3, fragment 1

// Relative navigation
Reveal.next();             // Next slide
Reveal.prev();             // Previous slide
Reveal.up();               // Up (vertical)
Reveal.down();             // Down (vertical)
Reveal.left();             // Left (horizontal)
Reveal.right();            // Right (horizontal)

// Navigate to element
const element = document.querySelector('#my-slide');
Reveal.slide(Reveal.getIndices(element));

// Fragment navigation
Reveal.nextFragment();     // Show next fragment
Reveal.prevFragment();     // Hide previous fragment
```

## State Queries

```javascript
// Get current state
const state = Reveal.getState();
console.log(state);  // { indexh: 2, indexv: 1, indexf: 0, ... }

// Get indices
const indices = Reveal.getIndices();
console.log(indices);  // { h: 2, v: 1, f: 0 }

// Get current slide
const currentSlide = Reveal.getCurrentSlide();

// Get all slides
const slides = Reveal.getSlides();
const horizontalSlides = Reveal.getHorizontalSlides();
const verticalSlides = Reveal.getVerticalSlides();

// Get total slides
const total = Reveal.getTotalSlides();

// Position checks
Reveal.isFirstSlide();     // Boolean
Reveal.isLastSlide();      // Boolean
Reveal.isVerticalSlide();  // Boolean

// State checks
Reveal.isReady();          // Boolean
Reveal.isPaused();         // Boolean
Reveal.isOverview();       // Boolean
Reveal.isAutoSliding();    // Boolean
```

## Configuration

```javascript
// Get configuration
const config = Reveal.getConfig();

// Update configuration
Reveal.configure({
  controls: false,
  progress: true,
  transition: 'fade'
});

// Get scale
const scale = Reveal.getScale();  // Current zoom level
```

## View Modes

```javascript
// Overview mode
Reveal.toggleOverview();
Reveal.toggleOverview(true);   // Force on
Reveal.toggleOverview(false);  // Force off

// Pause mode
Reveal.togglePause();
Reveal.togglePause(true);      // Force pause
Reveal.togglePause(false);     // Force resume

// Help overlay
Reveal.toggleHelp();

// Auto-slide
Reveal.toggleAutoSlide();
Reveal.toggleAutoSlide(true);  // Enable
Reveal.toggleAutoSlide(false); // Disable
```

## Events

```javascript
// Slide change events
Reveal.on('slidechanged', event => {
  console.log('Current slide:', event.currentSlide);
  console.log('Previous slide:', event.previousSlide);
  console.log('Indices:', event.indexh, event.indexv);
});

// Fragment events
Reveal.on('fragmentshown', event => {
  console.log('Fragment shown:', event.fragment);
});

Reveal.on('fragmenthidden', event => {
  console.log('Fragment hidden:', event.fragment);
});

// Ready event
Reveal.on('ready', event => {
  console.log('Presentation ready');
  console.log('Total slides:', event.totalSlides);
});

// Other events
Reveal.on('overviewshown', () => console.log('Overview shown'));
Reveal.on('overviewhidden', () => console.log('Overview hidden'));
Reveal.on('paused', () => console.log('Paused'));
Reveal.on('resumed', () => console.log('Resumed'));
Reveal.on('autoslideresumed', () => console.log('Auto-slide resumed'));
Reveal.on('autoslidepaused', () => console.log('Auto-slide paused'));

// Remove event listener
const handler = event => console.log(event);
Reveal.on('slidechanged', handler);
Reveal.off('slidechanged', handler);
```

## Plugins

```javascript
// Get plugin instance
const notesPlugin = Reveal.getPlugin('notes');
const markdownPlugin = Reveal.getPlugin('markdown');

// Check if plugin is available
if (Reveal.hasPlugin('notes')) {
  console.log('Notes plugin loaded');
}

// Plugin-specific API
notesPlugin.open();  // Open speaker notes
```

## Programmatic Control

```javascript
// Sync with external state
function syncSlide(slideIndex) {
  Reveal.slide(slideIndex);
}

// Custom navigation
document.getElementById('myButton').addEventListener('click', () => {
  Reveal.slide(5, 2);  // Jump to specific slide
});

// Conditional navigation
Reveal.on('slidechanged', event => {
  if (event.indexh === 3 && !userHasPermission) {
    Reveal.prev();  // Block access
    alert('Complete previous section first');
  }
});

// Auto-advance based on time
setTimeout(() => {
  Reveal.next();
}, 5000);

// Keyboard shortcuts
Reveal.addKeyBinding({ keyCode: 71, key: 'G' }, () => {
  const slide = prompt('Go to slide:');
  if (slide) Reveal.slide(parseInt(slide));
});

// Remove key binding
Reveal.removeKeyBinding(71);
```

## State Management

```javascript
// Save state
const state = Reveal.getState();
localStorage.setItem('presentationState', JSON.stringify(state));

// Restore state
const savedState = JSON.parse(localStorage.getItem('presentationState'));
Reveal.setState(savedState);

// Sync between windows
window.addEventListener('storage', event => {
  if (event.key === 'presentationState') {
    const newState = JSON.parse(event.newValue);
    Reveal.setState(newState);
  }
});
```

## Layout and Scaling

```javascript
// Force layout update
Reveal.layout();

// Get computed slide size
const slideSize = Reveal.getComputedSlideSize();
console.log(slideSize.width, slideSize.height);

// Configure slide size
Reveal.configure({
  width: 1920,
  height: 1080,
  margin: 0.1,
  minScale: 0.2,
  maxScale: 2.0
});
```

## Advanced Usage

### Custom Slide Transitions

```javascript
// Trigger custom transition
Reveal.on('slidechanged', event => {
  const currentSlide = event.currentSlide;
  
  if (currentSlide.hasAttribute('data-custom-transition')) {
    // Apply custom animation
    currentSlide.style.animation = 'customFade 1s';
  }
});
```

### Dynamic Content Loading

```javascript
Reveal.on('slidechanged', event => {
  const slide = event.currentSlide;
  const dataUrl = slide.getAttribute('data-load-content');
  
  if (dataUrl && !slide.dataset.loaded) {
    fetch(dataUrl)
      .then(response => response.text())
      .then(html => {
        slide.innerHTML += html;
        slide.dataset.loaded = 'true';
      });
  }
});
```

### Analytics Integration

```javascript
Reveal.on('slidechanged', event => {
  // Track slide views
  gtag('event', 'slide_view', {
    slide_index: event.indexh,
    slide_title: event.currentSlide.querySelector('h2')?.textContent
  });
});

Reveal.on('fragmentshown', event => {
  // Track fragment interactions
  gtag('event', 'fragment_shown', {
    fragment_index: event.fragment.dataset.fragmentIndex
  });
});
```

### Presentation Timer

```javascript
let startTime;

Reveal.on('ready', () => {
  startTime = Date.now();
});

Reveal.on('slidechanged', () => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`Time elapsed: ${elapsed}s`);
});
```

### Slide-specific Actions

```javascript
Reveal.on('slidechanged', event => {
  const slideId = event.currentSlide.id;
  
  switch(slideId) {
    case 'demo-slide':
      startDemo();
      break;
    case 'video-slide':
      playVideo();
      break;
    case 'quiz-slide':
      loadQuiz();
      break;
  }
});
```

## Debugging

```javascript
// Log all events
['slidechanged', 'fragmentshown', 'fragmenthidden', 'ready', 'paused', 'resumed']
  .forEach(eventName => {
    Reveal.on(eventName, event => {
      console.log(`Event: ${eventName}`, event);
    });
  });

// Inspect current state
console.log('Config:', Reveal.getConfig());
console.log('State:', Reveal.getState());
console.log('Indices:', Reveal.getIndices());
console.log('Current slide:', Reveal.getCurrentSlide());
console.log('Is ready:', Reveal.isReady());
console.log('Scale:', Reveal.getScale());
```
