var GrabViewer = function() {

  // consts
  var _MARKER_INDEX = 0;
  var _LABEL_INDEX = 1;
  var _LINE_INDEX = 2;

  // config
  var boardsDirectory = "resources/images/boards/{0}.png";
  var delayInMilliseconds = 100;
  var rotateDegreeDelta = 5;

  // fields
  var _centerPosition = [0, 0];
  var _isAutoRotating = false;
  var _currentGrab;
  var _currentBoard;
  var _currentViewDegrees = 0;
  var _currentRotateTimer;
  var _currentStanceIsMirrored = false;

  // props
  this.CurrentBoard = function (value) {
    if (value != null) {
      _currentBoard = value;
      var fullImagePath = boardsDirectory.replace("{0}", value);
      this._WakeboardElement().attr("src", fullImagePath);
    }
    return (_currentBoard);
  }

  this.CurrentGrab = function (value) {
    if (value != null) {
      _currentGrab = value;
      this._HideHand(this._FrontHandElements());
      this._HideHand(this._FrontHandCrossElements());
      this._HideHand(this._RearHandElements());
      this._HideHand(this._RearHandCrossElements());
      this._Refresh();
    }
    return (_currentGrab);
  }

  this.CenterPosition=function(value) {
    if (value != null) {
      _centerPosition = value;
      this._MoveElementCenterTo(this._GridElement(), value[0], value[1]);
      this._MoveElementCenterTo(this._WakeboardElement(), value[0], value[1]);
      this._MoveElementCenterTo(this._BootsElement(), value[0], value[1]);
    }
    return _centerPosition;
  }

  this.IsGoofy = function (value) { return this.StanceType(value) < 0; }
  this.IsRegular = function (value) { return this.StanceType(value) > 0; }

  this.StanceType=function(value) {
    if (value != null) {
      if (value < 0) {
        _currentStanceIsMirrored = true;
        this._BootsElement().css({
          '-moz-transform': "scaleX(-1)",
          '-o-transform': "scaleX(-1)",
          '-webkit-transform': "scaleX(-1)",
          transform: "scaleX(-1)",
          filter: "FlipH",
          '-ms-filter': "FlipH"
        });
      } else {
        _currentStanceIsMirrored = false;
        this._BootsElement().css({
          '-moz-transform': "scaleX(1)",
          '-o-transform': "scaleX(1)",
          '-webkit-transform': "scaleX(1)",
          transform: "scaleX(1)",
          filter: "",
          '-ms-filter': ""
        });
      }
      this._Refresh();
    }
    return _currentStanceIsMirrored ? -1 : 1;
  }

  this.AutoRotate=function(value) {
    if (value != null) {
      _isAutoRotating = value;
      if (value) {
        if (_currentRotateTimer != null)
          clearInterval(_currentRotateTimer);

        var This = this;
        _currentRotateTimer = setInterval(function () { This.ViewDegrees(This.ViewDegrees() + rotateDegreeDelta); }, delayInMilliseconds);
      } else {
        clearInterval(_currentRotateTimer);
        this.ViewDegrees(0);
      }
    }
    return _isAutoRotating;
  }

  this.ViewDegrees=function(value) {
    if (value != null) {
      _currentViewDegrees = value;
      this._DisplayGrab(value);
    }
    return _currentViewDegrees;
  }

  this.Grabs = function () { return this._grabList; }
  this.Boards = function() { return this._boardList; }
  this._WakeboardElement = function () { return $("#wakeboard"); }
  this._GridElement = function () { return $("#grid"); }
  this._BootsElement = function () { return $("#boots"); }
  this._FrontHandElements = function () { return [$("#frontHandMarker"), $("#frontHandLabel"), $("#frontHandLine")]; }
  this._FrontHandCrossElements = function () { return [$("#frontHandCrossMarker"), $("#frontHandCrossLabel"), $("#frontHandCrossLine")]; }
  this._RearHandElements = function () { return [$("#rearHandMarker"), $("#rearHandLabel"), $("#rearHandLine")]; }
  this._RearHandCrossElements = function () { return [$("#rearHandCrossMarker"), $("#rearHandCrossLabel"), $("#rearHandCrossLine")]; }

  // methods
  this._MoveElementCenterTo=function(element, x, y) {
    element.css({
      left: x - element.outerWidth() * 0.5,
      top: y - element.outerHeight() * 0.5
    });
  }

  this._HideHand = function (handElements) {
    for (var i = 0; i < handElements.length; ++i)
      handElements[i].hide();
  }

  this._ShowHand = function (handElements) {
    for (var i = 0; i < handElements.length; ++i)
      handElements[i].show();
  }
  
  this._Refresh=function() {
    this._DisplayGrab(_currentViewDegrees);
  }

  this._DisplayGrab=function(degrees) {
    this._RotateBoard(degrees);
    this._AdjustMarkers(degrees);
  }

  this._RotateBoard=function(degrees) {
    this._WakeboardElement().rotate(degrees);

    this._BootsElement().rotate(degrees);
    this._BootsElement().css({
      transform:"rotate({0}deg) scaleX({1})".replace("{0}",degrees).replace("{1}",_currentStanceIsMirrored ? -1 : +1)
    });
  }

  this._AdjustMarkers = function (degrees) {
    var grab = _currentGrab;
    if (grab.frontHand != null)
      this._AdjustHand(grab.frontHand, this._FrontHandElements(), degrees);
    if (grab.rearHand != null)
      this._AdjustHand(grab.rearHand, this._RearHandElements(), degrees);
    if (grab.frontHandCross != null)
      this._AdjustHand(grab.frontHandCross, this._FrontHandCrossElements(), degrees);
    if (grab.rearHandCross != null)
      this._AdjustHand(grab.rearHandCross, this._RearHandCrossElements(), degrees);
  }

  this._AdjustHand=function(normalized, handElements, degrees) {
    var wakeboard = this._WakeboardElement();
    var marker = handElements[_MARKER_INDEX];
    var label = handElements[_LABEL_INDEX];
    var line = handElements[_LINE_INDEX];

    var size = [
      wakeboard.outerWidth(),
      wakeboard.outerHeight()
    ];
    var offset = [
      parseFloat(wakeboard.css("left")),
      parseFloat(wakeboard.css("top"))
    ];

    // scale normalized positions
    var position = [normalized[0] / 2 * size[0], normalized[1] / 2 * size[1]];

    // mirror along y if goofy stance
    if (_currentStanceIsMirrored) {
      position = [
        -position[0],
        position[1]
      ];
    }

    var theta = degrees / 180 * 3.141592653;
    var rotated = [
      position[0] * Math.cos(theta) - position[1] * Math.sin(theta),
      position[0] * Math.sin(theta) + position[1] * Math.cos(theta)
    ];

    // calculate center
    var center = [
      size[0] * 0.5,
      size[1] * 0.5
    ];

    // translate origin
    var translated = [
      rotated[0] + center[0],
      rotated[1] + center[1]
    ];

    // translate to screen
    var screenOffset = [
      translated[0] + offset[0],
      translated[1] + offset[1]
    ];

    this._HideHand(handElements);
    var markerX = screenOffset[0] - marker.outerWidth() * 0.5;
    var markerY = screenOffset[1] - marker.outerHeight() * 0.5;
    marker.css({
      left: markerX,
      top: markerY
    });
    label.css({
      top: screenOffset[1] - label.outerHeight() * 0.5
    });
    line.css({
      left: parseFloat(label.css("left")) + label.outerWidth(),
      top: screenOffset[1] - line.outerHeight() * 0.5,
      width: markerX - parseFloat(label.css("left")) - label.outerWidth()
    });
    this._ShowHand(handElements);
  }

};