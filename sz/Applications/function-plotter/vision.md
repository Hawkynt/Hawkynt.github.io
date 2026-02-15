# Product Requirements Document: Function Plotter

**Version:** 2.0
**Scope:** Offline PWA with Symbolic Analysis
**Target:** Web (Desktop & Mobile)

## 1. Objective

To provide SynthelicZ OS users with a professional-grade, offline-capable mathematical visualization tool. The app must bridge the gap between a standard graphing calculator and a computer algebra system, offering features like parameterized plotting ("Function Families") and deep mathematical analysis ("Kurvendiskussion") entirely client-side.

## 2. Core Features

### 2.1. The Intelligent Editor

* **Rich Text Input:** Replaces standard input fields. Supports syntax highlighting (Functions=Blue, Variables=Orange, Numbers=Green).
* **Smart Autocomplete:** Suggests functions and constants as the user types (e.g., typing "hy" suggests `hypot`, `sinh`, etc.).
* **Inline Tooltips:** Hovering over a function name (e.g., `acosh`) displays its mathematical definition and domain constraints.

### 2.2. Mathematical Engine (The "Brain")

* **Symbolic Processing:** Uses a Computer Algebra System (CAS) like `Nerdamer` to perform exact calculations for derivatives and roots.
* **Numerical Fallback:** Uses `Math.js` or `Numeric.js` for plotting and when symbolic solutions are impossible.
* **Standard & Extended Library:** Supports a massive array of Trigonometric, Hyperbolic, Logarithmic, and Rounding functions (detailed in User Stories).

### 2.3. Interactive Visualization

* **Infinite Canvas:** A 2D Cartesian plane supporting infinite panning and zooming.
* **Smart Grid:** Grid lines and axis labels that adapt density based on zoom level.
* **Tracing:** Hovering the curve displays the exact  coordinate in a tooltip.
* **Discontinuity Handling:** Correctly handles asymptotes (e.g., ) without drawing vertical "jump" lines.

### 2.4. Function Families (Parameterized Plots)

* **Variable Detection:** Automatically detects the parameter  in expressions like .
* **Control Panel:** Provides two modes to define :
1. **Range Mode:** Min, Max, Step.
2. **List Mode:** Explicit values (e.g., `2, 4, 8`).


* **Rendering:** Plots multiple curves simultaneously with color variations.

### 2.5. Analysis Module ("Kurvendiskussion")

* **Automatic Analysis:** Calculates properties of  in a background Web Worker.
* **Scope:** Roots, Y-Intercepts, Extrema (Min/Max), Inflection Points, Saddle Points, Monotony Intervals, Continuity/Poles.
* **Visual Feedback:** Marks these critical points on the graph with interactive icons.

---

# 📝 Exhaustive User Story Backlog

This backlog is organized by feature set. Every requested function and constant has a specific verification item.

## Epic 1: General UI & Controls

| ID | Story | Acceptance Criteria |
| --- | --- | --- |
| **US-1.01** | As a user, I want to **Pan** the graph by dragging so I can explore the plane. | Graph moves 1:1 with mouse drag. FPS > 50. |
| **US-1.02** | As a user, I want to **Zoom** in/out using the mouse wheel centered on my cursor. | Zoom level updates; Grid lines re-scale automatically. |
| **US-1.03** | As a user, I want a **Reset View** button to return to the origin. | Viewport resets to . |
| **US-1.04** | As a user, I want to toggle the **Grid** visibility. | Checkbox toggles grid lines on/off. |
| **US-1.05** | As a user, I want to toggle **Axis Labels** visibility. | Checkbox toggles numeric labels on axes. |
| **US-1.06** | As a user, I want to **Export** the current view as a PNG. | Button triggers download of high-res image. |
| **US-1.07** | As a user, I want **Dark Mode** support. | UI themes switch; Graph background turns dark, lines turn light. |

## Epic 2: Intelligent Input (Editor)

| ID | Story | Acceptance Criteria |
| --- | --- | --- |
| **US-2.01** | As a user, I want **Syntax Highlighting** to distinguish math elements. | Functions: Blue, Numbers: Green, Vars: Orange. |
| **US-2.02** | As a user, I want **Autocomplete** for function names. | Typing "ta" suggests `tan`, `tanh`. |
| **US-2.03** | As a user, I want **Hover Tooltips** for functions. | Hovering `sin` shows "Sine Function". |
| **US-2.04** | As a user, I want **Error Validation** for mismatched parentheses. | Red underline on syntax error; "Missing )" message. |
| **US-2.05** | As a user, I want to use **Implicit Multiplication**. | `2x` is parsed as `2*x`; `xcos(x)` as `x*cos(x)`. |
| **US-2.06** | As a user, I want to use both **^ and **** for powers. | `x^2` and `x**2` yield identical plots. |

## Epic 3: Function Families (Parameter `t`)

