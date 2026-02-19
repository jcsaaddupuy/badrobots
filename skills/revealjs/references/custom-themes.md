# Custom Themes and Styling

## Creating a Custom Theme

### Method 1: Override Built-in Theme

```html
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/black.css">
  
  <style>
    /* Override theme variables */
    :root {
      --r-background-color: #1a1a1a;
      --r-main-color: #e0e0e0;
      --r-heading-color: #ffffff;
      --r-link-color: #42affa;
      --r-selection-background-color: #42affa;
      --r-selection-color: #fff;
    }
    
    /* Custom styles */
    .reveal h1 {
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    
    .reveal section img {
      border: none;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
    }
    
    .reveal .controls {
      color: #42affa;
    }
  </style>
</head>
```

### Method 2: Complete Custom Theme

Create a separate CSS file:

```css
/* custom-theme.css */

/* Color palette */
:root {
  --primary-color: #2c3e50;
  --secondary-color: #3498db;
  --accent-color: #e74c3c;
  --text-color: #2c3e50;
  --background-color: #ecf0f1;
  --heading-color: #2c3e50;
}

/* Background */
.reveal-viewport {
  background: var(--background-color);
  background-image: linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%);
}

/* Typography */
.reveal {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 40px;
  font-weight: normal;
  color: var(--text-color);
}

.reveal h1,
.reveal h2,
.reveal h3,
.reveal h4,
.reveal h5,
.reveal h6 {
  font-family: 'Montserrat', sans-serif;
  color: var(--heading-color);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-transform: none;
  margin: 0 0 20px 0;
}

.reveal h1 { font-size: 2.5em; }
.reveal h2 { font-size: 1.8em; }
.reveal h3 { font-size: 1.4em; }

/* Links */
.reveal a {
  color: var(--secondary-color);
  text-decoration: none;
  transition: color 0.15s ease;
}

.reveal a:hover {
  color: var(--accent-color);
  text-shadow: none;
  border: none;
}

/* Code blocks */
.reveal pre {
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

.reveal code {
  font-family: 'Fira Code', monospace;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 3px;
}

/* Lists */
.reveal ul,
.reveal ol {
  text-align: left;
}

.reveal ul li,
.reveal ol li {
  margin-bottom: 0.5em;
}

/* Images */
.reveal section img {
  border: none;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

/* Controls */
.reveal .controls {
  color: var(--secondary-color);
}

/* Progress bar */
.reveal .progress {
  background: rgba(0, 0, 0, 0.2);
  color: var(--secondary-color);
}

/* Slide number */
.reveal .slide-number {
  color: var(--text-color);
  background-color: rgba(255, 255, 255, 0.8);
  padding: 5px 10px;
  border-radius: 3px;
}
```

Use in HTML:

```html
<link rel="stylesheet" href="custom-theme.css">
```

## CSS Variables Reference

Common reveal.js CSS variables:

```css
:root {
  /* Colors */
  --r-background-color: #fff;
  --r-main-color: #222;
  --r-heading-color: #222;
  --r-link-color: #2a76dd;
  --r-link-color-hover: #6ca0e8;
  --r-selection-background-color: #98bdef;
  --r-selection-color: #fff;
  
  /* Typography */
  --r-main-font: 'Source Sans Pro', Helvetica, sans-serif;
  --r-main-font-size: 40px;
  --r-heading-font: 'Source Sans Pro', Helvetica, sans-serif;
  --r-heading-font-weight: 600;
  --r-heading-line-height: 1.2;
  --r-heading-letter-spacing: normal;
  --r-heading-text-transform: uppercase;
  
  /* Code */
  --r-code-font: monospace;
  
  /* Blocks */
  --r-block-margin: 20px;
  --r-heading-margin: 0 0 20px 0;
}
```

## Custom Slide Classes

```html
<section class="custom-slide">
  <h2>Styled Slide</h2>
</section>

<style>
  .custom-slide {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  .custom-slide h2 {
    color: white;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  }
</style>
```

## Layout Utilities

```css
/* Center content vertically and horizontally */
.center-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}

/* Two-column layout */
.two-columns {
  display: flex;
  gap: 2rem;
}

.two-columns > * {
  flex: 1;
}

/* Grid layout */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

/* Card style */
.card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

## Responsive Design

```css
/* Adjust for smaller screens */
@media (max-width: 768px) {
  .reveal {
    font-size: 32px;
  }
  
  .reveal h1 { font-size: 2em; }
  .reveal h2 { font-size: 1.5em; }
  
  .two-columns {
    flex-direction: column;
  }
}
```

## Print Styles

```css
@media print {
  .reveal .slides section {
    page-break-after: always;
    page-break-inside: avoid;
  }
  
  .reveal .controls,
  .reveal .progress,
  .reveal .slide-number {
    display: none !important;
  }
  
  .reveal section img {
    max-width: 100%;
    page-break-inside: avoid;
  }
}
```

## Google Fonts Integration

```html
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
  
  <style>
    .reveal {
      font-family: 'Open Sans', sans-serif;
    }
    
    .reveal h1,
    .reveal h2,
    .reveal h3 {
      font-family: 'Montserrat', sans-serif;
    }
  </style>
</head>
```
