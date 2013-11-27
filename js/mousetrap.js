/**
 * Mouse event handlers
 */

function MouseTrap (cutfold) {
    this.cutfold = cutfold;
    this.press_x = 0;
    this.press_y = 0;
    this.move_x = 0;
    this.move_y = 0;
    this.release_x = 0;
    this.release_y = 0;
}

MouseTrap.prototype.handleMouseDown = function (evt, nclicks) {

    var x = evt.clientX - this.cutfold.canvas.offsetLeft;
    var y = evt.clientY - this.cutfold.canvas.offsetTop;
    var cutfold = this.cutfold;
    // Cutfold.trace  ("mouse down (" + x + "," + y + ")");
    var panel = this.cutfold.panel;
    var mode = panel.getMode ();
    if (mode == "cut") {
        var v = new Vertex(x, y);
        if (cutfold.initCut (v)) {
            panel.setMode("cutting");
            x = Math.round (v.x);
            y = Math.round (v.y);
        }
    }
    else if (mode == "fold") {
        panel.setMode("folding");
    }
    else if (mode == "cutting") {
        var v = new Vertex(x, y);
        cutfold.globalToLocal (v);
        // On a double click, we get called for the first click
        // and then again for the second click
        if (cutfold.cutSelect (v, nclicks > 1)) {
            if (cutfold.cutModel ()) {
                panel.setMode ("discard");
            }
        } else {
            // We might have snapped the cursor to a nearby point
            cutfold.localToGlobal (v);
            x = Math.round (v.x);
            y = Math.round (v.y);
            this.redrawSegment (x, y);
        }
    } else if (mode == "discard") {
        if (!cutfold.discardPolygon (x, y)) {
            // leave discard mode when you click in the bg
            panel.setMode ( "" );
        }
    }
    else if (mode == "confirm fold") {

        // clear the fold "cursor"
        var g = panel.getGraphics ();
        // g.setXORMode (Color.white);
        // g.drawLine (press_x, press_y, move_x, move_y);

        // clear ();
        // check which side of press_x, press_y, release_x, release_y that _xmouse, _ymouse is on...
        if (cutfold.rhsTest (this.press_x, this.press_y, this.release_x, this.release_y, x, y)) {
            console.info ("confirm fold rhs");
            cutfold.foldModel (this.release_x, this.release_y, this.press_x, this.press_y);
        } else {
            console.info ("confirm fold lhs");
            cutfold.foldModel (this.press_x, this.press_y, this.release_x, this.release_y);
        }
        panel.setMode ("fold");
    }
    this.move_x = this.press_x = x;
    this.move_y = this.press_y = y;
    this.cutfold.repaint ();
}

MouseTrap.prototype.mousePressed = function (evt, clickCount) {
    if (cutfold.script != null) {
        cutfold.script.captureMousePress (evt); // for debugging
    }
    handleMousePress (evt, clickCount);
}

MouseTrap.prototype.handleMouseUp = function (evt) {
    var x = evt.clientX - this.cutfold.canvas.offsetLeft;
    var y = evt.clientY - this.cutfold.canvas.offsetTop;
    if (this.cutfold.panel.getMode() == "folding") {
        this.release_x = x; 
        this.release_y = y;

        // extend selection to +/- infinity
        var dx = this.release_x - this.press_x, dy = this.release_y - this.press_y;
        var scale = Math.max(dx, dy);
        if (scale < 1) {
            scale = 1;
        } else {
            scale = 500 / scale;
        }
        this.press_x -= scale * dx;
        this.press_y -= scale * dy;
        this.release_x += scale * dx;
        this.release_y += scale * dy;
        this.move_x = this.release_x; 
        this.move_y = this.release_y;
        // this.cutfold.panel.paint ();     // draw new instructions
        this.cutfold.repaint ();     // draw new instructions
        this.cutfold.panel.setMode("confirm fold");
    }
}

MouseTrap.prototype.mouseReleased = function (evt) {
    if (this.cutfold.script != null) {
        this.cutfold.script.captureMouseRelease (evt); // for debugging
    }
    this.handleMouseRelease (evt);
}

MouseTrap.prototype.handleMouseMove = function (evt) {
    var x = evt.clientX - this.cutfold.canvas.offsetLeft;
    var y = evt.clientY - this.cutfold.canvas.offsetTop;
    this.move_x = x;
    this.move_y = y;
    var btn = evt.which;
    if (btn != 0 && cutfold.panel.getMode() == "folding") {
        this.redrawSegment (x, y);
    }
    else if (cutfold.panel.getMode() == "cutting") {
        this.redrawSegment (x, y);
    }
}

MouseTrap.prototype.draw = function (g) {
    // draw the current cursor state
    var mode = cutfold.panel.getMode();
    if (mode == "confirm fold" || mode == "folding") {
        var g = cutfold.panel.getGraphics();
        //g.save();
        // g.globalCompositeOperation = "xor";
        g.strokeStyle = "#000";
        g.moveTo (this.press_x, this.press_y);
        g.lineTo (this.move_x, this.move_y);
        g.stroke();
        //g.restore();
    }
}

MouseTrap.prototype.redrawSegment = function (x, y) {
    /*
    var g = cutfold.panel.getGraphics ();
    g.save();
    g.globalCompositeOperation = "xor";
    g.strokeStyle = "#000";
    g.moveTo (this.press_x, this.press_y);
    g.lineTo (this.move_x, this.move_y);
    this.move_x = x;
    this.move_y = y;
    g.moveTo (this.press_x, this.press_y);
    g.lineTo (this.move_x, this.move_y);
    g.stroke();
    g.restore();
    */
    this.cutfold.repaint ();
}

