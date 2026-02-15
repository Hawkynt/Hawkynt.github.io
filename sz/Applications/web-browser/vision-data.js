;(function(){window.__visionMd=`# Web Browser

A web browser for »SynthelicZ« that loads pages directly via iframe when possible and falls back to a CORS proxy when sites block iframe embedding, complete with navigation history, bookmarks, and a new-tab page.

## Product Requirements

### Purpose
Web Browser provides internet browsing capability within the »SynthelicZ« desktop, allowing users to visit websites, manage bookmarks, and navigate the web without leaving the desktop environment. It demonstrates how a browser-within-a-browser can work using iframes and CORS proxy fallback to maximize site compatibility.

### Key Capabilities
- URL navigation with automatic HTTPS prepending, back/forward history, refresh, stop, and home controls
- Dual-mode page loading that tries direct iframe embedding first and falls back to a CORS proxy for blocked sites
- Bookmark management with add, delete, persistence to localStorage, and a visible bookmarks bar
- New-tab page with a search/URL input field and quick-access tiles for popular sites
- Address bar with click-to-select, keyboard focus shortcut, and URL display
- Page source viewing via a dedicated dialog
- Status bar showing loading state and current URL

### Design Reference
Inspired by early versions of Mozilla Firefox and Internet Explorer, with a simple toolbar-driven navigation interface, bookmarks bar, and new-tab page with quick-access tiles similar to modern browsers like Chrome and Edge.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Navigation
- [x] As a user, I can type a URL in the address bar and press Enter or click Go to navigate
- [x] As a user, I can navigate back through history with the Back button or Alt+Left
- [x] As a user, I can navigate forward through history with the Forward button or Alt+Right
- [x] As a user, I can refresh the current page with the Refresh button or F5
- [x] As a user, I can stop a page from loading with the Stop button or Escape
- [x] As a user, I can return to the home/new-tab page with the Home button
- [x] As a user, I can see Back/Forward buttons disabled when there is no history in that direction
- [x] As a user, I can see URLs automatically prepended with https:// if no protocol is specified
- [x] As a user, I can open a URL passed via command line arguments

### Address Bar
- [x] As a user, I can see the current page URL in the address bar
- [x] As a user, I can click the address bar to select all text for easy replacement
- [x] As a user, I can focus the address bar with Ctrl+L

### New Tab Page
- [x] As a user, I see a styled new-tab page with a search/URL input when no page is loaded
- [x] As a user, I can type a URL in the new-tab page input and navigate
- [x] As a user, I can click quick-access tiles (Wikipedia, MDN, GitHub) to navigate
- [x] As a user, I can open a new tab (returning to the new-tab page) with Ctrl+T

### Page Loading
- [x] As a user, I can see pages load directly in an iframe for same-origin or permissive sites
- [x] As a user, I see automatic fallback to a CORS proxy when direct iframe loading is blocked
- [x] As a user, I see a proxy info bar when content is loaded via the web proxy
- [x] As a user, I can dismiss the proxy info bar
- [x] As a user, I can see an error page with a helpful message when a site cannot be loaded by either method
- [x] As a user, I can click a link on the error page to open the URL in a real browser tab
- [x] As a user, I can see loading status messages in the status bar

### Bookmarks
- [x] As a user, I can add the current page as a bookmark (Ctrl+D)
- [x] As a user, I can see bookmarks displayed in a bookmarks bar below the address bar
- [x] As a user, I can click a bookmark to navigate to its URL
- [x] As a user, I can right-click a bookmark to open or delete it via a context menu
- [x] As a user, I can manage bookmarks through a dedicated dialog listing all bookmarks
- [x] As a user, I can delete bookmarks from the manage dialog
- [x] As a user, I can see bookmarks persisted in localStorage between sessions

### View Menu
- [x] As a user, I can refresh the page from the View menu
- [x] As a user, I can stop loading from the View menu
- [x] As a user, I can view the page source in a dialog

### Open Location Dialog
- [x] As a user, I can open a URL dialog with Ctrl+L or from the File menu
- [x] As a user, I can type a URL and press Enter in the dialog to navigate
- [x] As a user, I can cancel the dialog with Escape

### Status Bar
- [x] As a user, I can see the current loading status in the status bar
- [x] As a user, I can see the current URL in the status bar

### Window Title
- [x] As a user, I can see the page title or URL displayed in the window title bar

### Keyboard Shortcuts
- [x] As a user, I can press F5 to refresh
- [x] As a user, I can press Escape to stop loading
- [x] As a user, I can press Alt+Left/Right for back/forward navigation
- [x] As a user, I can press Ctrl+T for a new tab
- [x] As a user, I can press Ctrl+L to focus the address bar
- [x] As a user, I can press Ctrl+D to add a bookmark

### Future Enhancements
- [ ] As a user, I want multiple tabs with a tab bar for concurrent browsing
- [ ] As a user, I want browsing history viewable in a dedicated panel
- [ ] As a user, I want a download manager for file downloads
- [ ] As a user, I want a find-in-page feature (Ctrl+F)
- [ ] As a user, I want zoom in/out controls for page content
- [ ] As a user, I want bookmark folders for organizing bookmarks
- [ ] As a user, I want to import and export bookmarks
- [ ] As a user, I want a privacy/incognito mode that does not save history
- [ ] As a user, I want to see a favicon next to each bookmark
- [ ] As a user, I want to see a loading progress indicator or spinner
`})();
