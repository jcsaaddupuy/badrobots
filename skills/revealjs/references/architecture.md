# Reveal.js Architecture & Lifecycle

Deep dive into reveal.js internal architecture and initialization lifecycle.

## Core Architecture

Reveal.js follows a modular architecture centered around a main Reveal API that orchestrates various controllers.

### Core Components

**Reveal Object**
- Main API exported from `js/reveal.js`
- Provides methods like `initialize()`, `slide()`, `next()`, `prev()`
- Coordinates all controllers and manages presentation state
- Handles event delegation and API calls

**Controllers System**
- Specialized modules in `js/controllers/` directory
- Each controller manages a specific functionality area
- All receive reference to main Reveal instance for cross-controller communication

**Plugins System**
- Extensions in `plugin/` directories
- Register with plugin system during initialization
- Can hook into lifecycle events and extend functionality

**DOM Management**
- Caches references to `.reveal`, `.slides`, and slide `<section>` elements
- Reduces DOM queries for performance
- Manages DOM updates during transitions

### Controllers Reference

| Controller | File | Responsibility |
|-----------|------|-----------------|
| slideContent | `js/controllers/slidecontent.js` | Loads media, manages iframe content |
| slideNumber | `js/controllers/slidenumber.js` | Displays slide numbers and navigation UI |
| backgrounds | `js/controllers/backgrounds.js` | Manages background images/videos/gradients |
| autoAnimate | `js/controllers/autoanimate.js` | FLIP-based element animations between slides |
| fragments | `js/controllers/fragments.js` | Step-by-step content reveals |
| overview | `js/controllers/overview.js` | Grid view of all slides |
| keyboard | `js/controllers/keyboard.js` | Keyboard navigation bindings |
| touch | `js/controllers/touch.js` | Touch gesture handling (swipe, pinch) |
| location | `js/controllers/location.js` | URL hash management and deep linking |
| controls | `js/controllers/controls.js` | Navigation arrow buttons |
| progress | `js/controllers/progress.js` | Progress bar at bottom |
| plugins | `js/controllers/plugins.js` | Plugin registration and lifecycle |

## Initialization Lifecycle

Reveal.js follows a defined lifecycle from script loading to user interaction.

### Key Lifecycle Phases

**1. initialize()**
- Creates controller instances
- Merges user config with defaults
- Caches DOM elements
- Called once at startup

```javascript
Reveal.initialize({
  hash: true,
  transition: 'slide',
  plugins: [ RevealMarkdown, RevealHighlight ]
});
```

**2. Plugin Loading**
- `plugins.load()` processes plugins array
- Each plugin's `init()` method called
- Plugins can hook into Reveal API

```javascript
// Plugin structure
export const MyPlugin = {
  id: 'my-plugin',
  init: (reveal) => {
    // Plugin initialization
    reveal.addEventListener('slidechanged', (event) => {
      console.log('Slide changed to', event.indexh);
    });
  }
};

// Register
Reveal.initialize({
  plugins: [ MyPlugin ]
});
```

**3. start()**
- Prepares slide content
- Sets up event listeners
- Applies initial layout
- Starts internal loops (resize, layout)

**4. Navigation**
- Controllers handle user input
- Call core navigation methods
- Emit events for plugins to react

### Internal Navigation Flow

```
User Input (keyboard, touch, click)
  ↓
Controller (keyboard, touch, controls)
  ↓
Reveal.slide() method
  ↓
Update indexh/indexv state
  ↓
All Controllers react:
  - backgroundsController: Update background
  - fragmentsController: Update fragment state
  - slideNumberController: Update slide number
  - autoAnimateController: Animate elements
  - locationController: Update URL hash
  ↓
'slidechanged' event emitted
```

## Navigation Systems

Reveal.js manages navigation through multiple systems working together.

### Navigation Methods

| Method | Controller | Description |
|--------|-----------|-------------|
| Keyboard | keyboard | Arrow keys, space, Page Up/Down |
| Touch | touch | Swipe gestures on mobile devices |
| UI Controls | controls | On-screen navigation arrows |
| URL Hash | location | URL-based navigation (e.g., `#/2/1`) |
| API | Various | Methods like `slide()`, `next()`, `prev()` |

### Navigation State Tracking

```javascript
// Current position tracked via indices
Reveal.getIndices() // Returns { h, v, f } - horizontal, vertical, fragment

// Navigate programmatically
Reveal.slide(slideIndex, fragmentIndex);  // Absolute
Reveal.next();                             // Next slide
Reveal.prev();                             // Previous slide
Reveal.down();                             // Vertical (if available)
Reveal.up();                               // Vertical (if available)
Reveal.left();                             // Previous
Reveal.right();                            // Next

// Query navigation
Reveal.isFirstSlide();                     // Boolean
Reveal.isLastSlide();                      // Boolean
Reveal.isVerticalSlide();                  // Boolean
Reveal.canNextSlide();                     // Boolean
Reveal.canPreviousSlide();                 // Boolean
```

### URL Hash Format

```
#/[horizontal]/[vertical]/[fragment]

Examples:
#/0          First slide
#/2          Slide 3
#/2/1        Slide 3, vertical sub-slide 2
#/2/1/2      Slide 3, vertical sub-slide 2, fragment 3
```

