// SynthelicZ Drums — Data Model
// DrumBit, Bar, DrumGroove, and supporting enumerations.

(function (ns) {
'use strict';

const Instrument = Object.freeze({
  Crash: 'crash',
  Ride: 'ride',
  RideBell: 'ride-bell',
  OpenHiHat: 'hi-hat(open)',
  ClosedHiHat: 'hi-hat(closed)',
  HiHatPedal: 'hi-hat(pedal)',
  BassDrum: 'bass-drum',
  SnareDrum: 'snare',
  HighTom: 'tom(high)',
  MidTom: 'tom(normal)',
  FloorTom: 'tom(floor)',
});

const PlayState = Object.freeze({
  Silence: 'not played',
  Stroke: 'played(hit)',
  Click: 'clicked',
  Flam: 'doubled',
  Ruff: 'multiple',
  Rimshot: 'rimshot',
  Ghost: 'quiet',
  Accent: 'loud',
  Choke: 'choke',
});

const NoteIndex = Object.freeze({
  Beat1: 0,
  Beat3: 1,
  Beat2: 2,
  Beat4: 3,
  Beat1Plus: 4,
  Beat3Plus: 5,
  Beat2Plus: 6,
  Beat4Plus: 7,
  Beat1E: 8,
  Beat3E: 9,
  Beat2E: 10,
  Beat4E: 11,
  Beat1A: 12,
  Beat3A: 13,
  Beat2A: 14,
  Beat4A: 15,
});

class DrumBit {

  static Mode = Object.freeze({
    DrumKit: 0b0,
    Toms: 0b1,
  });

  static BassDrumState = Object.freeze({
    Off: 0b0,
    Kick: 0b1,
  });

  static SnareState = Object.freeze({
    Off:          0b000,
    Stroke:       0b001,
    Click:        0b010,
    Ghost:        0b011,
    Rimshot:      0b100,
    Crash:        0b101,
    CrashAccent:  0b110,
    CrashChoke:   0b111,
  });

  static HiHatState = Object.freeze({
    Off:             0b000,
    Closed:          0b001,
    Pedal:           0b010,
    Open:            0b011,
    Ride:            0b100,
    RideAccent:      0b101,
    RideBell:        0b110,
    RideBellAccent:  0b111,
  });

  static TomState = Object.freeze({
    Off: 0b00,
    Stroke: 0b01,
    Quiet: 0b10,
    Loud: 0b11,
  });

  static TomSelection = Object.freeze({
    SnareAndLowTom: 0b000,
    HighTomOnly: 0b100,
    MidTomOnly: 0b010,
    LowTomOnly: 0b001,
    HighAndMidTom: 0b110,
    HighAndLowTom: 0b101,
    MidAndLowTom: 0b011,
    SnareAndHighTom: 0b111,
  });

  static ReservedPattern = 0b11000000;
  static SilencePattern = 0b00000000;

  static ModeMask = 0b10000000;
  static ModeShift = 7;

  static BassDrumMask = 0b00000001;
  static BassDrumShift = 0;

  static HiHatMask = 0b00001110;
  static HiHatShift = 1;

  static SnareMask = 0b01110000;
  static SnareShift = 4;

  static TomsModeMask = 0b01110000;
  static TomsModeShift = 4;

  static TomsLeftHandMask = 0b00001100;
  static TomsLeftHandShift = 2;

  static TomsRightHandMask = 0b00000011;
  static TomsRightHandShift = 0;

  _bitPattern = DrumBit.SilencePattern;

  constructor(bitPattern) {
    if (bitPattern !== undefined)
      this._bitPattern = bitPattern & 0xFF;
  }

  get bitPattern() {
    return this._bitPattern;
  }

  // ── Getters ──────────────────────────────────────────────

  _getMode = () => (this._bitPattern & DrumBit.ModeMask) >> DrumBit.ModeShift;

  _getToms = () => this._getMode() !== DrumBit.Mode.Toms
    ? null
    : (this._bitPattern & DrumBit.TomsModeMask) >> DrumBit.TomsModeShift;

  _getLeftTom = () => this._getMode() !== DrumBit.Mode.Toms
    ? null
    : (this._bitPattern & DrumBit.TomsLeftHandMask) >> DrumBit.TomsLeftHandShift;

  // BUG FIX: was referencing non-existent DrumBit.TomsRightHandMaskShift
  _getRightTom = () => this._getMode() !== DrumBit.Mode.Toms
    ? null
    : (this._bitPattern & DrumBit.TomsRightHandMask) >> DrumBit.TomsRightHandShift;

  _getHiHat = () => this._getMode() !== DrumBit.Mode.DrumKit
    ? null
    : (this._bitPattern & DrumBit.HiHatMask) >> DrumBit.HiHatShift;

  _getBassDrum = () => this._getMode() !== DrumBit.Mode.DrumKit
    ? null
    : (this._bitPattern & DrumBit.BassDrumMask) >> DrumBit.BassDrumShift;

  _getSnare = () => {
    switch (this._getMode()) {
      case DrumBit.Mode.DrumKit:
        return (this._bitPattern & DrumBit.SnareMask) >> DrumBit.SnareShift;
      case DrumBit.Mode.Toms: {
        const toms = this._getToms();
        // SnareFlamRuff pattern: 1 000 00 rr → mmm=000, ll=00
        if (toms === DrumBit.TomSelection.SnareAndLowTom && this._getLeftTom() === DrumBit.TomState.Off)
          return (this._getRightTom() & 0b10) ? DrumBit.SnareState.Rimshot : DrumBit.SnareState.Ghost;
          // rr bit 1: 0 = Flam → Ghost(011), 1 = Ruff → Rimshot(100) — mapped to distinct SnareState values
          // that getInstrument will interpret as Flam/Ruff

        switch (toms) {
          case DrumBit.TomSelection.SnareAndLowTom:
          case DrumBit.TomSelection.SnareAndHighTom:
            switch (this._getLeftTom()) {
              case DrumBit.TomState.Stroke:
                return DrumBit.SnareState.Stroke;
              case DrumBit.TomState.Quiet:
                return DrumBit.SnareState.Ghost;
              case DrumBit.TomState.Loud:
                return DrumBit.SnareState.Rimshot;
            }
        }
      }
    }
    return null;
  };

  // ── Tom state converters ─────────────────────────────────

  static _multiTomStateConverter = (leftOrRight) => {
    switch (leftOrRight) {
      case DrumBit.TomState.Stroke:
        return PlayState.Stroke;
      case DrumBit.TomState.Quiet:
        return PlayState.Ghost;
      case DrumBit.TomState.Loud:
        return PlayState.Accent;
    }
    return PlayState.Silence;
  };

  _singleTomStateConverter = () => {
    const left = this._getLeftTom();
    const right = this._getRightTom();
    if (right === DrumBit.TomState.Off)
      return DrumBit._multiTomStateConverter(left);

    if (right === DrumBit.TomState.Stroke)
      return PlayState.Flam;

    if (right === DrumBit.TomState.Quiet)
      return PlayState.Ruff;

    if (right === DrumBit.TomState.Loud)
      switch (left) {
        case DrumBit.TomState.Stroke:
          return PlayState.Flam;
        case DrumBit.TomState.Quiet:
          return PlayState.Ruff;
        case DrumBit.TomState.Loud:
          return PlayState.Rimshot;
      }

    return PlayState.Silence;
  };

  // ── Setters ──────────────────────────────────────────────
  // BUG FIX: all setters used & instead of | to combine bits

  _setMode(mode) {
    this._bitPattern = (this._bitPattern & ~DrumBit.ModeMask) | ((mode & 0b1) << DrumBit.ModeShift);
  }

  _setHiHat(hiHatState) {
    if (this._getMode() !== DrumBit.Mode.DrumKit) {
      if (hiHatState === DrumBit.HiHatState.Off)
        return;

      const snare = this._getSnare();
      this._bitPattern = DrumBit.SilencePattern;
      this._setMode(DrumBit.Mode.DrumKit);
      if (snare !== null)
        this._setSnare(snare);
    }
    this._bitPattern = (this._bitPattern & ~DrumBit.HiHatMask) | ((hiHatState & 0b111) << DrumBit.HiHatShift);
  }

  _setSnare(snareState) {
    if (this._getMode() !== DrumBit.Mode.DrumKit) {
      if (snareState === DrumBit.SnareState.Off)
        return;

      const bassDrum = null; // toms mode has no bass drum info
      this._bitPattern = DrumBit.SilencePattern;
      this._setMode(DrumBit.Mode.DrumKit);
    }
    this._bitPattern = (this._bitPattern & ~DrumBit.SnareMask) | ((snareState & 0b111) << DrumBit.SnareShift);
  }

  _setBassDrum(bassDrumState) {
    if (this._getMode() !== DrumBit.Mode.DrumKit) {
      if (bassDrumState === DrumBit.BassDrumState.Off)
        return;

      const snare = this._getSnare();
      this._bitPattern = DrumBit.SilencePattern;
      this._setMode(DrumBit.Mode.DrumKit);
      if (snare !== null)
        this._setSnare(snare);
    }
    this._bitPattern = (this._bitPattern & ~DrumBit.BassDrumMask) | ((bassDrumState & 0b1) << DrumBit.BassDrumShift);
  }

  _setToms(tomSelection) {
    if (this._getMode() !== DrumBit.Mode.Toms) {
      this._bitPattern = DrumBit.SilencePattern;
      this._setMode(DrumBit.Mode.Toms);
    }
    this._bitPattern = (this._bitPattern & ~DrumBit.TomsModeMask) | ((tomSelection & 0b111) << DrumBit.TomsModeShift);
  }

  _setLeftTom(tomState) {
    if (this._getMode() !== DrumBit.Mode.Toms)
      return;

    this._bitPattern = (this._bitPattern & ~DrumBit.TomsLeftHandMask) | ((tomState & 0b11) << DrumBit.TomsLeftHandShift);
  }

  _setRightTom(tomState) {
    if (this._getMode() !== DrumBit.Mode.Toms)
      return;

    this._bitPattern = (this._bitPattern & ~DrumBit.TomsRightHandMask) | ((tomState & 0b11) << DrumBit.TomsRightHandShift);
  }

  // ── High-level setInstrument ─────────────────────────────
  // BUG FIX: added break statements to prevent fall-through

  setInstrument = (instrument, playState) => {
    switch (instrument) {
      case Instrument.BassDrum:
        // SnareFlamRuff pattern: 1 000 00 rr — bass drum is rr bit 0
        if (this._getMode() === DrumBit.Mode.Toms
          && this._getToms() === DrumBit.TomSelection.SnareAndLowTom
          && this._getLeftTom() === DrumBit.TomState.Off) {
          if (playState === PlayState.Silence)
            this._bitPattern = (this._bitPattern & ~0b01) | 0b00;
          else
            this._bitPattern = (this._bitPattern & ~0b01) | 0b01;
          break;
        }
        this._setBassDrum(playState === PlayState.Silence ? DrumBit.BassDrumState.Off : DrumBit.BassDrumState.Kick);
        break;
      case Instrument.SnareDrum:
        switch (playState) {
          case PlayState.Silence:
            // If in SnareFlamRuff mode, clear it
            if (this._getMode() === DrumBit.Mode.Toms
              && this._getToms() === DrumBit.TomSelection.SnareAndLowTom
              && this._getLeftTom() === DrumBit.TomState.Off)
              this._bitPattern = DrumBit.SilencePattern;
            else
              this._setSnare(DrumBit.SnareState.Off);
            break;
          case PlayState.Stroke:
            this._setSnare(DrumBit.SnareState.Stroke);
            break;
          case PlayState.Click:
            this._setSnare(DrumBit.SnareState.Click);
            break;
          case PlayState.Ghost:
            this._setSnare(DrumBit.SnareState.Ghost);
            break;
          case PlayState.Rimshot:
            this._setSnare(DrumBit.SnareState.Rimshot);
            break;
          case PlayState.Flam: {
            // SnareFlamRuff: 1 000 00 rr, rr bit 1 = 0 (Flam), preserve rr bit 0 (bass)
            const hasBass = this._getMode() === DrumBit.Mode.DrumKit
              ? (this._getBassDrum() === DrumBit.BassDrumState.Kick)
              : (this._getMode() === DrumBit.Mode.Toms
                && this._getToms() === DrumBit.TomSelection.SnareAndLowTom
                && this._getLeftTom() === DrumBit.TomState.Off
                && (this._getRightTom() & 0b01));
            this._bitPattern = 0b10000000 | (hasBass ? 0b01 : 0b00);
            break;
          }
          case PlayState.Ruff: {
            // SnareFlamRuff: 1 000 00 rr, rr bit 1 = 1 (Ruff), preserve rr bit 0 (bass)
            const hasBass = this._getMode() === DrumBit.Mode.DrumKit
              ? (this._getBassDrum() === DrumBit.BassDrumState.Kick)
              : (this._getMode() === DrumBit.Mode.Toms
                && this._getToms() === DrumBit.TomSelection.SnareAndLowTom
                && this._getLeftTom() === DrumBit.TomState.Off
                && (this._getRightTom() & 0b01));
            this._bitPattern = 0b10000010 | (hasBass ? 0b01 : 0b00);
            break;
          }
          case PlayState.Accent:
            this._setSnare(DrumBit.SnareState.Rimshot);
            break;
        }
        break;
      case Instrument.ClosedHiHat:
        this._setHiHat(playState === PlayState.Silence ? DrumBit.HiHatState.Off : DrumBit.HiHatState.Closed);
        break;
      case Instrument.OpenHiHat:
        this._setHiHat(playState === PlayState.Silence ? DrumBit.HiHatState.Off : DrumBit.HiHatState.Open);
        break;
      case Instrument.HiHatPedal:
        this._setHiHat(playState === PlayState.Silence ? DrumBit.HiHatState.Off : DrumBit.HiHatState.Pedal);
        break;
      case Instrument.Crash:
        switch (playState) {
          case PlayState.Silence:
            this._setSnare(DrumBit.SnareState.Off);
            break;
          case PlayState.Choke:
            this._setSnare(DrumBit.SnareState.CrashChoke);
            break;
          case PlayState.Accent:
            this._setSnare(DrumBit.SnareState.CrashAccent);
            break;
          default:
            this._setSnare(DrumBit.SnareState.Crash);
            break;
        }
        break;
      case Instrument.Ride:
        switch (playState) {
          case PlayState.Silence:
            this._setHiHat(DrumBit.HiHatState.Off);
            break;
          case PlayState.Accent:
            this._setHiHat(DrumBit.HiHatState.RideAccent);
            break;
          default:
            this._setHiHat(DrumBit.HiHatState.Ride);
            break;
        }
        break;
      case Instrument.RideBell:
        switch (playState) {
          case PlayState.Silence:
            this._setHiHat(DrumBit.HiHatState.Off);
            break;
          case PlayState.Accent:
            this._setHiHat(DrumBit.HiHatState.RideBellAccent);
            break;
          default:
            this._setHiHat(DrumBit.HiHatState.RideBell);
            break;
        }
        break;
      case Instrument.HighTom:
        this._setupSingleTom(DrumBit.TomSelection.HighTomOnly, playState);
        break;
      case Instrument.MidTom:
        this._setupSingleTom(DrumBit.TomSelection.MidTomOnly, playState);
        break;
      case Instrument.FloorTom:
        this._setupSingleTom(DrumBit.TomSelection.LowTomOnly, playState);
        break;
    }
  };

  _setupSingleTom(selection, playState) {
    if (playState === PlayState.Silence) {
      // If currently in toms mode with this tom, clear
      if (this._getMode() === DrumBit.Mode.Toms && this._getToms() === selection) {
        this._bitPattern = DrumBit.SilencePattern;
      }
      return;
    }

    this._setToms(selection);
    switch (playState) {
      case PlayState.Stroke:
        this._setLeftTom(DrumBit.TomState.Stroke);
        this._setRightTom(DrumBit.TomState.Off);
        break;
      case PlayState.Ghost:
        this._setLeftTom(DrumBit.TomState.Quiet);
        this._setRightTom(DrumBit.TomState.Off);
        break;
      case PlayState.Accent:
        this._setLeftTom(DrumBit.TomState.Loud);
        this._setRightTom(DrumBit.TomState.Off);
        break;
      case PlayState.Flam:
        this._setLeftTom(DrumBit.TomState.Stroke);
        this._setRightTom(DrumBit.TomState.Loud);
        break;
      case PlayState.Ruff:
        this._setLeftTom(DrumBit.TomState.Quiet);
        this._setRightTom(DrumBit.TomState.Loud);
        break;
      case PlayState.Rimshot:
        this._setLeftTom(DrumBit.TomState.Loud);
        this._setRightTom(DrumBit.TomState.Loud);
        break;
    }
  }

  // ── High-level getInstrument ─────────────────────────────

  getInstrument = (instrument) => {
    switch (instrument) {
      case Instrument.FloorTom:
        switch (this._getToms()) {
          case DrumBit.TomSelection.LowTomOnly:
            return this._singleTomStateConverter();
          case DrumBit.TomSelection.MidAndLowTom:
          case DrumBit.TomSelection.HighAndLowTom:
            return DrumBit._multiTomStateConverter(this._getRightTom());
          case DrumBit.TomSelection.SnareAndLowTom:
            // Guard: SnareFlamRuff pattern (mmm=000, ll=00) is not a real dual-tom
            if (this._getLeftTom() === DrumBit.TomState.Off)
              break;
            return DrumBit._multiTomStateConverter(this._getRightTom());
        }
        break;
      case Instrument.MidTom:
        switch (this._getToms()) {
          case DrumBit.TomSelection.MidTomOnly:
            return this._singleTomStateConverter();
          case DrumBit.TomSelection.MidAndLowTom:
            return DrumBit._multiTomStateConverter(this._getLeftTom());
          case DrumBit.TomSelection.HighAndMidTom:
            return DrumBit._multiTomStateConverter(this._getRightTom());
        }
        break;
      case Instrument.HighTom:
        switch (this._getToms()) {
          case DrumBit.TomSelection.HighTomOnly:
            return this._singleTomStateConverter();
          case DrumBit.TomSelection.HighAndLowTom:
          case DrumBit.TomSelection.HighAndMidTom:
            return DrumBit._multiTomStateConverter(this._getLeftTom());
          case DrumBit.TomSelection.SnareAndHighTom:
            return DrumBit._multiTomStateConverter(this._getRightTom());
        }
        break;
      case Instrument.BassDrum:
        // SnareFlamRuff pattern: 1 000 00 rr — bass drum is rr bit 0
        if (this._getMode() === DrumBit.Mode.Toms
          && this._getToms() === DrumBit.TomSelection.SnareAndLowTom
          && this._getLeftTom() === DrumBit.TomState.Off)
          return (this._getRightTom() & 0b01) ? PlayState.Stroke : PlayState.Silence;

        if (this._getBassDrum() === DrumBit.BassDrumState.Kick)
          return PlayState.Stroke;
        break;
      case Instrument.Crash:
        switch (this._getSnare()) {
          case DrumBit.SnareState.Crash:
            return PlayState.Stroke;
          case DrumBit.SnareState.CrashAccent:
            return PlayState.Accent;
          case DrumBit.SnareState.CrashChoke:
            return PlayState.Choke;
        }
        break;
      case Instrument.Ride:
        switch (this._getHiHat()) {
          case DrumBit.HiHatState.Ride:
            return PlayState.Stroke;
          case DrumBit.HiHatState.RideAccent:
            return PlayState.Accent;
        }
        break;
      case Instrument.RideBell:
        switch (this._getHiHat()) {
          case DrumBit.HiHatState.RideBell:
            return PlayState.Stroke;
          case DrumBit.HiHatState.RideBellAccent:
            return PlayState.Accent;
        }
        break;
      case Instrument.ClosedHiHat:
        if (this._getHiHat() === DrumBit.HiHatState.Closed)
          return PlayState.Stroke;
        break;
      case Instrument.OpenHiHat:
        if (this._getHiHat() === DrumBit.HiHatState.Open)
          return PlayState.Stroke;
        break;
      case Instrument.HiHatPedal:
        if (this._getHiHat() === DrumBit.HiHatState.Pedal)
          return PlayState.Stroke;
        break;
      case Instrument.SnareDrum: {
        // SnareFlamRuff pattern: 1 000 00 rr
        if (this._getMode() === DrumBit.Mode.Toms
          && this._getToms() === DrumBit.TomSelection.SnareAndLowTom
          && this._getLeftTom() === DrumBit.TomState.Off)
          return (this._getRightTom() & 0b10) ? PlayState.Ruff : PlayState.Flam;

        switch (this._getSnare()) {
          case DrumBit.SnareState.Stroke:
            return PlayState.Stroke;
          case DrumBit.SnareState.Click:
            return PlayState.Click;
          case DrumBit.SnareState.Ghost:
            return PlayState.Ghost;
          case DrumBit.SnareState.Rimshot:
            return PlayState.Rimshot;
        }
        // Snare via SnareAndLowTom / SnareAndHighTom toms mode
        if (this._getMode() === DrumBit.Mode.Toms) {
          const toms = this._getToms();
          if (toms === DrumBit.TomSelection.SnareAndLowTom || toms === DrumBit.TomSelection.SnareAndHighTom)
            switch (this._getLeftTom()) {
              case DrumBit.TomState.Stroke:
                return PlayState.Stroke;
              case DrumBit.TomState.Quiet:
                return PlayState.Ghost;
              case DrumBit.TomState.Loud:
                return PlayState.Rimshot;
            }
        }
        break;
      }
    }
    return PlayState.Silence;
  };
}

class Bar {
  bits = new Array(16).fill(null).map(() => new DrumBit());

  setDrumBit = (index, drumBit) => {
    if (index >= 0 && index < this.bits.length)
      this.bits[index] = drumBit;
  };

  getDrumBit = (index) => (index >= 0 && index < this.bits.length) ? this.bits[index] : null;

  clone = () => {
    const newBar = new Bar();
    newBar.bits = this.bits.map(bit => new DrumBit(bit._bitPattern));
    return newBar;
  };
}

class DrumGroove {
  bars = [];

  addBar = (bar, index) => {
    if (index !== undefined)
      this.bars.splice(index, 0, bar);
    else
      this.bars.push(bar);
  };

  removeBar = (index) => {
    if (index >= 0 && index < this.bars.length)
      this.bars.splice(index, 1);
  };

  cloneBar = (index) => (index >= 0 && index < this.bars.length) ? this.bars[index].clone() : null;

  getBar = (index) => (index >= 0 && index < this.bars.length) ? this.bars[index] : null;
}

ns.Instrument = Instrument;
ns.PlayState = PlayState;
ns.NoteIndex = NoteIndex;
ns.DrumBit = DrumBit;
ns.Bar = Bar;
ns.DrumGroove = DrumGroove;

})(window.SZDrums = window.SZDrums || {});
