onClipEvent (load) {
    // assure that coordinate system == global coordinate system
    _xscale = 100;
    _yscale = 100;
    _x = 0;
    _y = 0;
    _root.discardCursor._visible = false;
    _root.cutCursor._visible = false;
    _root.foldCursor._visible = false;
}

onClipEvent (mouseDown) 
{
    // trace ("mode=" + mode);
    if (mode == "cut" || mode == "fold")
    {
        // trace ("start dragging");
        if (mode == "cut") {
            mode = "cutting";
        } else {
            mode = "folding";
        }
    }
    else if (mode == "cutting")
    {
        if (_root.cutSelect (drag_x, drag_y, _xmouse, _ymouse)) 
        {
            mode = "discard";
            _root.setCursor (_root.discardCursor);
        } 
    }
    else if (mode == "discard")
    {
        // do a hit test - make sure we're still over the same item we clicked on
        // _root.test (_x, _y);
        // mode = null;
        if (!_root.discardPolygon (_xmouse, _ymouse)) 
        {
            // leave discard mode when you click in the bg
            _root.setCursor (null);
            mode = null;
        }
    }
    else if (mode == "confirm_fold") {
        clear ();
        // check which side of x1, y1, x2, y2 that _xmouse, _ymouse is on...
        if (_root.rhsTest (x1, y1, x2, y2, _xmouse, _ymouse)) {
            _root.foldModel (x1, y1, x2, y2);
        } else {
            _root.foldModel (x2, y2, x1, y1);
        }
        _root.setCursor (null);
        mode = "fold";
    }
    drag_x = _xmouse;
    drag_y = _ymouse;
}

onClipEvent (mouseMove) 
{
    if (mode == "folding" || mode == "cutting") {
        clear ();
        lineStyle(0, 0x000000, 100);
        MoveTo (drag_x, drag_y);
        LineTo (_xmouse, _ymouse);
    }
    if (cursorclip) {
        cursorclip._x = _root._xmouse;
        cursorclip._y = _root._ymouse;
    }
}

onClipEvent (mouseUp)
{
    if (mode == "folding")
    {
        _root.setCursor (_root.foldCursor);
        mode = "confirm_fold";
        x1 = drag_x; y1 = drag_y;
        x2 = _xmouse; y2 = _ymouse;
    }
}