| ID | Story | Acceptance Criteria |
| --- | --- | --- |
| **US-3.01** | As a user, I want the system to **Auto-Detect** parameter `t`. | Typing `t*x` reveals the Parameter Panel. |
| **US-3.02** | As a user, I want to set the **Parameter Min** value. | Input field accepts number (e.g., -5). |
| **US-3.03** | As a user, I want to set the **Parameter Max** value. | Input field accepts number (e.g., 5). |
| **US-3.04** | As a user, I want to set the **Parameter Step** size. | Input field accepts number (e.g., 0.5). |
| **US-3.05** | As a user, I want to use a **Custom List** for `t`. | Switch to "List Mode"; Input `1, 10, 100` works. |
| **US-3.06** | As a user, I want **Color Variations** for family curves. | Curves share hue but vary in lightness. |

## Epic 4: Mathematical Analysis (Kurvendiskussion)

| ID | Story | Acceptance Criteria |
| --- | --- | --- |
| **US-4.01** | As a user, I want to find **Exact Roots** (Nullstellen). | Panel lists  values where . Marker on graph. |
| **US-4.02** | As a user, I want to find the **Y-Intercept**. | Panel lists  value where . Marker on graph. |
| **US-4.03** | As a user, I want to find **Local Maxima** (Hochpunkte). | Panel lists coordinates. Marker on graph. |
| **US-4.04** | As a user, I want to find **Local Minima** (Tiefpunkte). | Panel lists coordinates. Marker on graph. |
| **US-4.05** | As a user, I want to find **Inflection Points** (Wendepunkte). | Panel lists coordinates where . |
| **US-4.06** | As a user, I want to find **Saddle Points** (Sattelpunkte). | Panel lists points where  AND . |
| **US-4.07** | As a user, I want to see **Monotony Intervals**. | Panel lists intervals (e.g., "Increasing: "). |
| **US-4.08** | As a user, I want to see **Continuity/Poles**. | Panel warns of undefined points (e.g.,  for ). |
| **US-4.09** | As a user, I want to see **Limits** at infinity. | Panel shows . |

## Epic 5: The Math Library (Specific Functions)

*Note: For all stories below, the "Acceptance Criteria" implies the function is parsed correctly, plotted accurately, and appears in autocomplete.*

### 5.1 Trigonometric Functions

| ID | Function | User Story |
| --- | --- | --- |
| **US-5.01** | `sin(x)` | As a user, I want to use `Sin()` to plot sine waves. |
| **US-5.02** | `cos(x)` | As a user, I want to use `Cos()` to plot cosine waves. |
| **US-5.03** | `tan(x)` | As a user, I want to use `Tan()` and see accurate asymptotes. |
| **US-5.04** | `cot(x)` | As a user, I want to use `Cot()` (Cotangent). |
| **US-5.05** | `csc(x)` | As a user, I want to use `Csc()` (Cosecant). |
| **US-5.06** | `sec(x)` | As a user, I want to use `Sec()` (Secant). |

### 5.2 Inverse Trigonometric

| ID | Function | User Story |
| --- | --- | --- |
| **US-5.07** | `asin(x)` | As a user, I want to use `Asin()` (Arc Sine). |
| **US-5.08** | `acos(x)` | As a user, I want to use `Acos()` (Arc Cosine). |
| **US-5.09** | `atan(x)` | As a user, I want to use `Atan()` (Arc Tangent). |
| **US-5.10** | `acot(x)` | As a user, I want to use `Acot()` (Arc Cotangent). |
| **US-5.11** | `acsc(x)` | As a user, I want to use `Acsc()` (Arc Cosecant). |
| **US-5.12** | `asec(x)` | As a user, I want to use `Asec()` (Arc Secant). |

### 5.3 Hyperbolic Functions

| ID | Function | User Story |
| --- | --- | --- |
| **US-5.13** | `sinh(x)` | As a user, I want to use `Sinh()` (Hyperbolic Sine). |
| **US-5.14** | `cosh(x)` | As a user, I want to use `Cosh()` (Hyperbolic Cosine). |
| **US-5.15** | `tanh(x)` | As a user, I want to use `Tanh()` (Hyperbolic Tangent). |
| **US-5.16** | `coth(x)` | As a user, I want to use `Coth()` (Hyperbolic Cotangent). |
| **US-5.17** | `csch(x)` | As a user, I want to use `Csch()` (Hyperbolic Cosecant). |
| **US-5.18** | `sech(x)` | As a user, I want to use `Sech()` (Hyperbolic Secant). |

### 5.4 Inverse Hyperbolic

| ID | Function | User Story |
| --- | --- | --- |
| **US-5.19** | `asinh(x)` | As a user, I want to use `Arsinh()` (Inverse Hyperbolic Sine). |
| **US-5.20** | `acosh(x)` | As a user, I want to use `Arcosh()` (Inverse Hyperbolic Cosine). |
| **US-5.21** | `atanh(x)` | As a user, I want to use `Artanh()` (Inverse Hyperbolic Tangent). |
| **US-5.22** | `acoth(x)` | As a user, I want to use `Arcoth()` (Inverse Hyperbolic Cotangent). |
| **US-5.23** | `acsch(x)` | As a user, I want to use `Arcsch()` (Inverse Hyperbolic Cosecant). |
| **US-5.24** | `asech(x)` | As a user, I want to use `Arsech()` (Inverse Hyperbolic Secant). |