## Event System

Reveal.js emits events at key points in the lifecycle and navigation flow.

### Key Events

```javascript
// Slide navigation events
Reveal.addEventListener('slidechanged', (event) => {
  // event.previousSlide, event.currentSlide, event.indexh, event.indexv
});

Reveal.addEventListener('fragmentshown', (event) => {
  // event.fragment
});

Reveal.addEventListener('fragmenthidden', (event) => {
  // event.fragment
});

// Presentation state events
Reveal.addEventListener('ready', () => {
  // Reveal.js has initialized
});

Reveal.addEventListener('paused', () => {
  // Presentation paused
});

Reveal.addEventListener('resumed', () => {
  // Presentation resumed
});

// Presentation mode events
Reveal.addEventListener('overviewshown', () => {
  // Overview mode activated
});

Reveal.addEventListener('overviewhidden', () => {
  // Overview mode deactivated
});

// Custom event triggering
Reveal.dispatchPostInitEvent('custom-event', {
  data: 'custom value'
});
```

## Configuration & Initialization

### All Configuration Options

```javascript
Reveal.initialize({
  // Display
  width: 960,                           // Presentation width
  height: 700,                          // Presentation height
  margin: 0.04,                         // Margin around content (fraction)
  minScale: 0.2,                        // Min zoom for responsive
  maxScale: 2.0,                        // Max zoom for responsive
  center: true,                         // Center slides vertically
  
  // Navigation
  controls: true,                       // Show arrow buttons
  progress: true,                       // Show progress bar
  slideNumber: false,                   // Show slide number
  hash: true,                           // Enable URL hash navigation
  keyboard: true,                       // Enable keyboard navigation
  touch: true,                          // Enable touch navigation
  overview: true,                       // Enable overview mode
  
  // Transitions
  transition: 'slide',                  // none/fade/slide/convex/concave/zoom
  transitionSpeed: 'default',           // default/fast/slow
  backgroundTransition: 'fade',         // Background transition
  
  // Auto-Animate
  autoAnimate: true,                    // Enable auto-animate
  autoAnimateDuration: 1.0,             // Animation duration (seconds)
  autoAnimateEasing: 'ease',            // CSS easing function
  autoAnimateUnmatched: true,           // Animate unmatched elements
  
  // Fragments
  fragments: true,                      // Enable fragments
  fragmentInURL: false,                 // Include fragments in URL hash
  
  // Help & Features
  help: true,                           // Show help on '?'
  showNotes: false,                     // Embed notes in presentation
  showHiddenSlides: false,              // Show slides with visibility:hidden
  
  // Presentation Size
  respondToHashChanges: true,           // Update slides when hash changes
  
  // Plugin array
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

## Performance Optimization

### Best Practices

1. **Minimize DOM elements** - Reduce reflows during transitions
2. **Use will-change CSS** - Hint browser about animations
3. **Load plugins selectively** - Only include needed plugins
4. **Optimize backgrounds** - Use compressed images/videos
5. **Cache DOM references** - Don't repeatedly query DOM
6. **Use requestAnimationFrame** - Sync with browser refresh

### Performance Profiling

```javascript
// Measure initialization time
console.time('Reveal init');
Reveal.initialize(config);
console.timeEnd('Reveal init');

// Monitor transitions
Reveal.addEventListener('slidechanged', () => {
  console.time('Slide transition');
});

// Use browser DevTools
// - Chrome DevTools Performance tab
// - Record frame-by-frame rendering
// - Check for layout thrashing
```

## Advanced Usage

### Accessing Controller Methods

```javascript
// Get internal state
const state = Reveal.getState();
// { h, v, f, paused, overview }

// Save/restore state
const saved = Reveal.getState();
Reveal.setState(saved);

// Query current slide
const currentSlide = Reveal.getCurrentSlide();
const slides = Reveal.getSlides();

// Get all presentation data
const config = Reveal.getConfig();
```

### Creating Custom Controllers

You can extend Reveal.js with custom controllers:

```javascript
const CustomController = {
  // Initialize when Reveal is ready
  init: (reveal) => {
    reveal.addEventListener('slidechanged', (event) => {
      // Custom logic
    });
  },

  // Cleanup (optional)
  destroy: () => {
    // Cleanup code
  }
};

// Register as plugin
Reveal.initialize({
  plugins: [ CustomController ]
});
```

## Troubleshooting

### Common Issues

**Issue: Slides not rendering**
- Check reveal.js script loaded before initialization
- Verify HTML structure has `.reveal` > `.slides` > `<section>`
- Check console for JavaScript errors

**Issue: Navigation not working**
- Verify keyboard/touch controllers enabled
- Check custom event handlers aren't preventing defaults
- Verify hash navigation enabled if using URL-based nav

**Issue: Plugins not loading**
- Check plugins array in initialize config
- Verify plugin files loaded before Reveal.initialize()
- Check browser console for plugin errors

**Issue: Performance issues**
- Reduce slide count or complexity
- Optimize background images/videos
- Disable unused transitions
- Check for memory leaks in event handlers
- Profile with DevTools Performance tab
