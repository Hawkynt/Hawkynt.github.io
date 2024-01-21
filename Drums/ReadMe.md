# ABC Viewer/Editor/Player

## Basic Structure

When generating or editing grooves, each groove is split into multiple bars. Each bar is further divided into 16th notes, known as DrumBits. Each DrumBit represents one byte, encoding the activity on the drum set.

## The Encoding

We use binary notation for all numbers in the DrumBit encoding.

### DrumBit: `zxxxxxxx` where
- `z` is a mode bit
  - `0`: drumset mode
  - `1`: toms mode

### Drumset Mode: `0ssshhhb` where
- `sss` is the snare mode
  - `000`: No action (silenced/not played)
  - `001`: Stroke (normal hit)
  - `010`: Click (Sidestick)
  - `011`: Rimshot
  - `100`: Flam
  - `101`: Ruff
  - `110`: Ghost
  - `111`: Accent
- `hhh` is the hi-hat mode
  - `000`: No action (silenced/not played)
  - `001`: Closed Hi-Hat
  - `010`: Pedal Hi-Hat
  - `011`: Open Hi-Hat
  - `100`: Crash
  - `101`: Choke
  - `110`: Ghost note
  - `111`: Accent
- `b` is the bass-drum mode
  - `0`: No action (silenced/not played)
  - `1`: played

### Toms Mode: `1mmmllrr` where
- `mmm` is selecting which toms/snare to play
  - `001`: Low Tom (LT)
  - `010`: Mid Tom (MT)
  - `100`: High Tom (HT)
  - `011`: Mid Tom + Low Tom (MT+LT)
  - `101`: High Tom + Low Tom (HT+LT)
  - `110`: High Tom + Mid Tom (HT+MT)
  - `000`: Snare + Low Tom (SN+LT)
  - `111`: Snare + High Tom (SN+HT)
- `ll` is what's played with one hand
  - `00`: No action (silenced/not played)
  - `01`: Stroke
  - `10`: Ghost
  - `11`: Accent
- `rr` is what's played with the other hand
  - `00`: No action (silenced/not played)
  - `01`: Stroke
  - `10`: Ghost
  - `11`: Accent

### Reserved Value
- `10000000`

### Invalid Values
- `1mmm0000`: toms selected, but none played
- `11mmll00`: two toms selected, only one played
- `11mm00rr`: two toms selected, only one played
- `1000ll00`: two toms selected, only one played
- `100000rr`: two toms selected, only one played
- `1011ll00`: two toms selected, only one played
- `101100rr`: two toms selected, only one played