### 5.5 Rounding & Discrete Math

| ID | Function | User Story |
| --- | --- | --- |
| **US-5.25** | `floor(x)` | As a user, I want to use `Floor()` to round down to the nearest integer. |
| **US-5.26** | `ceil(x)` | As a user, I want to use `Ceiling()` to round up to the nearest integer. |
| **US-5.27** | `trunc(x)` | As a user, I want to use `Truncate()` to remove decimal digits. |
| **US-5.28** | `round(x)` | As a user, I want to use `Round(x)` for standard rounding. |
| **US-5.29** | `round(x, n)` | As a user, I want to use `Round(x, decimals)` to round to specific precision. |
| **US-5.30** | `round(x, n, m)` | As a user, I want to use `Round` with MidpointRounding (Banker's) support. |
| **US-5.31** | `abs(x)` | As a user, I want to use `Abs()` to calculate absolute value. |
| **US-5.32** | `sign(x)` | As a user, I want to use `Sign()` to extract the sign (-1, 0, 1). |

### 5.6 Powers, Roots, Logs & Constants

| ID | Function | User Story |
| --- | --- | --- |
| **US-5.33** | `pow(b, e)` | As a user, I want to use `Pow(base, exponent)` as a function alternative to `^`. |
| **US-5.34** | `sqrt(x)` | As a user, I want to use `Sqrt()` for square roots. |
| **US-5.35** | `cbrt(x)` | As a user, I want to use `Cbrt()` for cube roots. |
| **US-5.36** | `log(x)` | As a user, I want `Log()` to represent the natural logarithm (). |
| **US-5.37** | `log10(x)` | As a user, I want to use `Log10()` for base-10 logarithms. |
| **US-5.38** | `log2(x)` | As a user, I want to use `Log2()` for base-2 logarithms. |
| **US-5.39** | `logn(x, b)` | As a user, I want to use `LogN(x, base)` for custom bases. |
| **US-5.40** | `exp(x)` | As a user, I want to use `Exp()` for . |
| **US-5.41** | `pi` | As a user, I want to use the constant `pi` in my expressions. |
| **US-5.42** | `e` | As a user, I want to use the constant `e` (Euler's number). |

### 3.1. Feature: Function Input
*   **Description:** Users can enter a mathematical function as a string in a dedicated input field. The function will be in terms of `x`.
*   **User Stories:**
    *   As a user, I want to type a standard mathematical expression like `x^2`, `sin(x)`, or `(x+3)*cos(x)` into a text box.
    *   As a user, I want to press an "Enter" key or click a "Plot" button to see the function rendered on the graph.
*   **Acceptance Criteria:**
    *   The input field accepts a wide range of standard mathematical characters.
    *   The parser supports standard operators (`+`, `-`, `*`, `/`, `^` for power).
    *   The parser supports common functions available in JavaScript's `Math` object (e.g., `sin`, `cos`, `tan`, `log`, `exp`, `sqrt`, `abs`).
    *   Invalid or insecure expressions are handled gracefully with a user-friendly error message.

### 3.2. Feature: 2D Plotting Canvas
*   **Description:** A canvas element serves as the main viewport for the graph, rendering the visual representation of the function(s).
*   **User Stories:**
    *   As a user, I want to see a 2D Cartesian plane with clearly marked X and Y axes.
    *   As a user, I want to see a grid in the background to help me gauge the scale and position of the plot.
*   **Acceptance Criteria:**
    *   The canvas displays a horizontal X-axis and a vertical Y-axis.
    *   The origin (0,0) is clearly visible.
    *   Major and minor grid lines are drawn on the canvas.
    *   Axis labels (e.g., -5, 0, 5) are drawn at regular intervals.

### 3.3. Feature: Zoom and Pan
*   **Description:** Users can change the view of the graph by zooming in/out and panning (moving the view).
*   **User Stories:**
    *   As a user, I want to use my mouse wheel to zoom in and out of the graph, centered on my cursor's position.
    *   As a user, I want to click and drag on the graph to pan the view left, right, up, and down.
    *   As a user, I want to see the grid and axis labels update dynamically as I zoom and pan.
*   **Acceptance Criteria:**
    *   Scrolling the mouse wheel up zooms in; scrolling down zooms out.
    *   Clicking and dragging the primary mouse button on the canvas moves the graph's origin.
    *   The function plot is re-rendered at the new zoom level and position.

### 3.4. Feature: Multi-Function Plotting
*   **Description:** Users can add and manage multiple functions on the same graph, with each function having a distinct visual appearance.
*   **User Stories:**
    *   As a user, I want to have a list of all functions currently being plotted.
    *   As a user, I want to click an "Add" button to get a new input field for another function.
    *   As a user, I want each function to be drawn in a different color.
    *   As a user, I want to be able to remove a function from the graph by clicking a "Delete" button next to it in the list.
*   **Acceptance Criteria:**
    *   The UI displays a list of currently plotted functions.
    *   A color is automatically assigned to each new function from a predefined palette.
    *   The canvas renders all active functions simultaneously.
    *   A legend is displayed, matching each function's expression to its color on the graph.
