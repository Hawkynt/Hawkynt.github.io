# Skin Format Reference

Comprehensive reference for all skin file formats supported or planned in the SynthelicZ desktop environment. Covers the original WindowBlinds UIS formats (UIS1, UIS1+, UIS2), archive packaging (WBA), the Winamp skin format (WSZ), and SynthelicZ's native skin.js format.

Sources:

- [The WindowBlinds UIS2 file language (v1.2)](https://archive.stardock.com/products/windowblinds/wb2_uis.html)
- [WindowBlinds 6 Help](https://archive.stardock.com/products/windowblinds/helpwb6/toc.htm)
- [SkinStudio Tutorial](https://archive.stardock.com/products/skinstudio/tutorial/tut_basic.html)
- [WindowBlinds 3 Skinning Guide](https://archive.stardock.com/products/windowblinds/wb3/wb3_guide_final.htm)

---

## Table of Contents

- [Skin Format Reference](#skin-format-reference)
  - [Table of Contents](#table-of-contents)
  - [Format Overview](#format-overview)
    - [Version Identification](#version-identification)
  - [WBA -- WindowBlinds Archive](#wba----windowblinds-archive)
    - [Structure](#structure)
    - [Naming Convention](#naming-convention)
    - [Loading in SynthelicZ](#loading-in-synthelicz)
  - [WSZ -- Winamp Skin Zip](#wsz----winamp-skin-zip)
    - [Structure](#structure-1)
    - [Relevance to SynthelicZ](#relevance-to-synthelicz)
  - [UIS1 -- Original Skin Format](#uis1----original-skin-format)
  - [UIS1+ -- Extended UIS1](#uis1----extended-uis1)
  - [UIS2 -- Current Standard](#uis2----current-standard)
    - [\[TitlebarSkin\]](#titlebarskin)
    - [\[Personality\]](#personality)
      - [Frame Bitmap Paths](#frame-bitmap-paths)
      - [Zone Parameters (3-Zone Tiling Model)](#zone-parameters-3-zone-tiling-model)
      - [Stretch/Tile Mode](#stretchtile-mode)
      - [Animation](#animation)
      - [Title Text](#title-text)
      - [Title Text Colours](#title-text-colours)
      - [Menu Bar](#menu-bar)
      - [Text Background (floating title background)](#text-background-floating-title-background)
      - [Button Behaviour](#button-behaviour)
      - [Transparency / Shape](#transparency--shape)
      - [Maximized Window Border Cutoff](#maximized-window-border-cutoff)
      - [Extended Features](#extended-features)
    - [\[Button*N*\] -- Titlebar Buttons](#buttonn----titlebar-buttons)
      - [Button Alignment Values](#button-alignment-values)
      - [Alpha Blend Operations](#alpha-blend-operations)
    - [\[Buttons\] -- Form Controls](#buttons----form-controls)
      - [Push Button States (in Bitmap)](#push-button-states-in-bitmap)
      - [Checkbox States (in CheckButton)](#checkbox-states-in-checkbutton)
      - [UIS2 Font/Colour References](#uis2-fontcolour-references)
    - [\[Colours\]](#colours)
    - [\[ColoursMask\] (UIS2)](#coloursmask-uis2)
    - [\[Font*N*\] (UIS2)](#fontn-uis2)
    - [\[Colour*N*\] (UIS2)](#colourn-uis2)
    - [\[StartButton\]](#startbutton)
    - [\[ComboButton\] (UIS2)](#combobutton-uis2)
    - [\[Taskbar\]](#taskbar)
    - [\[Tabs\]](#tabs)
    - [\[ToolBars\]](#toolbars)
    - [\[Scrollbar\]](#scrollbar)
      - [\[HorzScroll\] / \[VertScroll\]](#horzscroll--vertscroll)
      - [\[HorzScrollThumb\] / \[VertScrollThumb\]](#horzscrollthumb--vertscrollthumb)
      - [\[SmallHScrollThumb\] / \[SmallVScrollThumb\]](#smallhscrollthumb--smallvscrollthumb)
    - [\[Progress\]](#progress)
    - [\[MenuBars\]](#menubars)
    - [\[MDIControls\] (UIS2)](#mdicontrols-uis2)
    - [\[StatusBarsEdges\] (UIS2)](#statusbarsedges-uis2)
    - [\[SunkEdge\]](#sunkedge)
    - [\[GroupBox / GroupBoxEdge\] (UIS2)](#groupbox--groupboxedge-uis2)
      - [\[GroupBoxEdge\]](#groupboxedge)
      - [\[GroupBox\]](#groupbox)
    - [\[RebarGrip\] (UIS2)](#rebargrip-uis2)
    - [\[Layout*N*\]](#layoutn)
      - [Icon Properties](#icon-properties)
      - [Text Properties](#text-properties)
      - [Area Margins (with icon)](#area-margins-with-icon)
      - [Area Margins (without icon)](#area-margins-without-icon)
    - [\[Text\] -- Title Text Effects](#text----title-text-effects)
    - [Compound Skins (SSD/SSS)](#compound-skins-ssdsss)
  - [SZ skin.js -- SynthelicZ Native Format](#sz-skinjs----synthelicz-native-format)
    - [File Structure](#file-structure)
    - [skin.js Format](#skinjs-format)
    - [Sub-Skins (Color Schemes)](#sub-skins-color-schemes)
    - [Loading](#loading)
    - [Converting from UIS to skin.js](#converting-from-uis-to-skinjs)
  - [Frame Rendering Model](#frame-rendering-model)
    - [Frame Orientation](#frame-orientation)
    - [3-Zone Tiling Model](#3-zone-tiling-model)
      - [Horizontal Borders (TOP, BOTTOM)](#horizontal-borders-top-bottom)
      - [Vertical Borders (LEFT, RIGHT)](#vertical-borders-left-right)
    - [Animation Frames](#animation-frames)
  - [Button State Layout](#button-state-layout)
    - [TripleImages = 1 (6-state)](#tripleimages--1-6-state)
    - [TripleImages = 0 (3-state)](#tripleimages--0-3-state)
  - [Button Visibility System](#button-visibility-system)
    - [Common Patterns](#common-patterns)
  - [Button Action Codes](#button-action-codes)
  - [Transparency System](#transparency-system)
    - [Magenta Key Transparency](#magenta-key-transparency)
    - [Mask-Based Transparency](#mask-based-transparency)
    - [Per-Pixel Alpha (UIS1+)](#per-pixel-alpha-uis1)
    - [Button Alpha Blending](#button-alpha-blending)
  - [Color Masking System (UIS2)](#color-masking-system-uis2)
  - [Technical Constraints](#technical-constraints)

---

## Format Overview

| Format     | Extension | Type        | Description                                                                                 |
|------------|-----------|-------------|---------------------------------------------------------------------------------------------|
| UIS1       | `.uis`    | Text (INI)  | Original WindowBlinds skin format (deprecated)                                              |
| UIS1+      | `.uis`    | Text (INI)  | Extended UIS1 with per-pixel alpha support                                                  |
| UIS2       | `.uis`    | Text (INI)  | Current WindowBlinds standard; adds form controls, scrollbars, fonts, colour masks, layouts |
| WBA        | `.wba`    | RAR archive | WindowBlinds installable package containing UIS + BMP assets                                |
| SSD        | `.ssd`    | Text (INI)  | Compound skin definition (multiple UIS variants in one package)                             |
| SSS        | `.sss`    | Text (INI)  | Alternative skin style (standard UIS with different extension, used in compound skins)      |
| WSZ        | `.wsz`    | ZIP archive | Winamp Skin Zip -- renamed ZIP containing BMP + text config for Winamp player skins         |
| SZ skin.js | `.js`     | JavaScript  | SynthelicZ native format: self-registering IIFE with pre-built skin object                  |

### Version Identification

UIS skins declare their version via the `WBVer` key in `[TitlebarSkin]`:

| WBVer | Format            |
|-------|-------------------|
| 100   | UIS1              |
| 150   | UIS1+ (per-pixel) |
| 200   | UIS2              |

---

## WBA -- WindowBlinds Archive

A `.wba` file is a standard **RAR archive** renamed with the `.wba` extension. Double-clicking installs via WindowBlinds on the native Windows desktop.

### Structure

```
skinname.wba (RAR)
  skinname/
    skinname.uis          INI-format skin definition
    TOP.BMP               Top border frame image
    BOTTOM.BMP            Bottom border frame image
    LEFT.BMP              Left border frame image
    RIGHT.BMP             Right border frame image
    TOPM.BMP              Top border transparency mask (optional)
    BOTTOMM.BMP           Bottom border mask (optional)
    LEFTM.BMP             Left border mask (optional)
    RIGHTM.BMP            Right border mask (optional)
    CLOSE.BMP             Close button states
    MAX.BMP               Maximize button states
    MIN.BMP               Minimize button states
    RESTORE.BMP           Restore button states (optional)
    HELP.BMP              Help button states (optional)
    BUTTONS.BMP           Push button control sprite
    CHECK.BMP             Checkbox control sprite
    RADIO.BMP             Radio button control sprite
    MENU.BMP              Menu bar background
    MNUFRAME.BMP          Menu borders
    COMBO.BMP             Combo dropdown button
    START.BMP             Start button states
    EXPLORER.BMP          Explorer bar background (optional)
    DIALOG.BMP            Dialog background (optional)
    MDI.BMP               MDI background (optional)
    ...                   Additional images referenced in UIS
```

### Naming Convention

The `.wba` filename, the directory inside the archive, and the `.uis` filename must all match. When distributing as `.zip`, the zip filename must also match the `.uis` filename.

### Loading in SynthelicZ

SZ loads WBA files by:

1. Accepting the file via `<input type="file">` or drag-and-drop
2. Decompressing via a WASM-based unrar library
3. Extracting the `.uis` + image files to blob URLs
4. Parsing the UIS with `SZ.parseUIS(text, basePath)`
5. Registering the resulting skin object

---

## WSZ -- Winamp Skin Zip

The `.wsz` extension stands for **Winamp Skin Zip**. It is a standard ZIP archive renamed to `.wsz` so that Winamp auto-installs it on double-click.

### Structure

A WSZ contains approximately 45 files -- mostly BMP images with fixed filenames that cannot be renamed:

```
skinname.wsz (ZIP)
  main.bmp                Main window background
  titlebar.bmp            Title bar
  playpaus.bmp            Play/pause button states
  posbar.bmp              Position slider
  volume.bmp              Volume control
  balance.bmp             Balance slider
  shufrep.bmp             Shuffle/repeat buttons
  nums_ex.bmp             Digit font for time display
  text.bmp                Scrolling text font
  eq_ex.bmp               Equalizer background
  eqmain.bmp              Equalizer main
  pledit.txt              Playlist editor colors (text config)
  viscolor.txt            Visualization colors
  ...                     (fixed filenames per Winamp skin spec)
```

### Relevance to SynthelicZ

WSZ skins are relevant because SynthelicZ may include a Winamp-like audio player application. In that context, WSZ skins would be loaded to customize the player UI, not the desktop chrome. This is separate from the WindowBlinds UIS format used for window frames and system controls.

---

## UIS1 -- Original Skin Format

The original WindowBlinds format. Deprecated in favour of UIS2 but still parseable for backwards compatibility.

UIS1 supports:

- Window frame borders (top, left, right, bottom BMPs)
- Titlebar buttons with 3 states (normal, pressed, disabled/mouseover)
- Active/inactive frame variants (stacked in same BMP)
- Basic title text positioning
- System colour overrides
- Stretch/tile modes for frame middles
- Animation frames

UIS1 does **not** support:

- Form control skinning (buttons, checkboxes, radio buttons)
- Custom scrollbars
- Font definitions
- Colour masks
- Layout objects
- Per-pixel alpha (only magenta transparency)
- Compound skins

---

## UIS1+ -- Extended UIS1

UIS1+ (`WBVer=150`) extends UIS1 with **per-pixel alpha** support. Instead of using magenta `RGB(255,0,255)` for transparency, frame images can contain true alpha channel data. This produces smoother, semi-transparent window borders.

Per-pixel UIS1 skins are identified by the `WBVer=150` flag. They use the same section structure as UIS1 but the renderer composites frames using alpha blending rather than colour-key transparency.

---

## UIS2 -- Current Standard

The `.uis` file is a plain-text INI file. Sections are enclosed in `[SquareBrackets]`, keys use `Key=Value` syntax. Comments start with `;` or `#`. Blank lines are allowed. Order of sections and keys does not matter.

---

### [TitlebarSkin]

Required. Skin metadata.

| Key            | Type   | Description                                    |
|----------------|--------|------------------------------------------------|
| `SkinName`     | string | Display name                                   |
| `SkinAuthor`   | string | Author name                                    |
| `AuthorsURL`   | string | Author's website                               |
| `AuthorEmail`  | string | Contact email                                  |
| `SpecialNotes` | string | Release notes                                  |
| `WBVer`        | int    | Format version (100=UIS1, 150=UIS1+, 200=UIS2) |

---

### [Personality]

Required. Core skin definition -- frame images, animation, text, and behaviour.

#### Frame Bitmap Paths

| Key          | Type | Description                      |
|--------------|------|----------------------------------|
| `Top`        | path | Top border image                 |
| `Left`       | path | Left border image                |
| `Right`      | path | Right border image               |
| `Bottom`     | path | Bottom border image              |
| `TopMask`    | path | Top border alpha mask (optional) |
| `LeftMask`   | path | Left border mask (optional)      |
| `RightMask`  | path | Right border mask (optional)     |
| `BottomMask` | path | Bottom border mask (optional)    |

All paths are relative to the skin folder (using `\` as separator in the UIS file; SynthelicZ normalises to `/`).

Each border BMP contains **both active and inactive** states:

- **Horizontal borders** (Top/Bottom): active on top half, inactive on bottom half
- **Vertical borders** (Left/Right): active on left half, inactive on right half

When animation frames are present (`TopFrame > 1`), the ordering is: Active frame 1, Active frame 2, ..., Active frame N, Inactive frame.

#### Zone Parameters (3-Zone Tiling Model)

| Key               | Type     | Description                                                                            |
|-------------------|----------|----------------------------------------------------------------------------------------|
| `TopTopHeight`    | int (px) | Top border: Zone A width (fixed left section)                                          |
| `TopBotHeight`    | int (px) | Top border: Zone C width (fixed right section)                                         |
| `LeftTopHeight`   | int (px) | Left border: Zone A height (fixed top section)                                         |
| `LeftBotHeight`   | int (px) | Left border: Zone C height (fixed bottom section). **Must be >= bottom border height** |
| `RightTopHeight`  | int (px) | Right border: Zone A height (fixed top section)                                        |
| `RightBotHeight`  | int (px) | Right border: Zone C height (fixed bottom section)                                     |
| `BottomTopHeight` | int (px) | Bottom border: Zone A width (fixed left section)                                       |
| `BottomBotHeight` | int (px) | Bottom border: Zone C width (fixed right section)                                      |

#### Stretch/Tile Mode

| Key             | Type | Description                                  |
|-----------------|------|----------------------------------------------|
| `TopStretch`    | 0/1  | 0 = tile Zone B (repeat), 1 = stretch Zone B |
| `LeftStretch`   | 0/1  | Same for left border                         |
| `RightStretch`  | 0/1  | Same for right border                        |
| `BottomStretch` | 0/1  | Same for bottom border                       |

#### Animation

| Key            | Type     | Description                                                         |
|----------------|----------|---------------------------------------------------------------------|
| `TopFrame`     | int      | Number of frames in top border image (including inactive)           |
| `LeftFrame`    | int      | Same for left border                                                |
| `RightFrame`   | int      | Same for right border                                               |
| `BottomFrame`  | int      | Same for bottom border                                              |
| `AniRate`      | int (ms) | Milliseconds between animation frames. 1000 = 1 second              |
| `DynamicFrame` | 0/1      | Use different window shape per frame (incompatible with MaxBorder*) |

All border edges must have consistent frame counts.

#### Title Text

| Key             | Type     | Description                                |
|-----------------|----------|--------------------------------------------|
| `TextAlignment` | 0/1/2    | 0 = left, 1 = center, 2 = right            |
| `TextShift`     | int (px) | Horizontal offset from left                |
| `TextShiftVert` | int (px) | Vertical offset from top                   |
| `TextRightClip` | int (px) | Reserve space from right edge for buttons  |
| `TextOnBottom`  | 0/1      | Place title text on bottom border instead  |
| `FrontString`   | string   | Text prepended to window title (in quotes) |
| `EndString`     | string   | Text appended to window title (in quotes)  |

#### Title Text Colours

| Key             | Type  | Description               |
|-----------------|-------|---------------------------|
| `ActiveTextR`   | 0-255 | Active title text red     |
| `ActiveTextG`   | 0-255 | Active title text green   |
| `ActiveTextB`   | 0-255 | Active title text blue    |
| `InactiveTextR` | 0-255 | Inactive title text red   |
| `InactiveTextG` | 0-255 | Inactive title text green |
| `InactiveTextB` | 0-255 | Inactive title text blue  |

#### Menu Bar

| Key                                   | Type     | Description                                      |
|---------------------------------------|----------|--------------------------------------------------|
| `MenuBar`                             | path     | Menu bar background BMP                          |
| `MenuBorders`                         | path     | Menu border frame (3px wide)                     |
| `TileMenu`                            | 0/1      | 0 = stretch, 1 = tile middle section             |
| `TileLeftMenu`                        | int (px) | Non-stretched left pixels                        |
| `TileRightMenu`                       | int (px) | Non-stretched right pixels                       |
| `MenuLeftTile`                        | int (px) | Text offset from left                            |
| `MenuR`, `MenuG`, `MenuB`             | 0-255    | Menu selection highlight colour (all 3 required) |
| `MenuTextR`, `MenuTextG`, `MenuTextB` | 0-255    | Menu text colour                                 |

#### Text Background (floating title background)

| Key                  | Type     | Description                                         |
|----------------------|----------|-----------------------------------------------------|
| `TextBack`           | path     | Title background BMP (active top / inactive bottom) |
| `ActiveAlpha`        | 0-255    | Active transparency (255=opaque, 0=invisible)       |
| `InactiveAlpha`      | 0-255    | Inactive transparency                               |
| `TXTBackLeft`        | int (px) | Overhang left of text                               |
| `TXTBackRight`       | int (px) | Overhang right of text                              |
| `TextBackVisibility` | code     | Visibility control (supports TextBackVisibility1-9) |

#### Button Behaviour

| Key                 | Type     | Description                                                   |
|---------------------|----------|---------------------------------------------------------------|
| `ButtonCount`       | int      | Total titlebar buttons defined                                |
| `MouseOver`         | 0/1      | Enable hover effects on titlebar buttons                      |
| `TripleImages`      | 0/1      | 1 = 6-state buttons (3 states x active/inactive), 0 = 3-state |
| `RollupSize`        | int (px) | Window height when rolled up                                  |
| `RightClickAction`  | code     | Action on right-click (see action codes)                      |
| `DoubleClickAction` | code     | Action on title bar double-click (default: maximize)          |
| `SoundEnabled`      | 0/1      | Enable button sound effects                                   |

#### Transparency / Shape

| Key        | Type | Description                                |
|------------|------|--------------------------------------------|
| `UsesTran` | 0/1  | Titlebar button transparency (magenta key) |
| `NoShape`  | 0/1  | 1 = no transparency/faster performance     |

#### Maximized Window Border Cutoff

| Key                  | Type     | Description                                   |
|----------------------|----------|-----------------------------------------------|
| `MaxBorderCutLeft`   | int (px) | Pixels to cut from left border when maximized |
| `MaxBorderCutTop`    | int (px) | Cut from top                                  |
| `MaxBorderCutRight`  | int (px) | Cut from right                                |
| `MaxBorderCutBottom` | int (px) | Cut from bottom                               |

#### Extended Features

| Key                 | Type     | Description                                |
|---------------------|----------|--------------------------------------------|
| `ExplorerBmp`       | path     | Explorer bar background                    |
| `DialogBmp`         | path     | Dialog window background                   |
| `MDIBmp`            | path     | MDI workspace background                   |
| `MDIBmpMask`        | path     | MDI background mask                        |
| `Wallpaper`         | path     | Desktop wallpaper to set                   |
| `IconTheme`         | path     | IconPackager theme ZIP                     |
| `Exec`              | string   | Command to execute on selection            |
| `RunStyle`          | 0-7      | Window style for Exec (3=normal, 7=hidden) |
| `FadeLinkedButtons` | 0/1      | Enable fade transitions for linked buttons |
| `FadeRate`          | int (ms) | Fade transition speed                      |

---

### [Button*N*] -- Titlebar Buttons

Indexed from `[Button0]` through `[ButtonN]`. Count must match `ButtonCount` in `[Personality]`.

| Key               | Type     | Description                                                |
|-------------------|----------|------------------------------------------------------------|
| `ButtonImage`     | path     | Button state sprite BMP                                    |
| `ButtonImageMask` | path     | Button alpha mask (optional)                               |
| `Align`           | 0-8      | Anchor point (see alignment table below)                   |
| `XCoord`          | int (px) | Horizontal offset from anchor                              |
| `YCoord`          | int (px) | Vertical offset from anchor                                |
| `Action`          | code     | Primary click action (see action codes)                    |
| `ShiftAction`     | code     | Shift+click action                                         |
| `CtrlAction`      | code     | Ctrl+click action                                          |
| `Command`         | string   | Execute path (for Action=5)                                |
| `Visibility`      | code     | When to show (supports Visibility1-9 for AND combinations) |
| `Alpha`           | 0-255    | Button transparency (255=opaque)                           |
| `AlphaOp`         | code     | Blend operation (see alpha operations)                     |
| `CombineOp`       | -1/0/2   | -1=normal, 0=cut from border, 2=add to border              |
| `LinkedTo`        | int      | Button index for linked visibility                         |
| `InSound`         | path     | WAV played on press                                        |
| `OutSound`        | path     | WAV played on release                                      |
| `DllName`         | string   | DLL filename (for Action=-3)                               |
| `Width`           | int (px) | DLL button width                                           |
| `Height`          | int (px) | DLL button height                                          |

#### Button Alignment Values

| Align | Anchor               |
|-------|----------------------|
| 0     | Top-left of window   |
| 1     | Top-right of window  |
| 2     | Bottom-left          |
| 3     | Bottom-right         |
| 4     | Middle-top           |
| 5     | Middle-bottom        |
| 6     | Middle-left          |
| 7     | Middle-right         |
| 8     | Left of caption text |

#### Alpha Blend Operations

| AlphaOp | Operation                  |
|---------|----------------------------|
| 0       | Simple alpha blend         |
| 1       | Flipped alpha blend        |
| 3       | Darken (darkest pixel)     |
| 4       | Lighten (lightest pixel)   |
| 5       | Multiply                   |
| 6       | Screen                     |
| 7       | Difference                 |
| 8       | Simple transparency        |
| 9       | Blur (Alpha = blur amount) |
| 10      | Graduated alpha blend      |
| 11      | Slight horizontal blend    |

---

### [Buttons] -- Form Controls

Skins form-level controls: push buttons, checkboxes, radio buttons.

| Key               | Type     | Description                                                |
|-------------------|----------|------------------------------------------------------------|
| `Bitmap`          | path     | Push button 9-slice sprite                                 |
| `BitmapMask`      | path     | Push button alpha mask                                     |
| `CheckButton`     | path     | Checkbox sprite                                            |
| `CheckButtonMask` | path     | Checkbox alpha mask                                        |
| `RadioButton`     | path     | Radio button sprite (falls back to CheckButton if omitted) |
| `TopHeight`       | int (px) | 9-slice top cap                                            |
| `BottomHeight`    | int (px) | 9-slice bottom cap                                         |
| `LeftWidth`       | int (px) | 9-slice left cap                                           |
| `RightWidth`      | int (px) | 9-slice right cap                                          |
| `Trans`           | 0/1      | Magenta transparency enabled                               |
| `Tile`            | 0/1      | 0 = stretch middle, 1 = tile middle                        |
| `MouseOver`       | 0/1      | Hover state enabled                                        |
| `FrameCount`      | int      | State count in push button sprite                          |

#### Push Button States (in Bitmap)

States arranged horizontally: 1=Normal, 2=Pressed, 3=Disabled, 4=Focus, 5=Default

#### Checkbox States (in CheckButton)

States arranged: 1=Normal unchecked, 2=Checked, 3=Greyed unchecked, 4=Greyed checked

#### UIS2 Font/Colour References

| Key                             | Type  | Description                                     |
|---------------------------------|-------|-------------------------------------------------|
| `NormalFont`                    | 0-255 | Font index for normal state (255=WB1.x default) |
| `PressedFont`                   | 0-255 | Font index for pressed                          |
| `DisabledFont`                  | 0-255 | Font index for disabled                         |
| `FocusFont`                     | 0-255 | Font index for focused                          |
| `DefaultFont`                   | 0-255 | Font index for default button                   |
| `MouseOverFont`                 | 0-255 | Font index for hover                            |
| `NormalColour`                  | 0-255 | Colour index for normal                         |
| `PressedColour`                 | 0-255 | Colour index for pressed                        |
| `DisabledColour`                | 0-255 | Colour index for disabled                       |
| `FocusColour`                   | 0-255 | Colour index for focused                        |
| `DefaultColour`                 | 0-255 | Colour index for default                        |
| `NormalLayout`..`DefaultLayout` | 0-255 | Layout index per state                          |

---

### [Colours]

All 29 Windows system colours. Format: `ColourName = R G B` (space-separated decimal 0-255).

| Key                     | CSS Custom Property                  | Description                       |
|-------------------------|--------------------------------------|-----------------------------------|
| `Scrollbar`             | `--sz-color-scrollbar`               | Scrollbar track background        |
| `Background`            | `--sz-color-background`              | Desktop background                |
| `ActiveTitle`           | `--sz-color-active-title`            | Active title bar gradient start   |
| `InactiveTitle`         | `--sz-color-inactive-title`          | Inactive title bar gradient start |
| `Menu`                  | `--sz-color-menu`                    | Menu/toolbar background           |
| `Window`                | `--sz-color-window`                  | Window/input background           |
| `WindowFrame`           | `--sz-color-window-frame`            | Window border/frame               |
| `MenuText`              | `--sz-color-menu-text`               | Menu text                         |
| `WindowText`            | `--sz-color-window-text`             | Window/body text                  |
| `TitleText`             | `--sz-color-title-text`              | Active title bar text             |
| `ActiveBorder`          | `--sz-color-active-border`           | Active window border fill         |
| `InactiveBorder`        | `--sz-color-inactive-border`         | Inactive window border fill       |
| `AppWorkspace`          | `--sz-color-app-workspace`           | MDI/workspace background          |
| `Hilight`               | `--sz-color-highlight`               | Selection background              |
| `HilightText`           | `--sz-color-highlight-text`          | Selection text                    |
| `ButtonFace`            | `--sz-color-button-face`             | Button/control face               |
| `ButtonShadow`          | `--sz-color-button-shadow`           | Button shadow (3D bottom-right)   |
| `GrayText`              | `--sz-color-gray-text`               | Disabled text                     |
| `ButtonText`            | `--sz-color-button-text`             | Button label text                 |
| `InactiveTitleText`     | `--sz-color-inactive-title-text`     | Inactive title text               |
| `ButtonHilight`         | `--sz-color-button-highlight`        | Button highlight (3D top-left)    |
| `ButtonDkShadow`        | `--sz-color-button-dark-shadow`      | Button outer dark edge            |
| `ButtonLight`           | `--sz-color-button-light`            | Button light edge                 |
| `InfoText`              | `--sz-color-info-text`               | Tooltip text                      |
| `InfoWindow`            | `--sz-color-info-window`             | Tooltip background                |
| `ButtonAlternateFace`   | `--sz-color-button-alt-face`         | Alternate button face             |
| `HotTrackingColor`      | `--sz-color-hot-tracking`            | Hot-tracked links                 |
| `GradientActiveTitle`   | `--sz-color-gradient-active-title`   | Active title gradient end         |
| `GradientInactiveTitle` | `--sz-color-gradient-inactive-title` | Inactive title gradient end       |

---

### [ColoursMask] (UIS2)

Same keys as `[Colours]` but values are blend intensities (0-255): 0 = no colour change, 255 = full replacement with the corresponding `[Colours]` value. Used for selective colour tinting.

---

### [Font*N*] (UIS2)

Custom font definitions referenced by index from button/control sections.

| Key          | Type     | Description                   |
|--------------|----------|-------------------------------|
| `FontName`   | string   | Font family name              |
| `FontHeight` | int (pt) | Font size in points           |
| `FontWeight` | 100-900  | Weight (400=normal, 700=bold) |
| `Italics`    | 0/1      | Italic style                  |
| `Underline`  | 0/1      | Underline style               |
| `AntiAlias`  | 0/1      | Anti-aliased rendering        |
| `FontAngle`  | int      | Rotation in tenths of degrees |

---

### [Colour*N*] (UIS2)

Custom colour definitions referenced by index.

| Key | Type  |
|-----|-------|
| `r` | 0-255 |
| `g` | 0-255 |
| `b` | 0-255 |

---

### [StartButton]

The Start button on the taskbar.

| Key     | Type | Description                                           |
|---------|------|-------------------------------------------------------|
| `Image` | path | Start button BMP. Simply stretched to fit, no 9-slice |

The image contains 3 horizontal frames: Normal, Hover, Pressed. Frame width = image width / 3.

When `TripleImages=1` in `[Personality]`, the start button may contain 6 frames (3 active + 3 inactive), though in practice most skins use 3.

---

### [ComboButton] (UIS2)

Dropdown arrow button next to combo boxes / select elements.

| Key            | Type     | Description         |
|----------------|----------|---------------------|
| `Image`        | path     | Combo button sprite |
| `TopHeight`    | int (px) | 9-slice top         |
| `BottomHeight` | int (px) | 9-slice bottom      |
| `LeftWidth`    | int (px) | 9-slice left        |
| `RightWidth`   | int (px) | 9-slice right       |
| `MouseOver`    | 0/1      | Hover state         |
| `Tile`         | 0/1      | Tile mode           |

---

### [Taskbar]

Taskbar button sprite. Falls back to `[Buttons]` Bitmap if this section is omitted.

| Key            | Type     | Description                           |
|----------------|----------|---------------------------------------|
| `Image`        | path     | Button sprite (normal/pressed states) |
| `TopHeight`    | int (px) | 9-slice top                           |
| `BottomHeight` | int (px) | 9-slice bottom                        |
| `LeftWidth`    | int (px) | 9-slice left                          |
| `RightWidth`   | int (px) | 9-slice right                         |

---

### [Tabs]

Tab control skinning.

| Key            | Type     | Description                        |
|----------------|----------|------------------------------------|
| `Image`        | path     | Tab sprite (button format)         |
| `Border`       | path     | Frame sprite (menu borders format) |
| `TopHeight`    | int (px) | 9-slice top                        |
| `BottomHeight` | int (px) | 9-slice bottom                     |
| `LeftWidth`    | int (px) | 9-slice left                       |
| `RightWidth`   | int (px) | 9-slice right                      |
| `SpacerImg`    | path     | Fill from last tab to edge (UIS2)  |

---

### [ToolBars]

Toolbar button skinning.

| Key            | Type     | Description           |
|----------------|----------|-----------------------|
| `Image`        | path     | Toolbar button sprite |
| `TopHeight`    | int (px) | 9-slice top           |
| `BottomHeight` | int (px) | 9-slice bottom        |
| `LeftWidth`    | int (px) | 9-slice left          |
| `RightWidth`   | int (px) | 9-slice right         |

States: 1=Normal, 2=Pressed, 3=Disabled, 4=Focus, 5=Default

---

### [Scrollbar]

Master scrollbar definition with 23 images in a single BMP.

| Key         | Type | Description                                          |
|-------------|------|------------------------------------------------------|
| `Image`     | path | Scrollbar master sprite (23 images, 16x16 suggested) |
| `MouseOver` | 0/1  | Hover effects                                        |
| `BasePress` | 1/2  | 1=both bars press together, 2=individual press       |
| `Trans`     | 0/1  | Dot image transparency                               |

The 23 images in order:
1-4: UP arrow (Normal, Pressed, Disabled, Mouseover)
5-8: DOWN arrow (Normal, Pressed, Disabled, Mouseover)
9-12: LEFT arrow (Normal, Pressed, Disabled, Mouseover)
13-16: RIGHT arrow (Normal, Pressed, Disabled, Mouseover)
17-22: Horizontal + Vertical scrollbar fill (6 images)
23: Separator between scrollbars

Additional sections for fine-grained scrollbar control:

#### [HorzScroll] / [VertScroll]

| Key                                                    | Type     | Description                                      |
|--------------------------------------------------------|----------|--------------------------------------------------|
| `Image`                                                | path     | 4 states: inactive, pressed, disabled, mouseover |
| `TopHeight`, `BottomHeight`, `LeftWidth`, `RightWidth` | int (px) | 9-slice                                          |
| `Tile`                                                 | 0/1      | Tile mode                                        |

#### [HorzScrollThumb] / [VertScrollThumb]

| Key                                                    | Type     | Description                            |
|--------------------------------------------------------|----------|----------------------------------------|
| `Image`                                                | path     | 3 states: inactive, pressed, mouseover |
| `TopHeight`, `BottomHeight`, `LeftWidth`, `RightWidth` | int (px) | 9-slice                                |
| `Tile`                                                 | 0/1      | Tile mode                              |
| `Alpha`                                                | 0-255    | Thumb transparency                     |
| `AlphaMode`                                            | 0/1      | 0=all blended, 1=only inactive blended |
| `ShowDot`                                              | 0/1      | Display centre dot                     |

#### [SmallHScrollThumb] / [SmallVScrollThumb]

Replacement thumbs for small scrollbar dimensions. Same properties as the thumb sections above.

---

### [Progress]

Progress bar skinning.

| Key                                                    | Type     | Description                                                       |
|--------------------------------------------------------|----------|-------------------------------------------------------------------|
| `Bitmap`                                               | path     | 2 images: background + progress bar                               |
| `TopHeight`, `BottomHeight`, `LeftWidth`, `RightWidth` | int (px) | 9-slice                                                           |
| `Trans`                                                | 0/1      | Transparency                                                      |
| `Tile`                                                 | 0/1      | Tiling enabled                                                    |
| `TileMode`                                             | 0/1/2    | 0=both tile, 1=back stretch + bar tile, 2=back tile + bar stretch |
| `Alpha`                                                | 0-255    | Bar transparency (0=off)                                          |

---

### [MenuBars]

Custom menu bar items.

| Key                   | Type | Description                                                           |
|-----------------------|------|-----------------------------------------------------------------------|
| `UseCustomBackground` | 0/1  | Enable custom rendering                                               |
| `Image`               | path | 5 states: active normal, active pressed, reserved, reserved, inactive |
| `Trans`               | 0/1  | Transparency                                                          |

---

### [MDIControls] (UIS2)

Maximized MDI child window buttons that appear on the menu bar.

| Key                                                    | Type     | Description                                            |
|--------------------------------------------------------|----------|--------------------------------------------------------|
| `Image`                                                | path     | 12 images: 4 states x 3 buttons. Suggested 60x14 total |
| `TopHeight`, `BottomHeight`, `LeftWidth`, `RightWidth` | int (px) | 9-slice                                                |

---

### [StatusBarsEdges] (UIS2)

| Key     | Type | Description                  |
|---------|------|------------------------------|
| `Image` | path | 3 images: sunk, raised, flat |

---

### [SunkEdge]

Combo box edge (3px width). Standard button attributes, 1 image in bitmap.

---

### [GroupBox / GroupBoxEdge] (UIS2)

#### [GroupBoxEdge]

| Key                                                    | Type     | Description        |
|--------------------------------------------------------|----------|--------------------|
| `Image`                                                | path     | Square edge format |
| `TopHeight`, `BottomHeight`, `LeftWidth`, `RightWidth` | int (px) | 9-slice            |

#### [GroupBox]

| Key                                                    | Type     | Description    |
|--------------------------------------------------------|----------|----------------|
| `Image`                                                | path     | Interior fill  |
| `TopHeight`, `BottomHeight`, `LeftWidth`, `RightWidth` | int (px) | 9-slice        |
| `BackgroundAlignment`                                  | 0-2      | Text alignment |
| `BackgroundLeftShift`                                  | int (px) | Left shift     |
| `BackgroundRightShift`                                 | int (px) | Right shift    |

---

### [RebarGrip] (UIS2)

Windows rebar grip (toolbar/start menu area).

| Key                                                    | Type     | Description |
|--------------------------------------------------------|----------|-------------|
| `Image`                                                | path     | Grip BMP    |
| `TopHeight`, `BottomHeight`, `LeftWidth`, `RightWidth` | int (px) | 9-slice     |

---

### [Layout*N*]

Layout objects controlling icon and text placement inside buttons/controls.

#### Icon Properties

| Key             | Type     | Description       |
|-----------------|----------|-------------------|
| `ShowIcon`      | 0/1      | Display icon      |
| `IconXShift`    | int (px) | Horizontal offset |
| `IconYShift`    | int (px) | Vertical offset   |
| `IconWidth`     | int (px) | Icon width        |
| `IconHeight`    | int (px) | Icon height       |
| `IconHorzAlign` | 0/1/2    | Left/Right/Centre |
| `IconVertAlign` | 0/1/2    | Left/Right/Centre |

#### Text Properties

| Key             | Type  | Description       |
|-----------------|-------|-------------------|
| `TextAlignment` | 0/1/2 | Left/Centre/Right |

#### Area Margins (with icon)

| Key                                                                      | Type     |
|--------------------------------------------------------------------------|----------|
| `NormalTopEdge`, `NormalLeftEdge`, `NormalRightEdge`, `NormalBottomEdge` | int (px) |

#### Area Margins (without icon)

| Key                                                                      | Type     |
|--------------------------------------------------------------------------|----------|
| `NoIconTopEdge`, `NoIconLeftEdge`, `NoIconRightEdge`, `NoIconBottomEdge` | int (px) |

| `BorderMode` | 0/1 | 0 = relative, 1 = fixed pixels |

---

### [Text] -- Title Text Effects

| Key                    | Type     | Description                              |
|------------------------|----------|------------------------------------------|
| `Use3DText`            | 0/1/2    | 0=normal, 1=shadow, 2=outlined           |
| `ShadowTextR`          | 0-255    | Shadow colour red                        |
| `ShadowTextG`          | 0-255    | Shadow colour green                      |
| `ShadowTextB`          | 0-255    | Shadow colour blue                       |
| `NoShadowInactiveText` | 0/1      | Disable effect on inactive windows       |
| `ShadowOffset`         | int (px) | Shadow offset (supports negative values) |

---

### Compound Skins (SSD/SSS)

A compound skin packages multiple UIS variants. The `.ssd` file is a simple INI:

```ini
[SkinStyles]
Number=3

[SkinStyle0]
Name=Luna Blue
Skin=blue.UIS

[SkinStyle1]
Name=Luna Silver
Skin=silver.SSS

[SkinStyle2]
Name=Luna Olive
Skin=olive.SSS
```

`.SSS` files are standard `.UIS` files with a different extension. The user selects which style to activate.

---

## SZ skin.js -- SynthelicZ Native Format

SynthelicZ uses self-registering JavaScript files instead of parsing UIS at runtime. Each skin folder contains a `skin.js` that populates the global registry.

### File Structure

```
skins/SKINNAME/
  skin.js                Self-registering IIFE
  TOP.BMP                Frame images (same as WindowBlinds)
  BOTTOM.BMP
  LEFT.BMP
  RIGHT.BMP
  CLOSE.BMP              Button images
  MAX.BMP
  MIN.BMP
  ...
  START.BMP              Start button
  BUTTONS.BMP            Form control sprites
  CHECK.BMP
  RADIO.BMP
  ...
```

### skin.js Format

```js
;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const skins = SZ.skins || (SZ.skins = {});

  const BASE = 'skins/SKINNAME';

  skins.SKINNAME = {
    // Metadata
    name: 'Skin Display Name',
    author: 'Author Name',
    email: 'author@example.com',
    url: 'https://example.com',
    wbVersion: 200,                    // UIS format version this was derived from
    basePath: BASE,

    // Personality (frame rendering)
    personality: {
      // Flags
      usestran: 1,                     // Transparency support
      buttoncount: 18,                 // Number of titlebar buttons
      mouseover: 1,                    // Hover effects
      tripleimages: 1,                 // 6-state buttons (active+inactive)

      // Title text
      textalignment: 0,               // 0=left, 1=center, 2=right
      textshift: 20,                   // Horizontal offset (px)
      textshiftvert: 4,               // Vertical offset (px)
      textrightclip: 55,              // Right-side reserved space (px)

      // Frame images (resolved paths)
      top: `${BASE}/TOP.BMP`,
      topmask: `${BASE}/TOPM.BMP`,
      left: `${BASE}/LEFT.BMP`,
      // ... etc for all 4 borders + masks

      // Zone parameters
      toptopheight: 10,               // Zone A (fixed left) for top border
      topbotheight: 10,               // Zone C (fixed right) for top border
      lefttopheight: 30,              // Zone A (fixed top) for left border
      leftbotheight: 4,               // Zone C (fixed bottom) for left border
      righttopheight: 30,
      rightbotheight: 4,
      bottomtopheight: 1,
      bottombotheight: 1,

      // Stretch/tile
      topstretch: 0,                  // 0=tile, 1=stretch
      leftstretch: 0,
      rightstretch: 0,
      bottomstretch: 0,

      // Animation
      topframe: 2,                    // Frame count per border
      leftframe: 2,
      rightframe: 2,
      bottomframe: 2,
      anirate: 0,                     // 0 = no animation, >0 = ms between frames

      // Optional images
      menubar: `${BASE}/MENU.BMP`,
      menuborders: `${BASE}/MNUFRAME.BMP`,
      explorerbmp: `${BASE}/EXPLORER.BMP`,
      dialogbmp: `${BASE}/DIALOG.BMP`,
      mdibmp: `${BASE}/MDI.BMP`,
      mdibmpmask: `${BASE}/MDIM.BMP`,
    },

    // Form control sprites
    buttons: {
      checkbutton: `${BASE}/CHECK.BMP`,
      checkbuttonmask: `${BASE}/CHECKM.BMP`,
      radiobutton: `${BASE}/RADIO.BMP`,
      bitmap: `${BASE}/BUTTONS.BMP`,
      bitmapmask: `${BASE}/BUTTONSM.BMP`,
      topheight: 3, bottomheight: 3,
      leftwidth: 3, rightwidth: 3,
      mouseover: 1,
    },

    // Titlebar buttons array (indexed by button number)
    titleButtons: [
      {
        image: `${BASE}/CLOSE.BMP`,
        mask: `${BASE}/CLOSEM.BMP`,
        align: 1,                      // 0=left, 1=right
        xcoord: 25,                    // Offset from anchor
        ycoord: 4,
        action: 0,                     // 0=close
        // visibility, visibility1..9 (optional)
      },
      // ... more buttons
    ],

    // Combo dropdown button
    comboButton: {
      image: `${BASE}/COMBO.BMP`,
      topheight: 1, bottomheight: 1,
      leftwidth: 1, rightwidth: 1,
      mouseover: 1,
    },

    // Start button
    startButton: {
      image: `${BASE}/START.BMP`,
    },

    // System colours (arrays of [R, G, B])
    colors: {
      scrollbar: [210, 225, 249],
      background: [15, 92, 190],
      activeTitle: [0, 82, 222],
      inactiveTitle: [72, 111, 177],
      menu: [238, 237, 227],
      window: [255, 255, 255],
      windowFrame: [127, 157, 185],
      menuText: [0, 0, 0],
      windowText: [0, 0, 0],
      titleText: [255, 255, 255],
      activeBorder: [238, 237, 227],
      inactiveBorder: [238, 237, 227],
      appWorkspace: [112, 145, 224],
      highlight: [49, 106, 197],
      highlightText: [255, 255, 255],
      buttonFace: [238, 237, 227],
      buttonShadow: [202, 198, 175],
      grayText: [202, 198, 175],
      buttonText: [0, 0, 0],
      inactiveTitleText: [189, 204, 228],
      buttonHighlight: [255, 255, 255],
      buttonDarkShadow: [128, 128, 128],
      buttonLight: [250, 250, 245],
      infoText: [0, 0, 0],
      infoWindow: [255, 255, 225],
      buttonAlternateFace: [242, 240, 240],
      hotTrackingColor: [0, 0, 255],
      gradientActiveTitle: [0, 0, 255],
      gradientInactiveTitle: [192, 192, 192],
    },

    // Font definitions
    fonts: {
      family: 'Trebuchet MS',
      height: 19,
      weight: 600,
      antialias: true,
    },
  };
})();
```

### Sub-Skins (Color Schemes)

A skin.js can define an optional `subSkins` array -- color scheme variants that override the base skin's `colors` object. This corresponds to the WindowBlinds compound skin (SSD/SSS) mechanism but implemented inline.

```js
    subSkins: [
      { id: 'default', name: 'Blue (Default)' },        // no colors = use base
      {
        id: 'olive',
        name: 'Olive Green',
        colors: {                                         // only overridden keys
          activeTitle: [131, 138, 76],
          gradientActiveTitle: [181, 188, 134],
          highlight: [147, 160, 112],
          // ... any subset of the base colors object
        },
      },
    ],
```

At runtime, `SZ.resolveSkin(skin, subSkinId)` shallow-copies the skin and merges the sub-skin's `colors` over the base. The first entry should always be `{ id: 'default', name: '... (Default)' }` with no `colors` key, representing the base skin unchanged.

The Control Panel's Appearance tab displays a "Color scheme" dropdown when the selected skin has `subSkins.length > 0`. The chosen sub-skin ID is persisted to `localStorage` as `sz-subSkin`.

### Loading

skin.js files are loaded via `<script defer>` in `index.html` **before** the engine scripts:

```html
<script defer src="skins/LUNAX/skin.js"></script>
<script defer src="skins/AQUARIUM/skin.js"></script>
<!-- Engine scripts follow -->
<script defer src="js/skin-loader.js"></script>
```

The skin registry is accessed via:

- `SZ.getSkin('LUNAX')` -- case-insensitive lookup
- `SZ.getAvailableSkins()` -- list all registered names

### Converting from UIS to skin.js

To convert a WindowBlinds skin:

1. Parse the `.uis` file with `SZ.parseUIS(text, basePath)`
2. The returned object has the same structure as the skin.js format
3. Write the object as a JavaScript literal into a `skin.js` IIFE
4. Place all BMP files in the same folder

---

## Frame Rendering Model

### Frame Orientation

**Critical**: TOP and BOTTOM borders stack animation frames **vertically** (divide image height by frame count). LEFT and RIGHT borders stack frames **horizontally** (divide image width by frame count).

```
TOP.BMP (e.g., 220px x 420px, 15 frames):
  Frame 1:  0px   -  27px  (220 x 28)  <- Active frame 1
  Frame 2:  28px  -  55px  (220 x 28)  <- Active frame 2
  ...
  Frame 14: 364px - 391px (220 x 28)   <- Active frame 14
  Frame 15: 392px - 419px (220 x 28)   <- Inactive frame

LEFT.BMP (e.g., 105px x 197px, 15 frames):
  Frame 1:  0px  -  6px   (7 x 197)    <- Active frame 1
  Frame 2:  7px  - 13px   (7 x 197)    <- Active frame 2
  ...
  Frame 15: 98px - 104px  (7 x 197)    <- Inactive frame
```

The last frame is always the **inactive** state. All preceding frames are active animation frames.

### 3-Zone Tiling Model

After extracting a single frame from the sprite sheet, the frame is split into 3 zones:

#### Horizontal Borders (TOP, BOTTOM)

```
[Zone A: TopTopHeight px] [Zone B: remaining] [Zone C: TopBotHeight px]
     fixed left              tiled/stretched         fixed right
```

- Zone A: Left fixed section (never scaled)
- Zone B: Middle section (tiled if `TopStretch=0`, stretched if `TopStretch=1`)
- Zone C: Right fixed section (never scaled)

#### Vertical Borders (LEFT, RIGHT)

```
[Zone A: LeftTopHeight px]   <- fixed top
[Zone B: remaining height]   <- tiled/stretched
[Zone C: LeftBotHeight px]   <- fixed bottom
```

### Animation Frames

When `AniRate > 0` and frame count > 1, the renderer cycles through active frames at the specified interval using `setInterval`. Only the `background-image` CSS property changes per tick; position, size, and repeat mode remain static.

Frame cycling order: 0, 1, 2, ..., N-2 (skipping the last frame, which is the inactive state). The inactive state is shown when the window loses focus.

---

## Button State Layout

### TripleImages = 1 (6-state)

Each button BMP contains a 3x2 grid:

```
[Normal      ] [Hover      ] [Pressed      ]   <- Active window (top row)
[Normal-Inact] [Hover-Inact] [Pressed-Inact]   <- Inactive window (bottom row)
```

State width = image width / 3. State height = image height / 2.

### TripleImages = 0 (3-state)

Single row, shared between active and inactive:

```
[Normal] [Hover] [Pressed]
```

State width = image width / 3. State height = image height.

---

## Button Visibility System

Visibility controls when a button appears. Multiple conditions are AND-combined using `Visibility`, `Visibility1` through `Visibility9`.

| Code | Condition                        |
|------|----------------------------------|
| 0    | Always show                      |
| 1    | Active window only               |
| 2    | Inactive window only             |
| 3    | Maximized only                   |
| 4    | Not maximized                    |
| 5    | Rolled up                        |
| 6    | Not rolled up                    |
| 7    | Always-on-top set                |
| 8    | Not always-on-top                |
| 9    | Attached to desktop              |
| 10   | Not attached to desktop          |
| 11   | Keep visible always              |
| 12   | Not keep visible                 |
| 13   | Has WS_EX_CONTEXTHELP style      |
| 14   | No help button                   |
| 15   | No min/max, not maximized        |
| 16   | Has max or min button            |
| 17   | No min/max buttons               |
| 18   | MDI child                        |
| 19   | Not MDI child                    |
| 20   | Has maximize button              |
| 21   | No maximize button               |
| 22   | Has minimize button              |
| 23   | No minimize button               |
| 24   | Sizable window                   |
| 25   | Not sizable                      |
| 26   | Has min or max button            |
| 27   | Has icon                         |
| 28   | No icon                          |
| 29   | Window text exists               |
| 30   | No window text                   |
| 31   | Mouse over LinkedTo button       |
| 32   | LinkedTo button pressed          |
| 33   | Mouse over or pressed (LinkedTo) |
| 40   | LinkedTo button toggled on       |
| 50   | Simple mode (WB 2.x)             |
| 51   | Advanced mode (WB 2.x)           |

### Common Patterns

| Button          | Visibility                      | Meaning                           |
|-----------------|---------------------------------|-----------------------------------|
| Close           | `Visibility=0`                  | Always visible                    |
| Maximize        | `Visibility=20, Visibility1=4`  | Has max button AND not maximized  |
| Restore         | `Visibility=20, Visibility1=3`  | Has max button AND maximized      |
| Minimize        | `Visibility=22, Visibility1=20` | Has min button AND has max button |
| Minimize (solo) | `Visibility=22, Visibility1=21` | Has min button AND no max button  |

---

## Button Action Codes

| Code  | Action                                               |
|-------|------------------------------------------------------|
| 0     | Close window                                         |
| 1     | Maximize (shows disabled when not applicable)        |
| 2     | Minimize (shows disabled when not applicable)        |
| 3     | Help button                                          |
| 4     | Rollup / Unroll toggle                               |
| 5     | Execute command (uses `Command` key)                 |
| 6     | Always on top toggle                                 |
| 7     | Attach to desktop                                    |
| 8     | Keep visible always (Litestep)                       |
| 9     | Prevent size/move                                    |
| 10    | Execute screensaver                                  |
| 11    | System icon                                          |
| 12    | System menu                                          |
| 13-20 | Size from edge (top, bottom, left, right, corners)   |
| 21    | Send to back                                         |
| 22    | Maximize with mouseover (maximize/restore toggle)    |
| 23    | Minimize with mouseover (minimize/unminimize toggle) |
| 24    | Minimize to system tray (experimental)               |
| 25    | Windows 2000 specific (experimental)                 |
| 40    | Toggle button                                        |
| 41    | Exclusive toggle button                              |
| -1    | No action (image only)                               |
| -2    | No action (intercepts mouse clicks)                  |
| -3    | DLL button (uses `DllName` key)                      |
| -4    | Custom action (UIS2 plugin)                          |
| -5    | Non-clickable, integral to titlebar                  |

**SynthelicZ supports**: 0 (close), 1/22 (maximize/restore), 2/23 (minimize/restore), 3 (help). Other actions are parsed but not implemented.

---

## Transparency System

### Magenta Key Transparency

The colour `RGB(255, 0, 255)` (magenta/fuchsia) is the universal transparency key throughout all WindowBlinds image assets. Any pixel with this exact colour becomes fully transparent.

This applies to:

- Frame border images (when `UsesTran=1`)
- Button images (when `UsesTran=1`)
- Control sprites (when `Trans=1`)
- Progress bars, scrollbar images, etc.

### Mask-Based Transparency

Each image can optionally have a companion mask BMP (suffix `M` or `Mask`):

| Image         | Mask           |
|---------------|----------------|
| `TOP.BMP`     | `TOPM.BMP`     |
| `CLOSE.BMP`   | `CLOSEM.BMP`   |
| `BUTTONS.BMP` | `BUTTONSM.BMP` |

The mask is a **greyscale image** of the same dimensions:

- **White (255)**: Fully opaque
- **Black (0)**: Fully transparent
- **Grey (1-254)**: Semi-transparent (proportional alpha)

### Per-Pixel Alpha (UIS1+)

UIS1+ skins (`WBVer=150`) use true alpha channel data in the BMP files instead of magenta keying. This produces smoother, anti-aliased window borders.

### Button Alpha Blending

Individual buttons support alpha via the `Alpha` and `AlphaOp` keys (see Button section above).

---

## Color Masking System (UIS2)

UIS2 introduces the `[ColoursMask]` section alongside `[Colours]`. The mask acts as a blend intensity layer:

```ini
[Colours]
ButtonFace=238 237 227

[ColoursMask]
ButtonFace=128
```

A mask value of 128 means the button face colour is blended at 50% intensity with the system default. A value of 0 means no change from the system colour. A value of 255 means full replacement.

Image-level colour masking works by appending "Mask" to any image key:

```ini
[Personality]
Left=skin\left.bmp
LeftMask=skin\leftmask.bmp
```

The mask BMP is a greyscale image where white = changeable pixels, black = unchanged pixels.

---

## Technical Constraints

- `LeftBotHeight` **must** be >= the bottom border image height
- `CombineOp` buttons cannot use `Visibility=1` or `Visibility=2` unless `DynamicFrame=1`
- `DynamicFrame=1` creates a 1px transparent strip on the right side of maximized windows
- Animation frame counts should be consistent across all 4 border edges
- Maximum 10 visibility conditions per button (`Visibility` through `Visibility9`)
- Lower-numbered buttons are drawn before higher-numbered ones (draw order = z-order)
- All BMP paths in `.uis` files use backslashes (`\`) as separators
- Start button image has no 9-slice -- it is simply stretched to frame dimensions
